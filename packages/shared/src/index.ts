import type {
  AgentId,
  AgentRelease,
  ManifestHash,
  PackageHash,
  ReleaseId,
} from "../../manifest/src/index.js";
import { assertValidAgentRelease } from "../../manifest/src/index.js";
import {
  assertValidEnsIdentityBinding,
  type EnsApprovedStatus,
  type EnsIdentityBinding,
} from "../../ens/src/index.js";
import type {
  NormalizedPermissionSet,
  PermissionChangeClassification,
  PermissionHash,
} from "../../permissions/src/index.js";
import { assertValidNormalizedPermissionSet } from "../../permissions/src/index.js";
import type { PrivyExecutionMethod } from "../../privy/src/policy-compiler.js";

export type OrganizationId = string & { readonly __brand: "OrganizationId" };
export type InstallationId = string & { readonly __brand: "InstallationId" };
export type HumanDecisionId = string & { readonly __brand: "HumanDecisionId" };

export const INSTALLATION_STATUSES = Object.freeze([
  "VALIDATED",
  "AWAITING_APPROVAL",
  "CONFIGURING_AUTHORITY",
  "ACTIVE",
  "UPDATE_AVAILABLE",
  "AWAITING_REAUTHORIZATION",
  "REVOKING",
  "REVOKED",
] as const);

export type InstallationStatus = (typeof INSTALLATION_STATUSES)[number];
export type HumanDecisionAction =
  | "APPROVE"
  | "REJECT"
  | "REAUTHORIZE"
  | "REVOKE";
export type HumanDecisionOutcome = "APPROVED" | "REJECTED";

export interface Organization {
  readonly schema: "kanon.organization";
  readonly version: 1;
  readonly id: OrganizationId;
  readonly name: string;
  readonly controlWallet: string;
  readonly ensNamespace: string;
}

export interface PrivyControlBinding {
  readonly authorityKind: "DELEGATED_SIGNER";
  readonly walletId: string;
  readonly delegatedSignerId: string;
  readonly policyId: string;
  readonly executionMethod: PrivyExecutionMethod;
  readonly aggregationId?: string;
  readonly permissionHash: PermissionHash;
  readonly generation: number;
  readonly status: "ACTIVE" | "REVOKED";
}

export interface ENSRecordState {
  readonly schema: "kanon.ens-record-state";
  readonly version: 1;
  readonly binding: EnsIdentityBinding;
  readonly agentId: string;
  readonly releaseId: string;
  readonly permissionHash: PermissionHash;
  readonly status: EnsApprovedStatus;
  readonly verified: boolean;
  readonly observedAt: string;
}

export interface HumanDecision {
  readonly schema: "kanon.human-decision";
  readonly version: 1;
  readonly id: HumanDecisionId;
  readonly action: HumanDecisionAction;
  readonly outcome: HumanDecisionOutcome;
  readonly decidedBy: string;
  readonly decidedAt: string;
  readonly agentId: AgentId;
  readonly releaseId: ReleaseId;
  readonly packageHash: PackageHash;
  readonly manifestHash: ManifestHash;
  readonly permissionHash: PermissionHash;
}

export interface UpdateProposal {
  readonly schema: "kanon.update-proposal";
  readonly version: 1;
  readonly release: AgentRelease;
  readonly permissionSet: NormalizedPermissionSet;
  readonly classification: PermissionChangeClassification;
  readonly requiresHumanReview: boolean;
}

export interface ExecutionEvidence {
  readonly schema: "kanon.execution-evidence";
  readonly version: 1;
  readonly installationId: InstallationId;
  readonly generation: number;
  readonly permissionHash: PermissionHash;
  readonly executionMethod: PrivyExecutionMethod;
  readonly outcome: "SUCCEEDED" | "REJECTED";
  readonly transactionHash?: string;
  readonly rejectionCode?: string;
  readonly recordedAt: string;
}

export interface RevocationRecord {
  readonly schema: "kanon.revocation-record";
  readonly version: 1;
  readonly decisionId: HumanDecisionId;
  readonly privyAuthorityRevoked: boolean;
  readonly ensStatus: "revoked";
  readonly postRevokeExecutionFailed: boolean;
  readonly recordedAt: string;
}

export interface Installation {
  readonly schema: "kanon.installation";
  readonly version: 1;
  readonly id: InstallationId;
  readonly organizationId: OrganizationId;
  readonly release: AgentRelease;
  readonly permissionSet: NormalizedPermissionSet;
  readonly status: InstallationStatus;
  readonly generation: number;
  readonly approvedDecision?: HumanDecision;
  readonly privy?: PrivyControlBinding;
  readonly ens?: ENSRecordState;
  readonly pendingUpdate?: UpdateProposal;
  readonly revocation?: RevocationRecord;
}

export type InstallationEvent =
  | { readonly type: "approval_requested" }
  | { readonly type: "approval_granted"; readonly decision: HumanDecision }
  | {
      readonly type: "authority_configured";
      readonly privy: PrivyControlBinding;
      readonly ens: ENSRecordState;
      readonly release?: AgentRelease;
      readonly permissionSet?: NormalizedPermissionSet;
    }
  | { readonly type: "update_available"; readonly proposal: UpdateProposal }
  | {
      readonly type: "reauthorization_requested";
      readonly decision: HumanDecision;
    }
  | { readonly type: "revoke_requested"; readonly decision: HumanDecision }
  | {
      readonly type: "revocation_completed";
      readonly decision: HumanDecision;
      readonly revocation: RevocationRecord;
    };

function nonBlank(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value ||
    /\s/.test(value)
  ) {
    throw new TypeError(`${field} must be a non-blank identifier`);
  }
  return value;
}

function assertIsoTimestamp(value: string, field: string): void {
  nonBlank(value, field);
  if (Number.isNaN(Date.parse(value))) {
    throw new TypeError(`${field} must be an ISO timestamp`);
  }
}

function assertSameReleaseBinding(
  release: AgentRelease,
  permissionSet: NormalizedPermissionSet,
): void {
  if (
    permissionSet.source.agentId !== release.agentId ||
    permissionSet.source.releaseId !== release.releaseId ||
    permissionSet.source.manifestHash !== release.manifestHash
  ) {
    throw new Error(
      "permission set source does not match the installed release",
    );
  }
}

function assertDecisionMatchesRelease(
  decision: HumanDecision,
  release: AgentRelease,
  permissionSet: NormalizedPermissionSet,
): void {
  if (
    decision.agentId !== release.agentId ||
    decision.releaseId !== release.releaseId ||
    decision.packageHash !== release.packageHash ||
    decision.manifestHash !== release.manifestHash ||
    decision.permissionHash !== permissionSet.permissionHash
  ) {
    throw new Error(
      "human decision is not bound to the exact release and permission hash",
    );
  }
}

export function createOrganization(input: {
  readonly id: string;
  readonly name: string;
  readonly controlWallet: string;
  readonly ensNamespace: string;
}): Organization {
  return {
    schema: "kanon.organization",
    version: 1,
    id: nonBlank(input.id, "organization.id") as OrganizationId,
    name: nonBlank(input.name, "organization.name"),
    controlWallet: nonBlank(input.controlWallet, "organization.controlWallet"),
    ensNamespace: nonBlank(input.ensNamespace, "organization.ensNamespace"),
  };
}

export function createHumanDecision(input: {
  readonly id: string;
  readonly action: HumanDecisionAction;
  readonly outcome: HumanDecisionOutcome;
  readonly decidedBy: string;
  readonly decidedAt: string;
  readonly release: AgentRelease;
  readonly permissionSet: NormalizedPermissionSet;
}): HumanDecision {
  assertValidAgentRelease(input.release);
  assertValidNormalizedPermissionSet(input.permissionSet);
  assertSameReleaseBinding(input.release, input.permissionSet);
  if (input.action === "REVOKE" && input.outcome !== "APPROVED") {
    throw new TypeError(
      "a revoke decision must be approved or it is not a revoke event",
    );
  }
  return {
    schema: "kanon.human-decision",
    version: 1,
    id: nonBlank(input.id, "decision.id") as HumanDecisionId,
    action: input.action,
    outcome: input.outcome,
    decidedBy: nonBlank(input.decidedBy, "decision.decidedBy"),
    decidedAt: (() => {
      assertIsoTimestamp(input.decidedAt, "decision.decidedAt");
      return input.decidedAt;
    })(),
    agentId: input.release.agentId,
    releaseId: input.release.releaseId,
    packageHash: input.release.packageHash,
    manifestHash: input.release.manifestHash,
    permissionHash: input.permissionSet.permissionHash,
  };
}

export function createInstallation(input: {
  readonly id: string;
  readonly organizationId: string;
  readonly release: AgentRelease;
  readonly permissionSet: NormalizedPermissionSet;
}): Installation {
  assertValidAgentRelease(input.release);
  assertValidNormalizedPermissionSet(input.permissionSet);
  assertSameReleaseBinding(input.release, input.permissionSet);
  return {
    schema: "kanon.installation",
    version: 1,
    id: nonBlank(input.id, "installation.id") as InstallationId,
    organizationId: nonBlank(
      input.organizationId,
      "installation.organizationId",
    ) as OrganizationId,
    release: input.release,
    permissionSet: input.permissionSet,
    status: "VALIDATED",
    generation: 0,
  };
}

function requireStatus(
  installation: Installation,
  expected: InstallationStatus,
  event: InstallationEvent["type"],
): void {
  if (installation.status !== expected) {
    throw new Error(
      `${event} requires ${expected}, got ${installation.status}`,
    );
  }
}

function assertActiveBindings(
  installation: Installation,
  privy: PrivyControlBinding,
  ens: ENSRecordState,
): void {
  if (privy.authorityKind !== "DELEGATED_SIGNER") {
    throw new Error("active installation requires delegated Privy authority");
  }
  nonBlank(privy.walletId, "privy.walletId");
  nonBlank(privy.delegatedSignerId, "privy.delegatedSignerId");
  nonBlank(privy.policyId, "privy.policyId");
  if (privy.status !== "ACTIVE") {
    throw new Error("ACTIVE installation requires active Privy authority");
  }
  if (
    privy.executionMethod === "eth_signTransaction" &&
    (!privy.aggregationId || privy.aggregationId.trim() === "")
  ) {
    throw new Error(
      "eth_signTransaction authority requires an explicit aggregation binding",
    );
  }
  assertValidEnsIdentityBinding(ens.binding);
  if (!ens.verified || (ens.status !== "approved" && ens.status !== "active")) {
    throw new Error("ACTIVE installation requires verified ENS approved state");
  }
  if (
    privy.permissionHash !== installation.permissionSet.permissionHash ||
    ens.permissionHash !== installation.permissionSet.permissionHash ||
    ens.agentId !== installation.release.agentId ||
    ens.releaseId !== installation.release.releaseId
  ) {
    throw new Error(
      "Privy and ENS bindings do not match the approved installation",
    );
  }
  if (privy.generation !== installation.generation) {
    throw new Error("Privy binding generation does not match the installation");
  }
}

export function transitionInstallation(
  installation: Installation,
  event: InstallationEvent,
): Installation {
  switch (event.type) {
    case "approval_requested":
      requireStatus(installation, "VALIDATED", event.type);
      return { ...installation, status: "AWAITING_APPROVAL" };
    case "approval_granted":
      requireStatus(installation, "AWAITING_APPROVAL", event.type);
      if (
        event.decision.action !== "APPROVE" ||
        event.decision.outcome !== "APPROVED"
      ) {
        throw new Error(
          "initial activation requires an approved APPROVE decision",
        );
      }
      assertDecisionMatchesRelease(
        event.decision,
        installation.release,
        installation.permissionSet,
      );
      return {
        ...installation,
        status: "CONFIGURING_AUTHORITY",
        approvedDecision: event.decision,
      };
    case "authority_configured": {
      if (
        installation.status !== "CONFIGURING_AUTHORITY" &&
        installation.status !== "AWAITING_REAUTHORIZATION"
      ) {
        throw new Error(
          `${event.type} requires CONFIGURING_AUTHORITY or AWAITING_REAUTHORIZATION, got ${installation.status}`,
        );
      }
      const configuredInstallation =
        installation.status === "AWAITING_REAUTHORIZATION"
          ? (() => {
              if (!installation.pendingUpdate) {
                throw new Error(
                  "reauthorization requires a pending update before configuration",
                );
              }
              if (!event.release || !event.permissionSet) {
                throw new Error(
                  "reauthorization configuration requires the approved release and permission set",
                );
              }
              if (!installation.approvedDecision) {
                throw new Error(
                  "reauthorization configuration requires the approved human decision",
                );
              }
              assertDecisionMatchesRelease(
                installation.approvedDecision,
                event.release,
                event.permissionSet,
              );
              assertValidAgentRelease(event.release);
              assertValidNormalizedPermissionSet(event.permissionSet);
              assertSameReleaseBinding(event.release, event.permissionSet);
              if (
                event.release.releaseId !==
                  installation.pendingUpdate.release.releaseId ||
                event.permissionSet.permissionHash !==
                  installation.pendingUpdate.permissionSet.permissionHash
              ) {
                throw new Error(
                  "reauthorization configuration does not match the pending update",
                );
              }
              return {
                ...installation,
                release: event.release,
                permissionSet: event.permissionSet,
                generation: installation.generation + 1,
                pendingUpdate: undefined,
              };
            })()
          : (() => {
              if (event.release || event.permissionSet) {
                throw new Error(
                  "initial authority configuration cannot replace the approved release",
                );
              }
              return installation;
            })();
      assertActiveBindings(configuredInstallation, event.privy, event.ens);
      return {
        ...configuredInstallation,
        status: "ACTIVE",
        privy: event.privy,
        ens: event.ens,
      };
    }
    case "update_available":
      requireStatus(installation, "ACTIVE", event.type);
      assertValidAgentRelease(event.proposal.release);
      assertValidNormalizedPermissionSet(event.proposal.permissionSet);
      assertSameReleaseBinding(
        event.proposal.release,
        event.proposal.permissionSet,
      );
      if (
        (event.proposal.classification === "EXPANDED" ||
          event.proposal.classification === "SUBSTITUTED" ||
          event.proposal.classification === "UNKNOWN") &&
        !event.proposal.requiresHumanReview
      ) {
        throw new Error(
          "expanded, substituted, or unknown authority changes require human review",
        );
      }
      return {
        ...installation,
        status: "UPDATE_AVAILABLE",
        pendingUpdate: event.proposal,
      };
    case "reauthorization_requested":
      requireStatus(installation, "UPDATE_AVAILABLE", event.type);
      if (event.decision.action !== "REAUTHORIZE") {
        throw new Error("reauthorization requires a REAUTHORIZE decision");
      }
      if (event.decision.outcome !== "APPROVED") {
        throw new Error(
          "reauthorization must be explicitly approved before configuration",
        );
      }
      if (!installation.pendingUpdate) {
        throw new Error("reauthorization requires a pending update");
      }
      assertDecisionMatchesRelease(
        event.decision,
        installation.pendingUpdate.release,
        installation.pendingUpdate.permissionSet,
      );
      return {
        ...installation,
        status: "AWAITING_REAUTHORIZATION",
        approvedDecision: event.decision,
      };
    case "revoke_requested":
      requireStatus(installation, "ACTIVE", event.type);
      if (
        event.decision.action !== "REVOKE" ||
        event.decision.outcome !== "APPROVED"
      ) {
        throw new Error("revocation requires an approved REVOKE decision");
      }
      assertDecisionMatchesRelease(
        event.decision,
        installation.release,
        installation.permissionSet,
      );
      return {
        ...installation,
        status: "REVOKING",
        approvedDecision: event.decision,
      };
    case "revocation_completed":
      requireStatus(installation, "REVOKING", event.type);
      if (
        event.decision.action !== "REVOKE" ||
        event.decision.outcome !== "APPROVED" ||
        event.revocation.decisionId !== event.decision.id ||
        !event.revocation.privyAuthorityRevoked ||
        event.revocation.ensStatus !== "revoked" ||
        !event.revocation.postRevokeExecutionFailed
      ) {
        throw new Error(
          "revoked installation requires Privy loss, ENS revoked state, and failed execution",
        );
      }
      assertDecisionMatchesRelease(
        event.decision,
        installation.release,
        installation.permissionSet,
      );
      return {
        ...installation,
        status: "REVOKED",
        generation: installation.generation + 1,
        revocation: event.revocation,
        privy: installation.privy
          ? {
              ...installation.privy,
              status: "REVOKED",
              generation: installation.generation + 1,
            }
          : undefined,
        ens: installation.ens
          ? { ...installation.ens, status: "revoked" }
          : undefined,
      };
  }
}

export function createEnsRecordState(input: {
  readonly binding: EnsIdentityBinding;
  readonly agentId: string;
  readonly releaseId: string;
  readonly permissionHash: PermissionHash;
  readonly status: EnsApprovedStatus;
  readonly verified: boolean;
  readonly observedAt: string;
}): ENSRecordState {
  assertIsoTimestamp(input.observedAt, "ens.observedAt");
  nonBlank(input.agentId, "ens.agentId");
  nonBlank(input.releaseId, "ens.releaseId");
  const binding = assertValidEnsIdentityBinding(input.binding);
  return {
    schema: "kanon.ens-record-state",
    version: 1,
    ...input,
    binding,
  };
}

export function createExecutionEvidence(input: {
  readonly installationId: InstallationId;
  readonly generation: number;
  readonly permissionHash: PermissionHash;
  readonly executionMethod: PrivyExecutionMethod;
  readonly outcome: "SUCCEEDED" | "REJECTED";
  readonly transactionHash?: string;
  readonly rejectionCode?: string;
  readonly recordedAt: string;
}): ExecutionEvidence {
  assertIsoTimestamp(input.recordedAt, "execution.recordedAt");
  if (input.outcome === "SUCCEEDED" && !input.transactionHash) {
    throw new TypeError(
      "successful execution evidence requires a transaction hash",
    );
  }
  if (input.outcome === "REJECTED" && !input.rejectionCode) {
    throw new TypeError(
      "rejected execution evidence requires a rejection code",
    );
  }
  return { schema: "kanon.execution-evidence", version: 1, ...input };
}

export function createRevocationRecord(input: {
  readonly decisionId: HumanDecisionId;
  readonly privyAuthorityRevoked: boolean;
  readonly postRevokeExecutionFailed: boolean;
  readonly recordedAt: string;
}): RevocationRecord {
  assertIsoTimestamp(input.recordedAt, "revocation.recordedAt");
  nonBlank(input.decisionId, "revocation.decisionId");
  return {
    schema: "kanon.revocation-record",
    version: 1,
    decisionId: input.decisionId,
    privyAuthorityRevoked: input.privyAuthorityRevoked,
    ensStatus: "revoked",
    postRevokeExecutionFailed: input.postRevokeExecutionFailed,
    recordedAt: input.recordedAt,
  };
}

export * from "./api-contracts.js";
