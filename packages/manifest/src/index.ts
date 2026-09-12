import { createHash } from "node:crypto";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
export type JsonObject = { readonly [key: string]: JsonValue };

export type AgentId = string & { readonly __brand: "AgentId" };
export type ReleaseId = string & { readonly __brand: "ReleaseId" };
export type PackageHash = string & { readonly __brand: "PackageHash" };
export type ManifestHash = string & { readonly __brand: "ManifestHash" };

export interface AgentRuntimeMetadata {
  readonly entry: string;
}

export interface AgentCapabilityManifest {
  readonly schema: "kanon.agent";
  readonly agent: {
    readonly id: AgentId;
    readonly releaseId: ReleaseId;
    readonly version: string;
  };
  readonly runtime: AgentRuntimeMetadata;
  readonly capabilities: JsonObject;
  readonly packageHash: PackageHash;
  readonly manifestHash: ManifestHash;
}

export interface AgentRelease {
  readonly agentId: AgentId;
  readonly releaseId: ReleaseId;
  readonly version: string;
  readonly packageHash: PackageHash;
  readonly manifestHash: ManifestHash;
  readonly manifest: AgentCapabilityManifest;
}

export interface AgentReleaseInput {
  readonly agentId: string;
  readonly releaseId: string;
  readonly version: string;
  readonly packageContent: string | Uint8Array;
  readonly runtime: AgentRuntimeMetadata;
  readonly capabilities: JsonObject;
}

export interface AgentCapabilityManifestInput {
  readonly agentId: string;
  readonly releaseId: string;
  readonly version: string;
  readonly packageHash: PackageHash;
  readonly runtime: AgentRuntimeMetadata;
  readonly capabilities: JsonObject;
}

export interface CompanyAuthorityTerms {
  readonly schema: "kanon.company-authority-terms";
  readonly version: 1;
  readonly provisional: true;
  readonly data: JsonObject;
}

export interface NormalizedPermissionSet {
  readonly schema: "kanon.normalized-permission-set";
  readonly version: 1;
  readonly provisional: true;
  readonly source: {
    readonly agentId: AgentId;
    readonly releaseId: ReleaseId;
    readonly manifestHash: ManifestHash;
  };
  readonly companyTerms: CompanyAuthorityTerms;
}

const CONTENT_HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;

function assertNonBlank(value: unknown, field: string): string {
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

function assertRuntimeMetadata(runtime: AgentRuntimeMetadata): void {
  if (!runtime || typeof runtime.entry !== "string") {
    throw new TypeError("runtime.entry must be a string");
  }

  assertNonBlank(runtime.entry, "runtime.entry");
}

function assertPackageContent(
  content: unknown,
): asserts content is string | Uint8Array {
  const isEmptyString = typeof content === "string" && content.length === 0;
  const isEmptyBytes =
    content instanceof Uint8Array && content.byteLength === 0;

  if (
    !(typeof content === "string" || content instanceof Uint8Array) ||
    isEmptyString ||
    isEmptyBytes
  ) {
    throw new TypeError(
      "packageContent must be a non-empty string or byte array",
    );
  }
}

function isJsonValue(
  value: unknown,
  seen = new Set<object>(),
): value is JsonValue {
  if (value === null) {
    return true;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value !== "object") {
    return false;
  }

  if (seen.has(value)) {
    return false;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    const valid = value.every((item) => isJsonValue(item, seen));
    seen.delete(value);
    return valid;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    seen.delete(value);
    return false;
  }

  const valid = Object.values(value).every((item) => isJsonValue(item, seen));
  seen.delete(value);
  return valid;
}

function cloneJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => cloneJson(item));
  }

  if (value !== null && typeof value === "object") {
    const clone: Record<string, JsonValue> = {};
    for (const [key, item] of Object.entries(value)) {
      clone[key] = cloneJson(item);
    }
    return clone;
  }

  return value;
}

function freezeJson<T extends JsonValue>(value: T): T {
  if (value !== null && typeof value === "object") {
    if (Array.isArray(value)) {
      value.forEach((item) => freezeJson(item));
    } else {
      Object.values(value).forEach((item) => freezeJson(item));
    }
    Object.freeze(value);
  }

  return value;
}

function snapshotJsonObject(value: JsonObject): JsonObject {
  return freezeJson(cloneJson(value)) as JsonObject;
}

function assertJsonObject(
  value: unknown,
  field: string,
): asserts value is JsonObject {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !isJsonValue(value)
  ) {
    throw new TypeError(`${field} must be a JSON object`);
  }
}

function canonicalJson(value: JsonValue): string {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return JSON.stringify(value);
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }

  const objectValue = value as { readonly [key: string]: JsonValue };

  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(objectValue[key])}`)
    .join(",")}}`;
}

function hashJson(value: JsonValue): string {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

function asPackageHash(value: string): PackageHash {
  if (!CONTENT_HASH_PATTERN.test(value)) {
    throw new TypeError("packageHash must be a sha256 hash");
  }

  return value as PackageHash;
}

function assertAgentRelease(value: unknown): asserts value is AgentRelease {
  if (value === null || typeof value !== "object") {
    throw new TypeError("release must be an AgentRelease");
  }

  const release = value as Partial<AgentRelease>;
  if (
    typeof release.agentId !== "string" ||
    typeof release.releaseId !== "string" ||
    typeof release.version !== "string" ||
    typeof release.packageHash !== "string" ||
    typeof release.manifestHash !== "string" ||
    release.manifest === null ||
    typeof release.manifest !== "object"
  ) {
    throw new TypeError("release must be an AgentRelease");
  }

  assertNonBlank(release.agentId, "release.agentId");
  assertNonBlank(release.releaseId, "release.releaseId");
  assertNonBlank(release.version, "release.version");
  asPackageHash(release.packageHash);
  asPackageHash(release.manifestHash);

  if (release.manifest.manifestHash !== release.manifestHash) {
    throw new TypeError("release manifestHash does not match manifestHash");
  }

  if (release.manifest.packageHash !== release.packageHash) {
    throw new TypeError("release packageHash does not match packageHash");
  }
}

export function assertValidAgentRelease(
  value: unknown,
): asserts value is AgentRelease {
  assertAgentRelease(value);
}

function assertCompanyAuthorityTerms(
  value: unknown,
): asserts value is CompanyAuthorityTerms {
  if (value === null || typeof value !== "object") {
    throw new TypeError("company authority terms must be provisional terms");
  }

  const terms = value as Partial<CompanyAuthorityTerms>;
  if (
    terms.schema !== "kanon.company-authority-terms" ||
    terms.version !== 1 ||
    terms.provisional !== true
  ) {
    throw new TypeError("company authority terms must be provisional terms");
  }

  assertJsonObject(terms.data, "company authority terms data");
}

export function hashPackageContent(content: string | Uint8Array): PackageHash {
  return asPackageHash(
    `sha256:${createHash("sha256").update(content).digest("hex")}`,
  );
}

export function createAgentCapabilityManifest(
  input: AgentCapabilityManifestInput,
): AgentCapabilityManifest {
  const agentId = assertNonBlank(input.agentId, "agentId") as AgentId;
  const releaseId = assertNonBlank(input.releaseId, "releaseId") as ReleaseId;
  const version = assertNonBlank(input.version, "version");

  assertRuntimeMetadata(input.runtime);
  assertJsonObject(input.capabilities, "capabilities");
  const packageHash = asPackageHash(input.packageHash);
  const capabilities = snapshotJsonObject(input.capabilities);

  const declaration = {
    schema: "kanon.agent",
    agent: { id: agentId, releaseId, version },
    runtime: { entry: input.runtime.entry },
    capabilities,
    packageHash,
  } as const;

  return Object.freeze({
    ...declaration,
    manifestHash: hashJson(declaration) as ManifestHash,
  });
}

export function createAgentRelease(input: AgentReleaseInput): AgentRelease {
  const agentId = assertNonBlank(input.agentId, "agentId") as AgentId;
  const releaseId = assertNonBlank(input.releaseId, "releaseId") as ReleaseId;
  const version = assertNonBlank(input.version, "version");
  assertPackageContent(input.packageContent);
  const packageHash = hashPackageContent(input.packageContent);
  const manifest = createAgentCapabilityManifest({
    agentId,
    releaseId,
    version,
    packageHash,
    runtime: input.runtime,
    capabilities: input.capabilities,
  });

  return Object.freeze({
    agentId,
    releaseId,
    version,
    packageHash,
    manifestHash: manifest.manifestHash,
    manifest,
  });
}

export function createProvisionalCompanyAuthorityTerms(
  data: JsonObject,
): CompanyAuthorityTerms {
  assertJsonObject(data, "company authority terms");
  const snapshot = snapshotJsonObject(data);

  return Object.freeze({
    schema: "kanon.company-authority-terms",
    version: 1,
    provisional: true,
    data: snapshot,
  });
}

export function createProvisionalNormalizedPermissionSet(input: {
  readonly release: AgentRelease;
  readonly companyTerms: CompanyAuthorityTerms;
}): NormalizedPermissionSet {
  assertAgentRelease(input.release);
  assertCompanyAuthorityTerms(input.companyTerms);

  return Object.freeze({
    schema: "kanon.normalized-permission-set",
    version: 1,
    provisional: true,
    source: {
      agentId: input.release.agentId,
      releaseId: input.release.releaseId,
      manifestHash: input.release.manifestHash,
    },
    companyTerms: input.companyTerms,
  });
}
