import { randomUUID } from "node:crypto";
import {
  createAgentRelease,
  type AgentRelease,
  type JsonObject,
} from "../../../packages/manifest/src/index.js";
import {
  type ENSRecordState,
  type Installation,
  type PrivyControlBinding,
} from "../../../packages/shared/src/index.js";
import type { NormalizedPermissionSet } from "../../../packages/permissions/src/index.js";
import {
  buildPrivyAggregationRequirements,
  compilePrivyPolicy,
  UnsupportedPolicyCombinationError,
} from "../../../packages/privy/src/policy-compiler.js";
import {
  createPrivyClient,
  findWallet,
  readConfiguredOwnerCredentials,
  readPrivyControlEnvironment,
  type Aggregation,
  type OwnerCredentials,
  type PrivyControlEnvironment,
  type PrivySdkClient,
} from "../../../packages/privy/src/t3-runtime.js";
import {
  CHAIN_ID,
  WALLET_EXTERNAL_ID,
  createAggregation,
  createEnsRuntime,
  deleteAggregation,
  deletePolicy,
  ensExpectedState,
  ensStateFromRead,
  policyCreateParams,
  removeAgentPolicy,
  setAgentPolicy,
} from "../../runner/src/lifecycle-t11-t13-probe.js";
import {
  createApprovedStateWritePlan,
  writeApprovedState,
} from "../../../packages/ens/src/index.js";

interface ControlContext {
  readonly environment: PrivyControlEnvironment;
  readonly client: PrivySdkClient;
  readonly owner: OwnerCredentials;
  readonly wallet: NonNullable<Awaited<ReturnType<typeof findWallet>>>;
}

export interface LiveAuthorityResult {
  readonly privy: PrivyControlBinding;
  readonly ens: ENSRecordState;
}

export interface RevokedPrivyResult {
  readonly policyId: string;
  readonly aggregationId?: string;
}

export interface LiveWalletResult {
  readonly walletId: string;
  readonly address: string;
  readonly chainId: number;
  readonly status: "CONFIGURED" | "REVOKED";
}

function providerError(message: string): Error {
  return new Error(`live authority control failed closed: ${message}`);
}

async function controlContext(): Promise<ControlContext> {
  const environment = readPrivyControlEnvironment();
  if (environment.chainId !== CHAIN_ID) {
    throw providerError("the configured Privy wallet is not on Sepolia");
  }
  const client = createPrivyClient(environment);
  const owner = await readConfiguredOwnerCredentials(client);
  const wallet = await findWallet(client, WALLET_EXTERNAL_ID);
  if (!wallet)
    throw providerError("the configured business wallet was not found");
  if (wallet.owner_id !== owner.keyQuorumId) {
    throw providerError(
      "the business wallet owner does not match the owner quorum",
    );
  }
  return { environment, client, owner, wallet };
}

export async function readLiveWallet(): Promise<LiveWalletResult> {
  const context = await controlContext();
  return {
    walletId: context.wallet.id,
    address: context.wallet.address,
    chainId: context.environment.chainId,
    status: "CONFIGURED",
  };
}

function releaseForInstallation(installation: Installation): {
  readonly release: AgentRelease;
  readonly permissionSet: NormalizedPermissionSet;
  readonly generation: number;
  readonly previous: LiveAuthorityResult | undefined;
} {
  const isUpdate = installation.status === "AWAITING_REAUTHORIZATION";
  if (isUpdate && !installation.pendingUpdate) {
    throw providerError("reauthorization has no pending update");
  }
  const release = isUpdate
    ? installation.pendingUpdate!.release
    : installation.release;
  const permissionSet = isUpdate
    ? installation.pendingUpdate!.permissionSet
    : installation.permissionSet;
  const previous =
    installation.privy && installation.ens
      ? { privy: installation.privy, ens: installation.ens }
      : undefined;
  return {
    release,
    permissionSet,
    generation: isUpdate
      ? installation.generation + 1
      : installation.generation,
    previous,
  };
}

async function deleteCreatedResources(input: {
  readonly context: ControlContext;
  readonly policyId?: string;
  readonly aggregationIds: readonly string[];
}): Promise<void> {
  if (input.policyId) {
    await deletePolicy(
      input.context.client,
      { id: input.policyId },
      input.context.owner,
    );
  }
  for (const aggregationId of input.aggregationIds) {
    await deleteAggregation(
      input.context.environment,
      aggregationId,
      input.context.owner,
    );
  }
}

async function restorePreviousEnsState(input: {
  readonly context: ReturnType<typeof createEnsRuntime>;
  readonly previous: LiveAuthorityResult;
  readonly release: AgentRelease;
  readonly permissionSet: NormalizedPermissionSet;
}): Promise<void> {
  const expected = ensExpectedState({
    release: input.release,
    permissionSet: input.permissionSet,
    status: input.previous.ens.status === "active" ? "active" : "approved",
  });
  const plan = createApprovedStateWritePlan({
    binding: input.context.identity,
    state: expected,
    authorization: {
      lifecycle: "ACTIVE",
      privyAuthority: "ACTIVE",
      agentId: input.previous.ens.agentId,
      releaseId: input.previous.ens.releaseId,
      permissionHash: input.previous.ens.permissionHash,
    },
  });
  await writeApprovedState(input.context.writer, plan);
}

export async function configureLiveAuthority(
  installation: Installation,
): Promise<LiveAuthorityResult> {
  const target = releaseForInstallation(installation);
  const context = await controlContext();
  const ens = createEnsRuntime();
  const isUpdate = installation.status === "AWAITING_REAUTHORIZATION";
  const oldPolicyId = target.previous?.privy.policyId;

  if (!isUpdate) {
    if (
      context.wallet.policy_ids.length !== 0 ||
      context.wallet.additional_signers.length !== 0
    ) {
      throw providerError(
        "initial activation requires a business wallet without delegated authority",
      );
    }
  } else {
    const signer = context.wallet.additional_signers;
    if (
      signer.length !== 1 ||
      signer[0]?.signer_id !== context.environment.agentSignerId ||
      JSON.stringify(signer[0]?.override_policy_ids ?? []) !==
        JSON.stringify([oldPolicyId])
    ) {
      throw providerError(
        "reauthorization requires the currently active delegated signer and policy",
      );
    }
  }

  const policyName = `Kanon ${target.release.releaseId}`.slice(0, 50);
  const aggregationRequirements = buildPrivyAggregationRequirements({
    permissionSet: target.permissionSet,
    ownerId: context.owner.keyQuorumId,
    policyName,
    executionMethod: "eth_signTransaction",
  });
  if (aggregationRequirements.length > 1) {
    throw new UnsupportedPolicyCombinationError(
      "the current API binding supports one rolling aggregation per delegated authority",
    );
  }

  const aggregations: Aggregation[] = [];
  let policyId: string | undefined;
  let attached = false;
  try {
    for (const requirement of aggregationRequirements) {
      aggregations.push(
        await createAggregation(context.environment, requirement.input),
      );
    }
    const aggregationIdsByRule = Object.fromEntries(
      aggregations.map((aggregation, index) => [
        `rule-${index + 1}`,
        aggregation.id,
      ]),
    );
    const plan = compilePrivyPolicy({
      permissionSet: target.permissionSet,
      ownerId: context.owner.keyQuorumId,
      policyName,
      executionMethod: "eth_signTransaction",
      aggregationIdsByRule,
    });
    const policy = await context.client
      .policies()
      .create(policyCreateParams(plan, `kanon-api-${randomUUID()}`));
    policyId = policy.id;

    await setAgentPolicy(
      context.client,
      context.wallet.id,
      context.environment.agentSignerId,
      context.owner,
      policy.id,
    );
    attached = true;

    const expected = ensExpectedState({
      release: target.release,
      permissionSet: target.permissionSet,
      status: "approved",
    });
    const writePlan = createApprovedStateWritePlan({
      binding: ens.identity,
      state: expected,
      authorization: {
        lifecycle: "ACTIVE",
        privyAuthority: "ACTIVE",
        agentId: target.release.agentId,
        releaseId: target.release.releaseId,
        permissionHash: target.permissionSet.permissionHash,
      },
    });
    await writeApprovedState(ens.writer, writePlan);
    const verification = await ens.adapter.verifyApprovedState(
      ens.identity,
      expected,
    );
    if (!verification.ok) {
      throw providerError(
        `ENS readback mismatch: ${verification.mismatches.join(", ")}`,
      );
    }

    const privy: PrivyControlBinding = {
      authorityKind: "DELEGATED_SIGNER",
      walletId: context.wallet.id,
      delegatedSignerId: context.environment.agentSignerId,
      policyId: policy.id,
      executionMethod: "eth_signTransaction",
      ...(aggregations[0] === undefined
        ? {}
        : { aggregationId: aggregations[0].id }),
      permissionHash: target.permissionSet.permissionHash,
      generation: target.generation,
      status: "ACTIVE",
    };
    const ensState = ensStateFromRead(
      ens.identity,
      expected,
      new Date().toISOString(),
    );

    if (oldPolicyId && oldPolicyId !== policy.id) {
      await deletePolicy(context.client, { id: oldPolicyId }, context.owner);
    }
    if (target.previous?.privy.aggregationId) {
      await deleteAggregation(
        context.environment,
        target.previous.privy.aggregationId,
        context.owner,
      );
    }
    return { privy, ens: ensState };
  } catch (error) {
    try {
      if (attached) {
        if (target.previous) {
          await setAgentPolicy(
            context.client,
            context.wallet.id,
            context.environment.agentSignerId,
            context.owner,
            target.previous.privy.policyId,
          );
          await restorePreviousEnsState({
            context: ens,
            previous: target.previous,
            release: installation.release,
            permissionSet: installation.permissionSet,
          });
        } else {
          await removeAgentPolicy(
            context.client,
            context.wallet.id,
            context.owner,
          );
        }
      }
      await deleteCreatedResources({
        context,
        policyId,
        aggregationIds: aggregations.map((aggregation) => aggregation.id),
      });
    } catch (rollbackError) {
      throw providerError(
        `authority operation failed and rollback was incomplete: ${
          rollbackError instanceof Error
            ? rollbackError.message
            : "unknown rollback error"
        }`,
      );
    }
    throw error;
  }
}

export async function revokeLiveAuthority(
  installation: Installation,
): Promise<RevokedPrivyResult> {
  if (!installation.privy || !installation.ens) {
    throw providerError("revocation requires an active Privy and ENS binding");
  }
  const context = await controlContext();
  const signer = context.wallet.additional_signers;
  if (
    signer.length > 1 ||
    (signer.length === 1 &&
      (signer[0]?.signer_id !== installation.privy.delegatedSignerId ||
        JSON.stringify(signer[0]?.override_policy_ids ?? []) !==
          JSON.stringify([installation.privy.policyId])))
  ) {
    throw providerError(
      "wallet delegated signer state does not match the installation",
    );
  }
  if (signer.length === 1) {
    await removeAgentPolicy(context.client, context.wallet.id, context.owner);
  }
  const readback = await context.client.wallets().get(context.wallet.id);
  if (readback.additional_signers.length !== 0) {
    throw providerError(
      "Privy still reports delegated authority after revocation",
    );
  }
  return {
    policyId: installation.privy.policyId,
    ...(installation.privy.aggregationId
      ? { aggregationId: installation.privy.aggregationId }
      : {}),
  };
}

export async function cleanupRevokedAuthority(
  revoked: RevokedPrivyResult,
): Promise<void> {
  const context = await controlContext();
  await deletePolicy(context.client, { id: revoked.policyId }, context.owner);
  if (revoked.aggregationId) {
    await deleteAggregation(
      context.environment,
      revoked.aggregationId,
      context.owner,
    );
  }
}

export async function clearOrphanedDelegatedAuthority(): Promise<void> {
  const context = await controlContext();
  if (context.wallet.additional_signers.length === 0) {
    return;
  }
  await removeAgentPolicy(context.client, context.wallet.id, context.owner);
  const readback = await context.client.wallets().get(context.wallet.id);
  if (readback.additional_signers.length !== 0) {
    throw providerError(
      "Privy still reports delegated authority after orphan cleanup",
    );
  }
}

export async function readVerifiedEnsState(
  installation: Installation,
): Promise<ENSRecordState> {
  if (!installation.ens) {
    throw providerError("installation has no ENS binding");
  }
  const ens = createEnsRuntime();
  const expected = ensExpectedState({
    release: installation.release,
    permissionSet: installation.permissionSet,
    status:
      installation.ens.status === "active" ? "active" : installation.ens.status,
  });
  const verification = await ens.adapter.verifyApprovedState(
    ens.identity,
    expected,
  );
  if (!verification.ok) {
    throw providerError(
      `ENS readback mismatch: ${verification.mismatches.join(", ")}`,
    );
  }
  return ensStateFromRead(ens.identity, expected, new Date().toISOString());
}

export async function createReleaseFromInput(input: {
  readonly agentId: string;
  readonly release:
    | AgentRelease
    | {
        readonly agentId?: string;
        readonly releaseId?: string;
        readonly version?: string;
        readonly packageContent?: string;
        readonly runtime?: { readonly entry?: string };
        readonly capabilities?: Record<string, unknown>;
      };
}): Promise<AgentRelease> {
  const candidate = input.release as {
    readonly packageContent?: string;
    readonly runtime?: { readonly entry?: string };
    readonly capabilities?: Record<string, unknown>;
    readonly releaseId?: string;
    readonly version?: string;
    readonly agentId?: string;
  };
  if (
    typeof candidate.packageContent === "string" &&
    candidate.runtime &&
    typeof candidate.runtime.entry === "string" &&
    candidate.capabilities &&
    typeof candidate.releaseId === "string" &&
    typeof candidate.version === "string"
  ) {
    return createAgentRelease({
      agentId: input.agentId,
      releaseId: candidate.releaseId,
      version: candidate.version,
      packageContent: candidate.packageContent,
      runtime: { entry: candidate.runtime.entry },
      capabilities: candidate.capabilities as JsonObject,
    });
  }
  return input.release as AgentRelease;
}
