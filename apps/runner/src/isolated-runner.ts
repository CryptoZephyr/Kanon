import {
  createExecutionEvidence,
  type ExecutionEvidence,
  type Installation,
  type InstallationId,
  type PrivyControlBinding,
} from "../../../packages/shared/src/index.js";
import type { PermissionHash } from "../../../packages/permissions/src/index.js";

export interface RunnerContext {
  readonly installationId: InstallationId;
  readonly generation: number;
  readonly permissionHash: PermissionHash;
  readonly executionMethod: PrivyControlBinding["executionMethod"];
  readonly delegatedAuthority: {
    readonly walletId: string;
    readonly delegatedSignerId: string;
    readonly policyId: string;
  };
}

export interface RunnerExecutionRequest {
  readonly installationId: InstallationId;
  readonly context: RunnerContext;
  readonly request: Readonly<Record<string, unknown>>;
}

export interface DelegatedExecutionInput {
  readonly walletId: string;
  readonly delegatedSignerId: string;
  readonly policyId: string;
  readonly executionMethod: PrivyControlBinding["executionMethod"];
  readonly request: Readonly<Record<string, unknown>>;
}

export interface DelegatedExecutionResult {
  readonly outcome: "SUCCEEDED" | "REJECTED";
  readonly transactionHash?: string;
  readonly rejectionCode?: string;
}

export interface InstallationReader {
  readonly getInstallation: (
    installationId: InstallationId,
  ) => Promise<Installation> | Installation;
}

export interface DelegatedExecutor {
  readonly execute: (
    input: DelegatedExecutionInput,
  ) => Promise<DelegatedExecutionResult>;
}

export class RunnerRefusalError extends Error {
  public readonly code = "RUNNER_REFUSED_STALE_OR_REVOKED" as const;

  public constructor(message: string) {
    super(message);
    this.name = "RunnerRefusalError";
  }
}

function activeDelegatedAuthority(
  installation: Installation,
): PrivyControlBinding {
  if (installation.status !== "ACTIVE") {
    throw new RunnerRefusalError(
      `runner refuses installation in ${installation.status} state`,
    );
  }

  const authority = installation.privy;
  const ens = installation.ens;
  if (
    authority === undefined ||
    authority.authorityKind !== "DELEGATED_SIGNER" ||
    authority.status !== "ACTIVE" ||
    ens === undefined ||
    !ens.verified ||
    (ens.status !== "approved" && ens.status !== "active")
  ) {
    throw new RunnerRefusalError(
      "runner refuses missing, revoked, or unverified delegated authority",
    );
  }

  if (
    authority.permissionHash !== installation.permissionSet.permissionHash ||
    authority.generation !== installation.generation ||
    ens.permissionHash !== installation.permissionSet.permissionHash ||
    ens.agentId !== installation.release.agentId ||
    ens.releaseId !== installation.release.releaseId
  ) {
    throw new RunnerRefusalError(
      "runner refuses delegated authority that is not bound to the active installation",
    );
  }

  return authority;
}

export function createRunnerContext(installation: Installation): RunnerContext {
  const authority = activeDelegatedAuthority(installation);
  return {
    installationId: installation.id,
    generation: installation.generation,
    permissionHash: authority.permissionHash,
    executionMethod: authority.executionMethod,
    delegatedAuthority: {
      walletId: authority.walletId,
      delegatedSignerId: authority.delegatedSignerId,
      policyId: authority.policyId,
    },
  };
}

export class IsolatedRunner {
  public constructor(
    private readonly reader: InstallationReader,
    private readonly executor: DelegatedExecutor,
  ) {}

  public async execute(
    input: RunnerExecutionRequest,
  ): Promise<ExecutionEvidence> {
    if (input.installationId !== input.context.installationId) {
      throw new RunnerRefusalError(
        "runner refuses a context for a different installation",
      );
    }

    const installation = await this.reader.getInstallation(
      input.installationId,
    );
    const authority = activeDelegatedAuthority(installation);

    if (
      input.context.generation !== installation.generation ||
      input.context.permissionHash !==
        installation.permissionSet.permissionHash ||
      input.context.permissionHash !== authority.permissionHash ||
      input.context.executionMethod !== authority.executionMethod ||
      input.context.delegatedAuthority.walletId !== authority.walletId ||
      input.context.delegatedAuthority.delegatedSignerId !==
        authority.delegatedSignerId ||
      input.context.delegatedAuthority.policyId !== authority.policyId
    ) {
      throw new RunnerRefusalError(
        "runner refuses stale generation, permission hash, or execution method",
      );
    }

    const result = await this.executor.execute({
      walletId: authority.walletId,
      delegatedSignerId: authority.delegatedSignerId,
      policyId: authority.policyId,
      executionMethod: authority.executionMethod,
      request: input.request,
    });

    return createExecutionEvidence({
      installationId: installation.id,
      generation: installation.generation,
      permissionHash: authority.permissionHash,
      executionMethod: authority.executionMethod,
      outcome: result.outcome,
      ...(result.transactionHash
        ? { transactionHash: result.transactionHash }
        : {}),
      ...(result.rejectionCode ? { rejectionCode: result.rejectionCode } : {}),
      recordedAt: new Date().toISOString(),
    });
  }
}
