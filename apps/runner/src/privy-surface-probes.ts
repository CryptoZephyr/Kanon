import { randomUUID } from "node:crypto";
import {
  buildT3ProbeCalldata,
  T3_PROBE_ABI,
  expectedPolicyRejectionStatus,
} from "../../../packages/privy/src/feasibility.js";
import {
  createAuthorizationContext,
  createPrivyClient,
  ensureOwnerCredentials,
  ensureT3Resources,
  readT3Environment,
  runDelegatedRunner,
  type Aggregation,
  type AggregationInput,
  type OwnerCredentials,
  type Policy,
  type PolicyCondition,
  type PolicyCreateParams,
  type PrivySdkClient,
  type RunnerResult,
  type T3Environment,
} from "../../../packages/privy/src/t3-runtime.js";

const SURFACE_EVIDENCE_PATH = "evidence/privy/t3-surface-latest.json";
const PROBE_CONTRACT = "0x0000000000000000000000000000000000000001";
const PROBE_ARGUMENT = 7n;
const PROBE_WRONG_ARGUMENT = 8n;
const PROBE_VALUE_WEI = 1n;

interface SafeError {
  readonly name: string;
  readonly status?: number;
  readonly message?: string;
}

interface ContractFunctionProbe {
  readonly status: "passed" | "failed";
  readonly targetAddress: string;
  readonly requiredFunction: "ping";
  readonly requiredArgument: string;
  readonly allowed?: RunnerResult;
  readonly wrongArgument?: RunnerResult;
  readonly wrongFunction?: RunnerResult;
  readonly error?: SafeError;
}

interface TimingProbe {
  readonly status: "passed" | "failed";
  readonly allowedWindow: {
    readonly startUnix: number;
    readonly endUnix: number;
  };
  readonly forbiddenWindow: {
    readonly startUnix: number;
  };
  readonly allowed?: RunnerResult;
  readonly outsideWindow?: RunnerResult;
  readonly error?: SafeError;
}

interface SpendingProbe {
  readonly status: "passed" | "failed";
  readonly aggregationId?: string;
  readonly capWei: string;
  readonly windowSeconds: number;
  readonly first?: RunnerResult;
  readonly subsequentAttempts: readonly RunnerResult[];
  readonly enforcement: "observed" | "observed-after-retry" | "not-observed";
  readonly error?: SafeError;
}

interface T3SurfaceEvidence {
  readonly status: "passed" | "partial";
  readonly recordedAt: string;
  readonly chain: {
    readonly type: "ethereum";
    readonly id: number;
    readonly asset: "native";
  };
  readonly resources: {
    readonly ownerKeyQuorumId: string;
    readonly agentSignerKeyQuorumId: string;
    readonly walletId: string;
    readonly walletAddress: string;
    readonly baselinePolicyId: string;
  };
  readonly probes: {
    readonly contractFunction: ContractFunctionProbe;
    readonly timing: TimingProbe;
    readonly spending: SpendingProbe;
  };
  readonly documentedSurface: {
    readonly chainRecipientValue: "live-proven";
    readonly contractFunction: "live-proven" | "not-proven";
    readonly nativeAsset: "live-proven";
    readonly spending: "live-proven" | "live-proven-with-delay" | "failed";
    readonly requestRate:
      | "unsupported-by-current-aggregation-model"
      | "not-probed";
    readonly timing: "live-proven" | "not-proven";
  };
  readonly references: readonly string[];
}

class PrivyRestError extends Error {
  public readonly status: number;

  public constructor(status: number, body: unknown) {
    super(`Privy REST request failed: ${safeBodyMessage(body)}`);
    this.name = "PrivyRestError";
    this.status = status;
  }
}

class TemporaryPolicyCleanupError extends Error {
  public readonly restored: boolean;

  public constructor(message: string, restored: boolean) {
    super(message);
    this.name = "TemporaryPolicyCleanupError";
    this.restored = restored;
  }
}

function safeBodyMessage(body: unknown): string {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const record = body as Record<string, unknown>;
    const parts = ["code", "message", "detail", "type"]
      .map((key) => {
        const value = record[key];
        return typeof value === "string" ? `${key}=${value}` : undefined;
      })
      .filter((value): value is string => value !== undefined);
    if (parts.length > 0) return parts.join(";").slice(0, 240);
  }

  return "unknown response";
}

function safeError(
  error: unknown,
  environment: Pick<T3Environment, "appSecret" | "agentPrivateKey">,
): SafeError {
  const message =
    error instanceof Error ? error.message.slice(0, 240) : undefined;
  const status =
    error && typeof error === "object" && "status" in error
      ? (error as { readonly status?: unknown }).status
      : undefined;
  const safeMessage =
    typeof message === "string" && message.length > 0
      ? [
          environment.appSecret,
          environment.agentPrivateKey,
          process.env.PRIVY_OWNER_AUTHORIZATION_PRIVATE_KEY ?? "",
        ].reduce(
          (current, secret) =>
            secret.length > 0
              ? current.split(secret).join("[REDACTED]")
              : current,
          message,
        )
      : undefined;

  return {
    name: error instanceof Error ? error.name : "UnknownError",
    ...(typeof status === "number" ? { status } : {}),
    ...(safeMessage ? { message: safeMessage } : {}),
  };
}

function baseTransactionConditions(
  environment: T3Environment,
  recipient: string,
): PolicyCondition[] {
  return [
    {
      field_source: "ethereum_transaction",
      field: "chain_id",
      operator: "eq",
      value: String(environment.chainId),
    },
    {
      field_source: "ethereum_transaction",
      field: "to",
      operator: "eq",
      value: recipient,
    },
    {
      field_source: "ethereum_transaction",
      field: "value",
      operator: "lte",
      value: "0x1",
    },
  ];
}

function buildProbePolicy(
  ownerId: string,
  name: string,
  conditions: PolicyCondition[],
): PolicyCreateParams {
  return {
    version: "1.0",
    name,
    chain_type: "ethereum",
    owner_id: ownerId,
    rules: [
      {
        name,
        method: "eth_signTransaction",
        action: "ALLOW",
        conditions,
      },
    ],
  };
}

function sameStringArray(
  actual: readonly string[] | undefined,
  expected: readonly string[],
): boolean {
  return JSON.stringify(actual ?? []) === JSON.stringify(expected);
}

function originalAgentPolicyIds(
  wallet: Awaited<ReturnType<typeof ensureT3Resources>>["wallet"],
  agentSignerId: string,
): string[] {
  const signer = wallet.additional_signers.find(
    (candidate) => candidate.signer_id === agentSignerId,
  );
  if (!signer || signer.override_policy_ids?.length !== 1) {
    throw new Error(
      "T3 wallet does not have one baseline agent override policy",
    );
  }
  return [...signer.override_policy_ids];
}

async function setAgentPolicy(
  client: PrivySdkClient,
  walletId: string,
  agentSignerId: string,
  owner: OwnerCredentials,
  policyIds: readonly string[],
): Promise<void> {
  const updated = await client.wallets().update(walletId, {
    additional_signers: [
      {
        signer_id: agentSignerId,
        override_policy_ids: [...policyIds],
      },
    ],
    authorization_context: createAuthorizationContext(owner.privateKey),
  });
  const signer = updated.additional_signers.find(
    (candidate) => candidate.signer_id === agentSignerId,
  );
  if (!signer || !sameStringArray(signer.override_policy_ids, policyIds)) {
    throw new Error("Privy did not apply the requested agent policy override");
  }
}

async function withTemporaryPolicy<T>(input: {
  readonly client: PrivySdkClient;
  readonly environment: T3Environment;
  readonly walletId: string;
  readonly agentSignerId: string;
  readonly owner: OwnerCredentials;
  readonly originalPolicyIds: readonly string[];
  readonly body: PolicyCreateParams;
  readonly operation: (policy: Policy) => Promise<T>;
}): Promise<T> {
  const policy = await input.client.policies().create({
    ...input.body,
    idempotency_key: `kanon-t3-surface-${randomUUID()}`,
  });
  let operationFailed = false;
  let operationResult: T | undefined;
  let operationError: unknown;

  try {
    await setAgentPolicy(
      input.client,
      input.walletId,
      input.agentSignerId,
      input.owner,
      [policy.id],
    );
    operationResult = await input.operation(policy);
  } catch (error) {
    operationFailed = true;
    operationError = error;
  }

  try {
    await setAgentPolicy(
      input.client,
      input.walletId,
      input.agentSignerId,
      input.owner,
      input.originalPolicyIds,
    );
  } catch (error) {
    throw new TemporaryPolicyCleanupError(
      `could not restore baseline signer policy: ${safeBodyMessage(error)}`,
      false,
    );
  }

  try {
    await input.client.policies().delete(policy.id, {
      authorization_context: createAuthorizationContext(input.owner.privateKey),
    });
  } catch (error) {
    throw new TemporaryPolicyCleanupError(
      `could not delete temporary policy ${policy.id}: ${safeBodyMessage(error)}`,
      true,
    );
  }

  if (operationFailed) throw operationError;
  return operationResult as T;
}

async function requestPrivyJson(
  environment: T3Environment,
  method: "DELETE" | "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<Record<string, unknown>> {
  const response = await fetch(`https://api.privy.io${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${environment.appId}:${environment.appSecret}`,
      ).toString("base64")}`,
      "privy-app-id": environment.appId,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let parsed: unknown = {};
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = {};
    }
  }
  if (!response.ok) throw new PrivyRestError(response.status, parsed);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Privy REST response was not a JSON object");
  }
  return parsed as Record<string, unknown>;
}

async function createAggregation(
  environment: T3Environment,
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
  environment: T3Environment,
  aggregationId: string,
): Promise<void> {
  await requestPrivyJson(
    environment,
    "DELETE",
    `/v1/aggregations/${encodeURIComponent(aggregationId)}`,
  );
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function runContractFunctionProbe(input: {
  readonly client: PrivySdkClient;
  readonly environment: T3Environment;
  readonly walletId: string;
  readonly agentSignerId: string;
  readonly owner: OwnerCredentials;
  readonly originalPolicyIds: readonly string[];
}): Promise<ContractFunctionProbe> {
  const conditions = [
    ...baseTransactionConditions(input.environment, PROBE_CONTRACT),
    {
      field_source: "ethereum_calldata" as const,
      field: "function_name" as const,
      operator: "eq" as const,
      value: "ping",
      abi: T3_PROBE_ABI,
    },
    {
      field_source: "ethereum_calldata" as const,
      field: "ping.nonce",
      operator: "eq" as const,
      value: PROBE_ARGUMENT.toString(),
      abi: T3_PROBE_ABI,
    },
  ];
  const policyBody = buildProbePolicy(
    input.owner.keyQuorumId,
    "Kanon T3 calldata function probe",
    conditions,
  );

  return await withTemporaryPolicy({
    ...input,
    body: policyBody,
    operation: async () => {
      const allowed = await runDelegatedRunner({
        environment: input.environment,
        walletId: input.walletId,
        mode: "sign",
        recipient: PROBE_CONTRACT,
        valueWei: PROBE_VALUE_WEI,
        data: buildT3ProbeCalldata("ping", PROBE_ARGUMENT),
      });
      const wrongArgument = await runDelegatedRunner({
        environment: input.environment,
        walletId: input.walletId,
        mode: "sign",
        recipient: PROBE_CONTRACT,
        valueWei: PROBE_VALUE_WEI,
        data: buildT3ProbeCalldata("ping", PROBE_WRONG_ARGUMENT),
      });
      const wrongFunction = await runDelegatedRunner({
        environment: input.environment,
        walletId: input.walletId,
        mode: "sign",
        recipient: PROBE_CONTRACT,
        valueWei: PROBE_VALUE_WEI,
        data: buildT3ProbeCalldata("pong"),
      });
      const status =
        allowed.ok &&
        !wrongArgument.ok &&
        expectedPolicyRejectionStatus(wrongArgument.error.status) &&
        !wrongFunction.ok &&
        expectedPolicyRejectionStatus(wrongFunction.error.status)
          ? ("passed" as const)
          : ("failed" as const);
      return {
        status,
        targetAddress: PROBE_CONTRACT,
        requiredFunction: "ping" as const,
        requiredArgument: PROBE_ARGUMENT.toString(),
        allowed,
        wrongArgument,
        wrongFunction,
      };
    },
  });
}

async function runTimingProbe(input: {
  readonly client: PrivySdkClient;
  readonly environment: T3Environment;
  readonly walletId: string;
  readonly agentSignerId: string;
  readonly owner: OwnerCredentials;
  readonly originalPolicyIds: readonly string[];
}): Promise<TimingProbe> {
  const now = Math.floor(Date.now() / 1000);
  const allowedWindow = { startUnix: now - 60, endUnix: now + 300 };
  const allowed = await withTemporaryPolicy({
    ...input,
    body: buildProbePolicy(
      input.owner.keyQuorumId,
      "Kanon T3 active timing probe",
      [
        ...baseTransactionConditions(
          input.environment,
          input.environment.allowedRecipient,
        ),
        {
          field_source: "system" as const,
          field: "current_unix_timestamp" as const,
          operator: "gte" as const,
          value: String(allowedWindow.startUnix),
        },
        {
          field_source: "system" as const,
          field: "current_unix_timestamp" as const,
          operator: "lte" as const,
          value: String(allowedWindow.endUnix),
        },
      ],
    ),
    operation: async () =>
      await runDelegatedRunner({
        environment: input.environment,
        walletId: input.walletId,
        mode: "sign",
        recipient: input.environment.allowedRecipient,
        valueWei: PROBE_VALUE_WEI,
      }),
  });

  const forbiddenWindowStart = now + 3600;
  const outsideWindow = await withTemporaryPolicy({
    ...input,
    body: buildProbePolicy(
      input.owner.keyQuorumId,
      "Kanon T3 future timing probe",
      [
        ...baseTransactionConditions(
          input.environment,
          input.environment.allowedRecipient,
        ),
        {
          field_source: "system" as const,
          field: "current_unix_timestamp" as const,
          operator: "gte" as const,
          value: String(forbiddenWindowStart),
        },
      ],
    ),
    operation: async () =>
      await runDelegatedRunner({
        environment: input.environment,
        walletId: input.walletId,
        mode: "sign",
        recipient: input.environment.allowedRecipient,
        valueWei: PROBE_VALUE_WEI,
      }),
  });

  return {
    status:
      allowed.ok &&
      !outsideWindow.ok &&
      expectedPolicyRejectionStatus(outsideWindow.error.status)
        ? "passed"
        : "failed",
    allowedWindow,
    forbiddenWindow: { startUnix: forbiddenWindowStart },
    allowed,
    outsideWindow,
  };
}

async function runSpendingProbe(input: {
  readonly client: PrivySdkClient;
  readonly environment: T3Environment;
  readonly walletId: string;
  readonly agentSignerId: string;
  readonly owner: OwnerCredentials;
  readonly originalPolicyIds: readonly string[];
}): Promise<SpendingProbe> {
  const aggregation = await createAggregation(input.environment, {
    name: "Kanon T3 rolling native value probe",
    method: "eth_signTransaction",
    metric: {
      field: "value",
      field_source: "ethereum_transaction",
      function: "sum",
    },
    window: { type: "rolling", seconds: 3600 },
    conditions: [
      {
        field_source: "ethereum_transaction",
        field: "chain_id",
        operator: "eq",
        value: String(input.environment.chainId),
      },
      {
        field_source: "ethereum_transaction",
        field: "to",
        operator: "eq",
        value: input.environment.allowedRecipient,
      },
    ],
  });
  let aggregationCanBeDeleted = false;

  try {
    const result = await withTemporaryPolicy({
      ...input,
      body: buildProbePolicy(
        input.owner.keyQuorumId,
        "Kanon T3 rolling spend probe",
        [
          ...baseTransactionConditions(
            input.environment,
            input.environment.allowedRecipient,
          ),
          {
            field_source: "reference" as const,
            field: `aggregation.${aggregation.id}`,
            operator: "lte" as const,
            value: "0x1",
          },
        ],
      ),
      operation: async () => {
        const first = await runDelegatedRunner({
          environment: input.environment,
          walletId: input.walletId,
          mode: "sign",
          recipient: input.environment.allowedRecipient,
          valueWei: PROBE_VALUE_WEI,
        });
        const subsequentAttempts: RunnerResult[] = [];
        if (first.ok) {
          await delay(1500);
          const second = await runDelegatedRunner({
            environment: input.environment,
            walletId: input.walletId,
            mode: "sign",
            recipient: input.environment.allowedRecipient,
            valueWei: PROBE_VALUE_WEI,
          });
          subsequentAttempts.push(second);
          if (second.ok) {
            await delay(2000);
            const third = await runDelegatedRunner({
              environment: input.environment,
              walletId: input.walletId,
              mode: "sign",
              recipient: input.environment.allowedRecipient,
              valueWei: PROBE_VALUE_WEI,
            });
            subsequentAttempts.push(third);
          }
        }
        const rejectionIndex = subsequentAttempts.findIndex(
          (attempt) =>
            !attempt.ok && expectedPolicyRejectionStatus(attempt.error.status),
        );
        const enforcement =
          rejectionIndex === 0
            ? ("observed" as const)
            : rejectionIndex > 0
              ? ("observed-after-retry" as const)
              : ("not-observed" as const);
        return {
          status:
            first.ok && rejectionIndex >= 0
              ? ("passed" as const)
              : ("failed" as const),
          aggregationId: aggregation.id,
          capWei: PROBE_VALUE_WEI.toString(),
          windowSeconds: 3600,
          first,
          subsequentAttempts,
          enforcement,
        };
      },
    });
    aggregationCanBeDeleted = true;
    return result;
  } catch (error) {
    if (error instanceof TemporaryPolicyCleanupError && error.restored) {
      aggregationCanBeDeleted = true;
    }
    return {
      status: "failed",
      aggregationId: aggregation.id,
      capWei: PROBE_VALUE_WEI.toString(),
      windowSeconds: 3600,
      subsequentAttempts: [],
      enforcement: "not-observed",
      error: safeError(error, input.environment),
    };
  } finally {
    if (aggregationCanBeDeleted) {
      await deleteAggregation(input.environment, aggregation.id);
    }
  }
}

async function writeEvidence(evidence: T3SurfaceEvidence): Promise<void> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dirname, resolve } = await import("node:path");
  const path = resolve(process.cwd(), SURFACE_EVIDENCE_PATH);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

function references(): readonly string[] {
  return [
    "https://docs.privy.io/controls/policies/overview",
    "https://docs.privy.io/controls/policies/example-policies/ethereum",
    "https://docs.privy.io/controls/policies/example-policies/timebound",
    "https://docs.privy.io/controls/policies/stateful-policies",
    "https://docs.privy.io/api-reference/aggregations/create",
    "https://docs.privy.io/api-reference/aggregations/get",
    "https://docs.privy.io/api-reference/aggregations/delete",
    "https://docs.privy.io/api-reference/wallets/update",
  ];
}

export async function runPrivySurfaceProbes(): Promise<T3SurfaceEvidence> {
  const environment = readT3Environment();
  const client = createPrivyClient(environment);
  const owner = await ensureOwnerCredentials(client);
  const { wallet, policy } = await ensureT3Resources(
    client,
    environment,
    owner,
  );
  const originalPolicyIds = originalAgentPolicyIds(
    wallet,
    environment.agentSignerId,
  );
  if (originalPolicyIds[0] !== policy.id) {
    throw new Error(
      "T3 baseline policy does not match the wallet signer override",
    );
  }

  const probeInput = {
    client,
    environment,
    walletId: wallet.id,
    agentSignerId: environment.agentSignerId,
    owner,
    originalPolicyIds,
  } as const;

  let contractFunction: ContractFunctionProbe;
  try {
    contractFunction = await runContractFunctionProbe(probeInput);
  } catch (error) {
    contractFunction = {
      status: "failed",
      targetAddress: PROBE_CONTRACT,
      requiredFunction: "ping",
      requiredArgument: PROBE_ARGUMENT.toString(),
      error: safeError(error, environment),
    };
  }

  let timing: TimingProbe;
  try {
    timing = await runTimingProbe(probeInput);
  } catch (error) {
    const now = Math.floor(Date.now() / 1000);
    timing = {
      status: "failed",
      allowedWindow: { startUnix: now - 60, endUnix: now + 300 },
      forbiddenWindow: { startUnix: now + 3600 },
      error: safeError(error, environment),
    };
  }

  let spending: SpendingProbe;
  try {
    spending = await runSpendingProbe(probeInput);
  } catch (error) {
    spending = {
      status: "failed",
      capWei: PROBE_VALUE_WEI.toString(),
      windowSeconds: 3600,
      subsequentAttempts: [],
      enforcement: "not-observed",
      error: safeError(error, environment),
    };
  }

  const status =
    contractFunction.status === "passed" &&
    timing.status === "passed" &&
    spending.status === "passed"
      ? ("passed" as const)
      : ("partial" as const);
  const evidence: T3SurfaceEvidence = {
    status,
    recordedAt: new Date().toISOString(),
    chain: { type: "ethereum", id: environment.chainId, asset: "native" },
    resources: {
      ownerKeyQuorumId: owner.keyQuorumId,
      agentSignerKeyQuorumId: environment.agentSignerId,
      walletId: wallet.id,
      walletAddress: wallet.address,
      baselinePolicyId: policy.id,
    },
    probes: { contractFunction, timing, spending },
    documentedSurface: {
      chainRecipientValue: "live-proven",
      contractFunction:
        contractFunction.status === "passed" ? "live-proven" : "not-proven",
      nativeAsset: "live-proven",
      spending:
        spending.status === "passed"
          ? spending.enforcement === "observed"
            ? "live-proven"
            : "live-proven-with-delay"
          : "failed",
      requestRate: "unsupported-by-current-aggregation-model",
      timing: timing.status === "passed" ? "live-proven" : "not-proven",
    },
    references: references(),
  };
  await writeEvidence(evidence);
  return evidence;
}

try {
  const evidence = await runPrivySurfaceProbes();
  console.log(`privy_surface=${evidence.status}`);
  console.log(
    `privy_surface_contract_function=${evidence.probes.contractFunction.status}`,
  );
  console.log(`privy_surface_timing=${evidence.probes.timing.status}`);
  console.log(`privy_surface_spending=${evidence.probes.spending.status}`);
  if (evidence.status !== "passed") process.exitCode = 1;
} catch (error) {
  const environment = {
    appSecret: process.env.PRIVY_APP_SECRET ?? "",
    agentPrivateKey: process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY ?? "",
  };
  console.error("privy_surface=failed");
  console.error(`privy_surface_error=${safeError(error, environment).name}`);
  process.exitCode = 1;
}
