import type {
  AgentCapabilityManifest,
  AgentRelease,
  AgentId,
  ManifestHash,
  PackageHash,
  ReleaseId,
} from "../../manifest/src/index.js";
import type {
  EnsApprovedStateRead,
  EnsIdentityBinding,
  EnsProtectedRecordKey,
} from "../../ens/src/index.js";
import type {
  CompanyAuthorityTerms,
  NormalizedPermissionSet,
  PermissionDiff,
  PermissionHash,
} from "../../permissions/src/index.js";
import type { PrivyExecutionMethod } from "../../privy/src/policy-compiler.js";
import type {
  ENSRecordState,
  ExecutionEvidence,
  HumanDecision,
  HumanDecisionId,
  Installation,
  InstallationId,
  InstallationStatus,
  Organization,
  OrganizationId,
  PrivyControlBinding,
  RevocationRecord,
  UpdateProposal,
} from "./index.js";

export const API_CONTRACT_SCHEMA = "kanon.api-contract" as const;
export const API_CONTRACT_VERSION = 1 as const;

export type ApiContractVersion = typeof API_CONTRACT_VERSION;
export type ApiMethod = "GET" | "POST";
export type ApiAuthBoundary = "company";

export interface KanonApiRoute {
  readonly method: ApiMethod;
  readonly path: string;
  readonly auth: ApiAuthBoundary;
}

export const KANON_API_ROUTES = Object.freeze({
  organization: {
    method: "GET",
    path: "/v1/organizations/{organizationId}",
    auth: "company",
  },
  wallet: {
    method: "GET",
    path: "/v1/organizations/{organizationId}/wallet",
    auth: "company",
  },
  agent: {
    method: "GET",
    path: "/v1/organizations/{organizationId}/agents/{agentId}",
    auth: "company",
  },
  release: {
    method: "POST",
    path: "/v1/organizations/{organizationId}/agents/{agentId}/releases",
    auth: "company",
  },
  installation: {
    method: "GET",
    path: "/v1/organizations/{organizationId}/installations/{installationId}",
    auth: "company",
  },
  approval: {
    method: "POST",
    path: "/v1/organizations/{organizationId}/installations/{installationId}/approval",
    auth: "company",
  },
  updateDiff: {
    method: "GET",
    path: "/v1/organizations/{organizationId}/installations/{installationId}/update-diff",
    auth: "company",
  },
  evidence: {
    method: "GET",
    path: "/v1/organizations/{organizationId}/installations/{installationId}/evidence",
    auth: "company",
  },
  revoke: {
    method: "POST",
    path: "/v1/organizations/{organizationId}/installations/{installationId}/revoke",
    auth: "company",
  },
} as const satisfies Readonly<Record<string, KanonApiRoute>>);

export const KANON_API_CONTRACT = Object.freeze({
  schema: API_CONTRACT_SCHEMA,
  version: API_CONTRACT_VERSION,
  routes: KANON_API_ROUTES,
});

export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "CONFLICT"
  | "HUMAN_APPROVAL_REQUIRED"
  | "AUTHORITY_MISMATCH"
  | "UNSUPPORTED_POLICY_COMBINATION"
  | "REVOKED"
  | "INTERNAL_ERROR";

export interface ApiSuccess<T> {
  readonly schema: "kanon.api.success";
  readonly version: ApiContractVersion;
  readonly data: T;
}

export interface ApiErrorResponse {
  readonly schema: "kanon.api.error";
  readonly version: ApiContractVersion;
  readonly code: ApiErrorCode;
  readonly message: string;
  readonly requestId: string;
  readonly details?: Readonly<Record<string, string>>;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorResponse;

export interface OrganizationResource {
  readonly schema: "kanon.api.organization";
  readonly version: ApiContractVersion;
  readonly id: OrganizationId;
  readonly name: string;
  readonly controlWallet: string;
  readonly ensNamespace: string;
}

export type WalletResourceStatus = "UNCONFIGURED" | "CONFIGURED" | "REVOKED";

export interface WalletResourceInput {
  readonly walletId: string;
  readonly address: string;
  readonly chainId: number;
  readonly asset: "native";
  readonly status: WalletResourceStatus;
}

export interface WalletResource {
  readonly schema: "kanon.api.wallet";
  readonly version: ApiContractVersion;
  readonly walletId: string;
  readonly address: string;
  readonly chainId: number;
  readonly asset: "native";
  readonly status: WalletResourceStatus;
}

export interface AgentCapabilityResource {
  readonly schema: "kanon.api.agent-capability";
  readonly version: ApiContractVersion;
  readonly agentId: AgentId;
  readonly releaseId: ReleaseId;
  readonly releaseVersion: string;
  readonly packageHash: PackageHash;
  readonly manifestHash: ManifestHash;
  readonly manifest: AgentCapabilityManifest;
}

export interface CompanyTermsResource {
  readonly schema: "kanon.api.company-terms";
  readonly version: ApiContractVersion;
  readonly agentId: AgentId;
  readonly releaseId: ReleaseId;
  readonly manifestHash: ManifestHash;
  readonly companyTerms: CompanyAuthorityTerms;
  readonly permissionHash: PermissionHash;
}

export interface ApprovalResource {
  readonly schema: "kanon.api.approval";
  readonly version: ApiContractVersion;
  readonly decision: HumanDecision;
}

export interface EnsIdentityResource {
  readonly schema: "kanon.api.ens-identity";
  readonly version: ApiContractVersion;
  readonly binding: EnsIdentityBinding;
  readonly resolver: string;
  readonly records: Readonly<Record<EnsProtectedRecordKey, string>>;
  readonly verified: boolean;
  readonly observedAt: string;
}

export interface PrivyAuthorityResource {
  readonly schema: "kanon.api.privy-authority";
  readonly version: ApiContractVersion;
  readonly walletId: string;
  readonly delegatedSignerId: string;
  readonly policyId: string;
  readonly executionMethod: PrivyExecutionMethod;
  readonly aggregationId?: string;
  readonly permissionHash: PermissionHash;
  readonly generation: number;
  readonly status: "ACTIVE" | "REVOKED";
}

export interface ActiveAuthorityResource {
  readonly schema: "kanon.api.active-authority";
  readonly version: ApiContractVersion;
  readonly installationId: InstallationId;
  readonly generation: number;
  readonly permissionHash: PermissionHash;
  readonly privy: PrivyAuthorityResource;
  readonly ens: EnsIdentityResource;
}

export interface ExecutionEvidenceResource {
  readonly schema: "kanon.api.execution-evidence";
  readonly version: ApiContractVersion;
  readonly evidence: ExecutionEvidence;
}

export interface RevocationEvidenceResource {
  readonly schema: "kanon.api.revocation-evidence";
  readonly version: ApiContractVersion;
  readonly evidence: RevocationRecord;
}

export type ApiEvidenceResource =
  | ExecutionEvidenceResource
  | RevocationEvidenceResource;

export interface UpdateDiffResource {
  readonly schema: "kanon.api.update-diff";
  readonly version: ApiContractVersion;
  readonly installationId: InstallationId;
  readonly proposal: UpdateProposal;
  readonly diff: PermissionDiff;
}

export interface RevokeRequestResource {
  readonly schema: "kanon.api.revoke-request";
  readonly version: ApiContractVersion;
  readonly installationId: InstallationId;
  readonly decision: HumanDecision;
}

export interface RevokeResource {
  readonly schema: "kanon.api.revoke";
  readonly version: ApiContractVersion;
  readonly installationId: InstallationId;
  readonly decisionId: HumanDecisionId;
  readonly status: "REVOKING" | "REVOKED";
  readonly privyAuthorityRevoked: boolean;
  readonly ensStatus: "approved" | "active" | "revoked";
  readonly postRevokeExecutionFailed: boolean;
}

export interface InstallationResource {
  readonly schema: "kanon.api.installation";
  readonly version: ApiContractVersion;
  readonly id: InstallationId;
  readonly organizationId: OrganizationId;
  readonly status: InstallationStatus;
  readonly generation: number;
  readonly agent: AgentCapabilityResource;
  readonly companyTerms: CompanyTermsResource;
  readonly approval?: ApprovalResource;
  readonly activeAuthority?: ActiveAuthorityResource;
  readonly updateDiff?: UpdateDiffResource;
  readonly evidence: readonly ApiEvidenceResource[];
  readonly revoke?: RevokeResource;
}

export interface CreateOrganizationRequest {
  readonly schema: "kanon.api.create-organization";
  readonly version: ApiContractVersion;
  readonly name: string;
  readonly controlWallet: string;
  readonly ensNamespace: string;
}

export interface RegisterWalletRequest {
  readonly schema: "kanon.api.register-wallet";
  readonly version: ApiContractVersion;
  readonly organizationId: OrganizationId;
  readonly wallet: WalletResourceInput;
}

export interface PublishAgentReleaseRequest {
  readonly schema: "kanon.api.publish-release";
  readonly version: ApiContractVersion;
  readonly organizationId: OrganizationId;
  readonly release: AgentRelease;
}

export interface DefineCompanyTermsRequest {
  readonly schema: "kanon.api.define-company-terms";
  readonly version: ApiContractVersion;
  readonly installationId: InstallationId;
  readonly permissionSet: NormalizedPermissionSet;
}

export interface RecordApprovalRequest {
  readonly schema: "kanon.api.record-approval";
  readonly version: ApiContractVersion;
  readonly installationId: InstallationId;
  readonly decision: HumanDecision;
}

export type ApiResource =
  | OrganizationResource
  | WalletResource
  | AgentCapabilityResource
  | CompanyTermsResource
  | ApprovalResource
  | EnsIdentityResource
  | PrivyAuthorityResource
  | ActiveAuthorityResource
  | InstallationResource
  | UpdateDiffResource
  | RevokeResource
  | ExecutionEvidenceResource
  | RevocationEvidenceResource;

const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;

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

function nonEmptyText(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value
  ) {
    throw new TypeError(`${field} must be non-empty text`);
  }
  return value;
}

function chainId(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new TypeError("chainId must be a positive safe integer");
  }
  return value as number;
}

function evmAddress(value: unknown, field: string): string {
  if (typeof value !== "string" || !EVM_ADDRESS_PATTERN.test(value)) {
    throw new TypeError(`${field} must be an EVM address`);
  }
  return `0x${value.slice(2).toLowerCase()}`;
}

function sha256Hash(value: unknown, field: string): string {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) {
    throw new TypeError(`${field} must be a lowercase SHA-256 hash`);
  }
  return value;
}

function assertTimestamp(value: unknown, field: string): string {
  const timestamp = nonBlank(value, field);
  if (Number.isNaN(Date.parse(timestamp))) {
    throw new TypeError(`${field} must be an ISO timestamp`);
  }
  return timestamp;
}

function assertAuthorityIdentifiers(binding: PrivyControlBinding): void {
  nonBlank(binding.walletId, "privy.walletId");
  nonBlank(binding.delegatedSignerId, "privy.delegatedSignerId");
  nonBlank(binding.policyId, "privy.policyId");
  sha256Hash(binding.permissionHash, "privy.permissionHash");
  if (!Number.isSafeInteger(binding.generation) || binding.generation < 0) {
    throw new TypeError("privy.generation must be a non-negative safe integer");
  }
  if (
    binding.executionMethod === "eth_signTransaction" &&
    (!binding.aggregationId || binding.aggregationId.trim() === "")
  ) {
    throw new TypeError("eth_signTransaction authority requires aggregationId");
  }
  if (
    binding.executionMethod === "eth_sendTransaction" &&
    binding.aggregationId !== undefined
  ) {
    throw new TypeError(
      "eth_sendTransaction authority cannot include aggregationId",
    );
  }
}

function assertEnsReadback(
  state: ENSRecordState,
  readback: EnsApprovedStateRead,
): void {
  const stateBinding = state.binding;
  const readbackBinding = readback.binding;
  if (
    readbackBinding.chainId !== stateBinding.chainId ||
    readbackBinding.organizationName !== stateBinding.organizationName ||
    readbackBinding.namespaceName !== stateBinding.namespaceName ||
    readbackBinding.agentName !== stateBinding.agentName ||
    readbackBinding.agentNode !== stateBinding.agentNode ||
    readbackBinding.resolver !== stateBinding.resolver ||
    readbackBinding.controlWallet !== stateBinding.controlWallet ||
    readback.resolver !== stateBinding.resolver
  ) {
    throw new Error("ENS readback does not match the bound identity");
  }
  if (
    readback.records["kanon.agentId"] !== state.agentId ||
    readback.records["kanon.release"] !== state.releaseId ||
    readback.records["kanon.permissionHash"] !== state.permissionHash ||
    readback.records["kanon.status"] !== state.status
  ) {
    throw new Error("ENS readback does not match the bound approved state");
  }
}

export function createApiSuccess<T>(data: T): ApiSuccess<T> {
  return Object.freeze({
    schema: "kanon.api.success" as const,
    version: API_CONTRACT_VERSION,
    data,
  });
}

export function createApiError(input: {
  readonly code: ApiErrorCode;
  readonly message: string;
  readonly requestId: string;
  readonly details?: Readonly<Record<string, string>>;
}): ApiErrorResponse {
  return Object.freeze({
    schema: "kanon.api.error" as const,
    version: API_CONTRACT_VERSION,
    code: input.code,
    message: nonEmptyText(input.message, "error.message"),
    requestId: nonBlank(input.requestId, "error.requestId"),
    ...(input.details === undefined ? {} : { details: input.details }),
  });
}

export function createOrganizationResource(
  organization: Organization,
): OrganizationResource {
  return Object.freeze({
    schema: "kanon.api.organization" as const,
    version: API_CONTRACT_VERSION,
    id: nonBlank(organization.id, "organization.id") as OrganizationId,
    name: nonBlank(organization.name, "organization.name"),
    controlWallet: evmAddress(
      organization.controlWallet,
      "organization.controlWallet",
    ),
    ensNamespace: nonBlank(
      organization.ensNamespace,
      "organization.ensNamespace",
    ),
  });
}

export function createWalletResource(
  input: WalletResourceInput,
): WalletResource {
  if (input.asset !== "native") {
    throw new TypeError("wallet.asset must be native");
  }
  if (
    !Object.freeze(["UNCONFIGURED", "CONFIGURED", "REVOKED"]).includes(
      input.status,
    )
  ) {
    throw new TypeError("wallet.status is unsupported");
  }
  return Object.freeze({
    schema: "kanon.api.wallet" as const,
    version: API_CONTRACT_VERSION,
    walletId: nonBlank(input.walletId, "wallet.walletId"),
    address: evmAddress(input.address, "wallet.address"),
    chainId: chainId(input.chainId),
    asset: input.asset,
    status: input.status,
  });
}

export function createAgentCapabilityResource(
  release: AgentRelease,
): AgentCapabilityResource {
  return Object.freeze({
    schema: "kanon.api.agent-capability" as const,
    version: API_CONTRACT_VERSION,
    agentId: release.agentId,
    releaseId: release.releaseId,
    releaseVersion: release.version,
    packageHash: sha256Hash(
      release.packageHash,
      "release.packageHash",
    ) as PackageHash,
    manifestHash: sha256Hash(
      release.manifestHash,
      "release.manifestHash",
    ) as ManifestHash,
    manifest: release.manifest,
  });
}

export function createCompanyTermsResource(
  permissionSet: NormalizedPermissionSet,
): CompanyTermsResource {
  return Object.freeze({
    schema: "kanon.api.company-terms" as const,
    version: API_CONTRACT_VERSION,
    agentId: permissionSet.source.agentId,
    releaseId: permissionSet.source.releaseId,
    manifestHash: permissionSet.source.manifestHash,
    companyTerms: permissionSet.companyTerms,
    permissionHash: sha256Hash(
      permissionSet.permissionHash,
      "permissionSet.permissionHash",
    ) as PermissionHash,
  });
}

export function createApprovalResource(
  decision: HumanDecision,
): ApprovalResource {
  assertTimestamp(decision.decidedAt, "decision.decidedAt");
  nonBlank(decision.id, "decision.id");
  nonBlank(decision.decidedBy, "decision.decidedBy");
  return Object.freeze({
    schema: "kanon.api.approval" as const,
    version: API_CONTRACT_VERSION,
    decision,
  });
}

export function createEnsIdentityResource(input: {
  readonly state: ENSRecordState;
  readonly readback: EnsApprovedStateRead;
}): EnsIdentityResource {
  assertEnsReadback(input.state, input.readback);
  return Object.freeze({
    schema: "kanon.api.ens-identity" as const,
    version: API_CONTRACT_VERSION,
    binding: input.state.binding,
    resolver: input.readback.resolver,
    records: input.readback.records,
    verified: input.state.verified,
    observedAt: assertTimestamp(input.state.observedAt, "ens.observedAt"),
  });
}

export function createPrivyAuthorityResource(
  binding: PrivyControlBinding,
): PrivyAuthorityResource {
  assertAuthorityIdentifiers(binding);
  return Object.freeze({
    schema: "kanon.api.privy-authority" as const,
    version: API_CONTRACT_VERSION,
    walletId: binding.walletId,
    delegatedSignerId: binding.delegatedSignerId,
    policyId: binding.policyId,
    executionMethod: binding.executionMethod,
    ...(binding.aggregationId === undefined
      ? {}
      : { aggregationId: binding.aggregationId }),
    permissionHash: binding.permissionHash,
    generation: binding.generation,
    status: binding.status,
  });
}

export function createActiveAuthorityResource(input: {
  readonly installationId: InstallationId;
  readonly generation: number;
  readonly permissionHash: PermissionHash;
  readonly privy: PrivyControlBinding;
  readonly ensState: ENSRecordState;
  readonly ensReadback: EnsApprovedStateRead;
}): ActiveAuthorityResource {
  if (input.privy.status !== "ACTIVE") {
    throw new Error("active authority requires active Privy authority");
  }
  if (
    input.ensState.status !== "approved" &&
    input.ensState.status !== "active"
  ) {
    throw new Error("active authority requires approved ENS state");
  }
  if (!input.ensState.verified) {
    throw new Error("active authority requires verified ENS state");
  }
  if (
    input.privy.generation !== input.generation ||
    input.privy.permissionHash !== input.permissionHash ||
    input.ensState.permissionHash !== input.permissionHash
  ) {
    throw new Error("active authority bindings do not match");
  }
  sha256Hash(input.permissionHash, "activeAuthority.permissionHash");
  return Object.freeze({
    schema: "kanon.api.active-authority" as const,
    version: API_CONTRACT_VERSION,
    installationId: nonBlank(
      input.installationId,
      "activeAuthority.installationId",
    ) as InstallationId,
    generation: input.generation,
    permissionHash: input.permissionHash,
    privy: createPrivyAuthorityResource(input.privy),
    ens: createEnsIdentityResource({
      state: input.ensState,
      readback: input.ensReadback,
    }),
  });
}

export function createExecutionEvidenceResource(
  evidence: ExecutionEvidence,
): ExecutionEvidenceResource {
  return Object.freeze({
    schema: "kanon.api.execution-evidence" as const,
    version: API_CONTRACT_VERSION,
    evidence,
  });
}

export function createRevocationEvidenceResource(
  evidence: RevocationRecord,
): RevocationEvidenceResource {
  return Object.freeze({
    schema: "kanon.api.revocation-evidence" as const,
    version: API_CONTRACT_VERSION,
    evidence,
  });
}

export function createUpdateDiffResource(input: {
  readonly installationId: InstallationId;
  readonly proposal: UpdateProposal;
  readonly diff: PermissionDiff;
}): UpdateDiffResource {
  if (
    input.diff.nextPermissionHash !==
      input.proposal.permissionSet.permissionHash ||
    input.diff.classification !== input.proposal.classification ||
    input.diff.requiresHumanReview !== input.proposal.requiresHumanReview
  ) {
    throw new Error("update diff does not match the update proposal");
  }
  return Object.freeze({
    schema: "kanon.api.update-diff" as const,
    version: API_CONTRACT_VERSION,
    installationId: nonBlank(
      input.installationId,
      "updateDiff.installationId",
    ) as InstallationId,
    proposal: input.proposal,
    diff: input.diff,
  });
}

export function createRevokeRequestResource(input: {
  readonly installationId: InstallationId;
  readonly decision: HumanDecision;
}): RevokeRequestResource {
  if (input.decision.action !== "REVOKE") {
    throw new TypeError("revoke request requires a REVOKE decision");
  }
  if (input.decision.outcome !== "APPROVED") {
    throw new TypeError("revoke request requires an approved decision");
  }
  return Object.freeze({
    schema: "kanon.api.revoke-request" as const,
    version: API_CONTRACT_VERSION,
    installationId: nonBlank(
      input.installationId,
      "revokeRequest.installationId",
    ) as InstallationId,
    decision: input.decision,
  });
}

export function createRevokeResource(input: {
  readonly installationId: InstallationId;
  readonly status: "REVOKING" | "REVOKED";
  readonly decisionId: HumanDecisionId;
  readonly revocation: RevocationRecord;
}): RevokeResource {
  if (input.revocation.decisionId !== input.decisionId) {
    throw new Error(
      "revoke resource decision does not match revocation evidence",
    );
  }
  return Object.freeze({
    schema: "kanon.api.revoke" as const,
    version: API_CONTRACT_VERSION,
    installationId: nonBlank(
      input.installationId,
      "revoke.installationId",
    ) as InstallationId,
    decisionId: nonBlank(
      input.decisionId,
      "revoke.decisionId",
    ) as HumanDecisionId,
    status: input.status,
    privyAuthorityRevoked: input.revocation.privyAuthorityRevoked,
    ensStatus: input.revocation.ensStatus,
    postRevokeExecutionFailed: input.revocation.postRevokeExecutionFailed,
  });
}

export function createInstallationResource(input: {
  readonly installation: Installation;
  readonly ensReadback?: EnsApprovedStateRead;
  readonly pendingDiff?: PermissionDiff;
  readonly evidence?: readonly ApiEvidenceResource[];
}): InstallationResource {
  const installation = input.installation;
  const activeAuthority =
    installation.status === "ACTIVE"
      ? installation.privy && installation.ens && input.ensReadback
        ? createActiveAuthorityResource({
            installationId: installation.id,
            generation: installation.generation,
            permissionHash: installation.permissionSet.permissionHash,
            privy: installation.privy,
            ensState: installation.ens,
            ensReadback: input.ensReadback,
          })
        : (() => {
            throw new Error(
              "ACTIVE installation resource requires both authority planes",
            );
          })()
      : undefined;

  const updateDiff =
    installation.pendingUpdate === undefined
      ? undefined
      : input.pendingDiff === undefined
        ? (() => {
            throw new Error(
              "pending update resource requires its permission diff",
            );
          })()
        : createUpdateDiffResource({
            installationId: installation.id,
            proposal: installation.pendingUpdate,
            diff: input.pendingDiff,
          });

  const revoke =
    installation.revocation === undefined
      ? undefined
      : createRevokeResource({
          installationId: installation.id,
          status: installation.status === "REVOKED" ? "REVOKED" : "REVOKING",
          decisionId: installation.revocation.decisionId,
          revocation: installation.revocation,
        });

  return Object.freeze({
    schema: "kanon.api.installation" as const,
    version: API_CONTRACT_VERSION,
    id: installation.id,
    organizationId: installation.organizationId,
    status: installation.status,
    generation: installation.generation,
    agent: createAgentCapabilityResource(installation.release),
    companyTerms: createCompanyTermsResource(installation.permissionSet),
    ...(installation.approvedDecision === undefined
      ? {}
      : { approval: createApprovalResource(installation.approvedDecision) }),
    ...(activeAuthority === undefined ? {} : { activeAuthority }),
    ...(updateDiff === undefined ? {} : { updateDiff }),
    evidence: Object.freeze([...(input.evidence ?? [])]),
    ...(revoke === undefined ? {} : { revoke }),
  });
}
