import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  createCompanyAuthorityTerms,
  createNormalizedPermissionSet,
} from "../../../packages/permissions/src/index.js";
import { createAgentRelease } from "../../../packages/manifest/src/index.js";
import {
  buildPrivyAggregationRequirements,
  compilePrivyPolicy,
  type PrivyPolicyPlan,
} from "../../../packages/privy/src/policy-compiler.js";
import {
  createAuthorizationContext,
  createPrivyClient,
  createPrivyRestAuthorizationHeaders,
  ensureOwnerCredentials,
  findWallet,
  readT3Environment,
  runDelegatedRunner,
  type Aggregation,
  type AggregationInput,
  type OwnerCredentials,
  type Policy,
  type PolicyCreateParams,
  type PrivySdkClient,
  type RunnerResult,
} from "../../../packages/privy/src/t3-runtime.js";
import { expectedPolicyRejectionStatus } from "../../../packages/privy/src/feasibility.js";

const EVIDENCE_PATH = resolve(
  process.cwd(),
  "evidence",
  "privy",
  "t5-compiler-latest.json",
);

class PrivyRestError extends Error {
  public constructor(public readonly status: number) {
    super(`Privy REST request failed with HTTP ${status}`);
    this.name = "PrivyRestError";
  }
}

interface CompilerProbeEvidence {
  readonly status: "passed";
  readonly recordedAt: string;
  readonly chainId: number;
  readonly execution: {
    readonly statelessSend: {
      readonly method: "eth_sendTransaction";
      readonly policyId: string;
      readonly forbiddenSend: RunnerResult;
    };
    readonly statefulSign: {
      readonly method: "eth_signTransaction";
      readonly policyId: string;
      readonly aggregationId: string;
      readonly firstSigning: RunnerResult;
      readonly subsequentSigning: RunnerResult;
    };
  };
  readonly compiler: {
    readonly statelessPermissionHash: string;
    readonly statefulPermissionHash: string;
    readonly statefulAggregationRequirementCount: number;
  };
  readonly references: readonly string[];
}

function safeStatus(result: RunnerResult): number | undefined {
  return result.ok ? undefined : result.error.status;
}

function assertRejected(result: RunnerResult): void {
  if (result.ok || !expectedPolicyRejectionStatus(result.error.status)) {
    throw new Error("Privy did not reject the forbidden compiler probe");
  }
}

async function requestPrivyJson(
  environment: ReturnType<typeof readT3Environment>,
  method: "DELETE" | "POST",
  path: string,
  body?: unknown,
  authorizationPrivateKey?: string,
): Promise<Record<string, unknown>> {
  const url = `https://api.privy.io${path}`;
  const authorizationHeaders =
    authorizationPrivateKey === undefined
      ? {}
      : createPrivyRestAuthorizationHeaders({
          appId: environment.appId,
          privateKey: authorizationPrivateKey,
          method,
          url,
          body: body ?? "",
        });
  const response = await fetch(`https://api.privy.io${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${environment.appId}:${environment.appSecret}`,
      ).toString("base64")}`,
      "privy-app-id": environment.appId,
      ...authorizationHeaders,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30_000),
  });
  const responseText = await response.text();
  let parsed: unknown = {};
  if (responseText.length > 0) {
    try {
      parsed = JSON.parse(responseText) as unknown;
    } catch {
      parsed = {};
    }
  }
  if (!response.ok) throw new PrivyRestError(response.status);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Privy REST response was not a JSON object");
  }
  return parsed as Record<string, unknown>;
}

async function createAggregation(
  environment: ReturnType<typeof readT3Environment>,
  input: AggregationInput,
): Promise<Aggregation> {
  const response = await requestPrivyJson(
    environment,
    "POST",
    "/v1/aggregations",
    input,
  );
  if (typeof response.id !== "string" || response.id.length === 0) {
    throw new Error("Privy aggregation response did not include an ID");
  }
  return response as unknown as Aggregation;
}

async function deleteAggregation(
  environment: ReturnType<typeof readT3Environment>,
  aggregationId: string,
  owner: OwnerCredentials,
): Promise<void> {
  await requestPrivyJson(
    environment,
    "DELETE",
    `/v1/aggregations/${encodeURIComponent(aggregationId)}`,
    undefined,
    owner.privateKey,
  );
}

async function setAgentPolicy(
  client: PrivySdkClient,
  walletId: string,
  agentSignerId: string,
  owner: OwnerCredentials,
  policyIds: readonly string[],
): Promise<void> {
  const wallet = await client.wallets().update(walletId, {
    additional_signers:
      policyIds.length === 0
        ? []
        : [{ signer_id: agentSignerId, override_policy_ids: [...policyIds] }],
    authorization_context: createAuthorizationContext(owner.privateKey),
  });
  const signer = wallet.additional_signers.find(
    (candidate) => candidate.signer_id === agentSignerId,
  );
  if (policyIds.length === 0 && wallet.additional_signers.length !== 0) {
    throw new Error("Privy did not restore the empty signer set");
  }
  if (
    policyIds.length > 0 &&
    (!signer ||
      JSON.stringify(signer.override_policy_ids ?? []) !==
        JSON.stringify(policyIds))
  ) {
    throw new Error("Privy did not apply the compiler probe signer policy");
  }
}

function permissionSet(input: {
  readonly rollingSpend?: {
    readonly maxValueWei: string;
    readonly windowSeconds: number;
  };
  readonly recipient: string;
  readonly chainId: number;
}) {
  const release = createAgentRelease({
    agentId: "com.example.treasury",
    releaseId: "release-t5-compiler-probe",
    version: "1.0.0",
    packageContent: "kanon-t5-compiler-probe",
    runtime: { entry: "worker" },
    capabilities: { chains: [input.chainId], assets: ["native"] },
  });
  return createNormalizedPermissionSet({
    release,
    companyTerms: createCompanyAuthorityTerms({
      rules: [
        {
          chainId: input.chainId,
          asset: "native",
          recipient: input.recipient,
          maxValueWei: "1",
          ...(input.rollingSpend === undefined
            ? {}
            : { rollingSpend: input.rollingSpend }),
        },
      ],
    }),
  });
}

function policyFor(
  plan: PrivyPolicyPlan,
  idempotencyKey: string,
): PolicyCreateParamsWithIdempotency {
  return { ...plan.policy, idempotency_key: idempotencyKey };
}

type PolicyCreateParamsWithIdempotency = PolicyCreateParams & {
  readonly idempotency_key: string;
};

async function deletePolicy(
  client: PrivySdkClient,
  policy: Policy,
  owner: OwnerCredentials,
): Promise<void> {
  await client.policies().delete(policy.id, {
    authorization_context: createAuthorizationContext(owner.privateKey),
  });
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise<void>((resolvePromise) =>
    setTimeout(resolvePromise, milliseconds),
  );
}

async function writeEvidence(evidence: CompilerProbeEvidence): Promise<void> {
  await mkdir(dirname(EVIDENCE_PATH), { recursive: true });
  await writeFile(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`, {
    encoding: "utf8",
  });
}

async function main(): Promise<void> {
  const environment = readT3Environment();
  const client = createPrivyClient(environment);
  const owner = await ensureOwnerCredentials(client);
  const wallet = await findWallet(client, "kanon-t3-sepolia");
  if (!wallet) throw new Error("Kanon T3 wallet was not found");
  if (wallet.owner_id !== owner.keyQuorumId) {
    throw new Error("Kanon T3 wallet owner does not match configured owner");
  }
  if (
    wallet.policy_ids.length !== 0 ||
    wallet.additional_signers.length !== 0
  ) {
    throw new Error(
      "T5 compiler probe requires the existing T3 wallet to start with no base policy and no additional signer",
    );
  }

  const common = {
    chainId: environment.chainId,
    recipient: environment.allowedRecipient,
  } as const;
  const statelessPermissionSet = permissionSet(common);
  const statelessPlan = compilePrivyPolicy({
    permissionSet: statelessPermissionSet,
    ownerId: owner.keyQuorumId,
    policyName: "Kanon T5 stateless probe",
    executionMethod: "eth_sendTransaction",
  });
  const statefulPermissionSet = permissionSet({
    ...common,
    rollingSpend: { maxValueWei: "1", windowSeconds: 3600 },
  });
  const aggregationRequirements = buildPrivyAggregationRequirements({
    permissionSet: statefulPermissionSet,
    ownerId: owner.keyQuorumId,
    policyName: "Kanon T5 stateful probe",
    executionMethod: "eth_signTransaction",
  });
  if (aggregationRequirements.length !== 1) {
    throw new Error(
      "T5 stateful compiler did not produce one aggregation requirement",
    );
  }

  let statelessPolicy: Policy | undefined;
  let statelessPolicyId: string | undefined;
  let statefulPolicy: Policy | undefined;
  let aggregation: Aggregation | undefined;
  let forbiddenSend: RunnerResult | undefined;
  let firstSigning: RunnerResult | undefined;
  let subsequentSigning: RunnerResult | undefined;
  const cleanupFailures: string[] = [];
  try {
    statelessPolicy = await client
      .policies()
      .create(policyFor(statelessPlan, `kanon-t5-stateless-${randomUUID()}`));
    statelessPolicyId = statelessPolicy.id;
    await setAgentPolicy(client, wallet.id, environment.agentSignerId, owner, [
      statelessPolicy.id,
    ]);
    forbiddenSend = await runDelegatedRunner({
      environment,
      walletId: wallet.id,
      mode: "send",
      recipient: environment.forbiddenRecipient,
      valueWei: 1n,
    });
    assertRejected(forbiddenSend);
    await setAgentPolicy(
      client,
      wallet.id,
      environment.agentSignerId,
      owner,
      [],
    );
    await deletePolicy(client, statelessPolicy, owner);
    statelessPolicy = undefined;

    aggregation = await createAggregation(
      environment,
      aggregationRequirements[0].input,
    );
    const statefulPlan = compilePrivyPolicy({
      permissionSet: statefulPermissionSet,
      ownerId: owner.keyQuorumId,
      policyName: "Kanon T5 stateful probe",
      executionMethod: "eth_signTransaction",
      aggregationIdsByRule: { "rule-1": aggregation.id },
    });
    statefulPolicy = await client
      .policies()
      .create(policyFor(statefulPlan, `kanon-t5-stateful-${randomUUID()}`));
    await setAgentPolicy(client, wallet.id, environment.agentSignerId, owner, [
      statefulPolicy.id,
    ]);
    firstSigning = await runDelegatedRunner({
      environment,
      walletId: wallet.id,
      mode: "sign",
      recipient: environment.allowedRecipient,
      valueWei: 1n,
    });
    await delay(1500);
    subsequentSigning = await runDelegatedRunner({
      environment,
      walletId: wallet.id,
      mode: "sign",
      recipient: environment.allowedRecipient,
      valueWei: 1n,
    });
    if (!firstSigning.ok)
      throw new Error("stateful compiler policy rejected first signing");
    assertRejected(subsequentSigning);

    const evidence: CompilerProbeEvidence = {
      status: "passed",
      recordedAt: new Date().toISOString(),
      chainId: environment.chainId,
      execution: {
        statelessSend: {
          method: "eth_sendTransaction",
          policyId: statelessPolicyId ?? "unknown",
          forbiddenSend,
        },
        statefulSign: {
          method: "eth_signTransaction",
          policyId: statefulPolicy.id,
          aggregationId: aggregation.id,
          firstSigning,
          subsequentSigning,
        },
      },
      compiler: {
        statelessPermissionHash: statelessPlan.permissionHash,
        statefulPermissionHash: statefulPlan.permissionHash,
        statefulAggregationRequirementCount: aggregationRequirements.length,
      },
      references: [
        "https://docs.privy.io/controls/policies/overview",
        "https://docs.privy.io/controls/policies/stateful-policies",
        "https://docs.privy.io/api-reference/aggregations/create",
        "https://docs.privy.io/controls/authorization-keys/using-owners/overview",
      ],
    };
    await writeEvidence(evidence);
    console.log("privy_t5_compiler=passed");
    console.log(
      `privy_t5_stateless_forbidden_status=${safeStatus(forbiddenSend)}`,
    );
    console.log(
      `privy_t5_stateful_subsequent_status=${safeStatus(subsequentSigning)}`,
    );
  } finally {
    try {
      await setAgentPolicy(
        client,
        wallet.id,
        environment.agentSignerId,
        owner,
        [],
      );
    } catch {
      cleanupFailures.push("restore-signer-set");
    }
    if (statefulPolicy) {
      try {
        await deletePolicy(client, statefulPolicy, owner);
      } catch {
        cleanupFailures.push("delete-stateful-policy");
      }
    }
    if (statelessPolicy) {
      try {
        await deletePolicy(client, statelessPolicy, owner);
      } catch {
        cleanupFailures.push("delete-stateless-policy");
      }
    }
    if (aggregation) {
      try {
        await deleteAggregation(environment, aggregation.id, owner);
      } catch {
        cleanupFailures.push("delete-aggregation");
      }
    }
  }
  if (cleanupFailures.length > 0) {
    console.log(`privy_t5_cleanup_failures=${cleanupFailures.join(",")}`);
    throw new Error("T5 compiler probe cleanup failed");
  }
}

await main();
