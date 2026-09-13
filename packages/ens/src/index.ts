import { namehash, type Hex } from "viem";
import type {
  AgentId,
  AgentRelease,
  ManifestHash,
  ReleaseId,
} from "../../manifest/src/index.js";
import type { PermissionHash } from "../../permissions/src/index.js";

export type EnsAddress = string & { readonly __brand: "EnsAddress" };

export const ENS_PROTECTED_RECORD_KEYS = Object.freeze([
  "kanon.agentId",
  "kanon.release",
  "kanon.permissionHash",
  "kanon.status",
] as const);

export type EnsProtectedRecordKey = (typeof ENS_PROTECTED_RECORD_KEYS)[number];
export type EnsApprovedStatus = "approved" | "active" | "revoked";
export type EnsApprovedLifecycle = "APPROVED" | "ACTIVE";

export interface EnsV2Deployment {
  readonly chainId: number;
  readonly universalResolverV2: EnsAddress;
}

export interface EnsIdentityBinding {
  readonly schema: "kanon.ens-identity-binding";
  readonly version: 1;
  readonly chainId: number;
  readonly organizationName: string;
  readonly namespaceName: string;
  readonly agentName: string;
  readonly agentNode: Hex;
  readonly resolver: EnsAddress;
  readonly controlWallet: EnsAddress;
}

export interface EnsIdentityBindingInput {
  readonly chainId: number;
  readonly organizationName: string;
  readonly namespaceName: string;
  readonly agentName: string;
  readonly resolver: string;
  readonly controlWallet: string;
}

export interface EnsApprovedState {
  readonly agentId: AgentId | string;
  readonly releaseId: ReleaseId | string;
  readonly permissionHash: PermissionHash | string;
  readonly status: EnsApprovedStatus;
}

export interface EnsApprovedStateRead {
  readonly binding: EnsIdentityBinding;
  readonly resolver: EnsAddress;
  readonly records: Readonly<Record<EnsProtectedRecordKey, string>>;
}

export interface EnsRecordReadTransport {
  readonly findResolver: (
    name: string,
  ) => Promise<{ readonly resolver: string; readonly node: Hex }>;
  readonly readText: (
    name: string,
    key: EnsProtectedRecordKey,
  ) => Promise<{ readonly resolver: string; readonly value: string }>;
}

export interface EnsApprovedStateWriteAuthorization {
  readonly lifecycle: EnsApprovedLifecycle;
  readonly privyAuthority: "ACTIVE" | "REVOKED";
  readonly agentId: AgentId | string;
  readonly releaseId: ReleaseId | string;
  readonly permissionHash: PermissionHash | string;
}

export interface EnsApprovedStateWritePlan {
  readonly binding: EnsIdentityBinding;
  readonly records: Readonly<Record<EnsProtectedRecordKey, string>>;
}

export interface EnsRecordWriteTransport {
  readonly writeProtectedRecords: (
    plan: EnsApprovedStateWritePlan,
  ) => Promise<readonly string[]>;
}

export interface EnsRevocationWritePlan {
  readonly binding: EnsIdentityBinding;
  readonly record: {
    readonly key: "kanon.status";
    readonly value: "revoked";
  };
}

export interface EnsRevocationWriteTransport {
  readonly writeRevokedStatus: (
    plan: EnsRevocationWritePlan,
  ) => Promise<readonly string[]>;
}

export interface EnsStateVerification {
  readonly ok: boolean;
  readonly mismatches: readonly string[];
  readonly observed: EnsApprovedStateRead;
}

const ENS_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const ENS_HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;

function normalizeNonBlank(value: string, field: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value ||
    /\s/.test(value)
  ) {
    throw new TypeError(
      `${field} must be a non-blank value without whitespace`,
    );
  }
  return value;
}

export function normalizeEnsName(value: string, field = "name"): string {
  const normalized = normalizeNonBlank(value, field)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\.$/, "");
  const labels = normalized.split(".");
  if (
    labels.some(
      (label) =>
        label.length === 0 ||
        label.length > 63 ||
        label.includes("\\") ||
        label.includes("/") ||
        label.includes(" "),
    )
  ) {
    throw new TypeError(`${field} must contain valid ENS labels`);
  }
  return normalized;
}

export function normalizeEnsAddress(
  value: string,
  field = "address",
): EnsAddress {
  if (!ENS_ADDRESS_PATTERN.test(value)) {
    throw new TypeError(`${field} must be an EVM address`);
  }
  return `0x${value.slice(2).toLowerCase()}` as EnsAddress;
}

function assertChildName(child: string, parent: string, field: string): void {
  if (child === parent || !child.endsWith(`.${parent}`)) {
    throw new TypeError(`${field} must be a subname of ${parent}`);
  }
}

export function createEnsIdentityBinding(
  input: EnsIdentityBindingInput,
): EnsIdentityBinding {
  if (!Number.isSafeInteger(input.chainId) || input.chainId <= 0) {
    throw new TypeError("chainId must be a positive integer");
  }
  const organizationName = normalizeEnsName(
    input.organizationName,
    "organizationName",
  );
  const namespaceName = normalizeEnsName(input.namespaceName, "namespaceName");
  const agentName = normalizeEnsName(input.agentName, "agentName");
  assertChildName(namespaceName, organizationName, "namespaceName");
  assertChildName(agentName, namespaceName, "agentName");
  return {
    schema: "kanon.ens-identity-binding",
    version: 1,
    chainId: input.chainId,
    organizationName,
    namespaceName,
    agentName,
    agentNode: namehash(agentName),
    resolver: normalizeEnsAddress(input.resolver, "resolver"),
    controlWallet: normalizeEnsAddress(input.controlWallet, "controlWallet"),
  };
}

export function assertValidEnsIdentityBinding(
  binding: EnsIdentityBinding,
): EnsIdentityBinding {
  const expected = createEnsIdentityBinding({
    chainId: binding.chainId,
    organizationName: binding.organizationName,
    namespaceName: binding.namespaceName,
    agentName: binding.agentName,
    resolver: binding.resolver,
    controlWallet: binding.controlWallet,
  });
  if (
    binding.schema !== expected.schema ||
    binding.version !== expected.version
  ) {
    throw new TypeError("ENS identity binding schema or version is invalid");
  }
  if (binding.agentNode !== expected.agentNode) {
    throw new TypeError(
      "ENS identity binding agentNode does not match agentName",
    );
  }
  return expected;
}

function normalizeRecordValue(value: string, field: string): string {
  return normalizeNonBlank(value, field);
}

export function normalizeEnsApprovedState(
  state: EnsApprovedState,
): EnsApprovedState {
  const agentId = normalizeRecordValue(String(state.agentId), "agentId");
  const releaseId = normalizeRecordValue(String(state.releaseId), "releaseId");
  const permissionHash = normalizeRecordValue(
    String(state.permissionHash),
    "permissionHash",
  );
  if (!ENS_HASH_PATTERN.test(permissionHash)) {
    throw new TypeError(
      "permissionHash must be a lowercase SHA-256 permission hash",
    );
  }
  if (
    state.status !== "approved" &&
    state.status !== "active" &&
    state.status !== "revoked"
  ) {
    throw new TypeError("status is not a supported ENS approved-state value");
  }
  return { agentId, releaseId, permissionHash, status: state.status };
}

function recordsForState(
  state: EnsApprovedState,
): Readonly<Record<EnsProtectedRecordKey, string>> {
  const normalized = normalizeEnsApprovedState(state);
  return {
    "kanon.agentId": normalized.agentId,
    "kanon.release": normalized.releaseId,
    "kanon.permissionHash": normalized.permissionHash,
    "kanon.status": normalized.status,
  };
}

export class EnsV2Adapter {
  public constructor(
    private readonly transport: EnsRecordReadTransport,
    private readonly deployment: EnsV2Deployment,
  ) {}

  public async readApprovedState(
    binding: EnsIdentityBinding,
  ): Promise<EnsApprovedStateRead> {
    const validBinding = assertValidEnsIdentityBinding(binding);
    if (validBinding.chainId !== this.deployment.chainId) {
      throw new Error(
        "ENS identity binding chain does not match the adapter deployment",
      );
    }
    const resolverResult = await this.transport.findResolver(
      validBinding.agentName,
    );
    const resolver = normalizeEnsAddress(
      resolverResult.resolver,
      "resolved resolver",
    );
    if (resolver !== validBinding.resolver) {
      throw new Error("ENS resolver does not match the installation binding");
    }
    if (resolverResult.node !== validBinding.agentNode) {
      throw new Error(
        "ENS resolver returned a node different from the installation binding",
      );
    }
    const recordEntries = await Promise.all(
      ENS_PROTECTED_RECORD_KEYS.map(async (key) => {
        const result = await this.transport.readText(
          validBinding.agentName,
          key,
        );
        const resultResolver = normalizeEnsAddress(
          result.resolver,
          "record resolver",
        );
        if (resultResolver !== validBinding.resolver) {
          throw new Error(`ENS record ${key} came from an unexpected resolver`);
        }
        return [key, result.value] as const;
      }),
    );
    return {
      binding: validBinding,
      resolver,
      records: Object.fromEntries(recordEntries) as Record<
        EnsProtectedRecordKey,
        string
      >,
    };
  }

  public async verifyApprovedState(
    binding: EnsIdentityBinding,
    expected: EnsApprovedState,
  ): Promise<EnsStateVerification> {
    const observed = await this.readApprovedState(binding);
    const expectedRecords = recordsForState(expected);
    const mismatches: string[] = [];
    for (const key of ENS_PROTECTED_RECORD_KEYS) {
      if (observed.records[key] !== expectedRecords[key]) {
        mismatches.push(key);
      }
    }
    return { ok: mismatches.length === 0, mismatches, observed };
  }
}

export function createApprovedStateWritePlan(input: {
  readonly binding: EnsIdentityBinding;
  readonly state: EnsApprovedState;
  readonly authorization: EnsApprovedStateWriteAuthorization;
}): EnsApprovedStateWritePlan {
  const binding = assertValidEnsIdentityBinding(input.binding);
  const state = normalizeEnsApprovedState(input.state);
  if (state.status === "revoked") {
    throw new Error(
      "revoked ENS state cannot be written by the approved-state adapter",
    );
  }
  if (
    input.authorization.lifecycle !== "APPROVED" &&
    input.authorization.lifecycle !== "ACTIVE"
  ) {
    throw new Error(
      "approved-state write requires an approved or active lifecycle",
    );
  }
  if (input.authorization.privyAuthority !== "ACTIVE") {
    throw new Error(
      "approved-state write requires confirmed active Privy authority",
    );
  }
  if (
    String(input.authorization.agentId) !== state.agentId ||
    String(input.authorization.releaseId) !== state.releaseId ||
    String(input.authorization.permissionHash) !== state.permissionHash
  ) {
    throw new Error(
      "approved-state authorization does not match the exact ENS records",
    );
  }
  return { binding, records: recordsForState(state) };
}

export async function writeApprovedState(
  writer: EnsRecordWriteTransport,
  plan: EnsApprovedStateWritePlan,
): Promise<readonly string[]> {
  assertValidEnsIdentityBinding(plan.binding);
  return writer.writeProtectedRecords(plan);
}

export function createRevokedStatusWritePlan(input: {
  readonly binding: EnsIdentityBinding;
  readonly current: EnsApprovedState;
  readonly privyAuthority: "ACTIVE" | "REVOKED";
}): EnsRevocationWritePlan {
  const binding = assertValidEnsIdentityBinding(input.binding);
  const current = normalizeEnsApprovedState(input.current);
  if (input.privyAuthority !== "REVOKED") {
    throw new Error(
      "ENS revoked status requires confirmed loss of delegated Privy authority",
    );
  }
  if (current.status === "revoked") {
    throw new Error("ENS revoked status is already present");
  }
  return {
    binding,
    record: { key: "kanon.status", value: "revoked" },
  };
}

export async function writeRevokedStatus(
  writer: EnsRevocationWriteTransport,
  plan: EnsRevocationWritePlan,
): Promise<readonly string[]> {
  assertValidEnsIdentityBinding(plan.binding);
  return writer.writeRevokedStatus(plan);
}

export function bindReleaseToEnsIdentity(input: {
  readonly binding: EnsIdentityBinding;
  readonly release: Pick<
    AgentRelease,
    "agentId" | "releaseId" | "manifestHash"
  >;
  readonly permissionHash: PermissionHash;
}): EnsApprovedState {
  assertValidEnsIdentityBinding(input.binding);
  return normalizeEnsApprovedState({
    agentId: input.release.agentId,
    releaseId: input.release.releaseId,
    permissionHash: input.permissionHash,
    status: "approved",
  });
}

export type { AgentId, ManifestHash, PermissionHash, ReleaseId };
