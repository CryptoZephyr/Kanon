import { createHash } from "node:crypto";
import type {
  AgentId,
  AgentRelease,
  ManifestHash,
  ReleaseId,
} from "../../manifest/src/index.js";
import { assertValidAgentRelease } from "../../manifest/src/index.js";

export const SUPPORTED_PRIVY_EXECUTION_METHODS = Object.freeze([
  "eth_signTransaction",
  "eth_sendTransaction",
] as const);

export type PermissionHash = string & {
  readonly __brand: "PermissionHash";
};

export type EvmAddress = string & {
  readonly __brand: "EvmAddress";
};

export type DecimalQuantity = string & {
  readonly __brand: "DecimalQuantity";
};

export interface CalldataFunctionInput {
  readonly name: string;
  readonly type: string;
}

export interface CalldataFunction {
  readonly name: string;
  readonly inputs: readonly CalldataFunctionInput[];
}

export interface CalldataConstraint {
  readonly function: CalldataFunction;
  readonly exactArguments: Readonly<Record<string, string>>;
}

export interface ValidityWindow {
  readonly notBeforeUnix?: number;
  readonly notAfterUnix?: number;
}

export interface RollingSpendLimit {
  readonly maxValueWei: DecimalQuantity;
  readonly windowSeconds: number;
}

export interface CompanyAuthorityRule {
  readonly chainId: number;
  readonly asset: "native";
  readonly recipient: EvmAddress;
  readonly maxValueWei: DecimalQuantity;
  readonly calldata?: CalldataConstraint;
  readonly validityWindow?: ValidityWindow;
  readonly rollingSpend?: RollingSpendLimit;
}

export interface CompanyAuthorityRuleInput {
  readonly chainId: number;
  readonly asset: "native";
  readonly recipient: string;
  readonly maxValueWei: string | bigint;
  readonly calldata?: {
    readonly function: {
      readonly name: string;
      readonly inputs: readonly CalldataFunctionInput[];
    };
    readonly exactArguments?: Readonly<Record<string, string>>;
  };
  readonly validityWindow?: ValidityWindow;
  readonly rollingSpend?: {
    readonly maxValueWei: string | bigint;
    readonly windowSeconds: number;
  };
}

export interface CompanyAuthorityTermsInput {
  readonly rules: readonly CompanyAuthorityRuleInput[];
}

export interface CompanyAuthorityTerms {
  readonly schema: "kanon.company-authority-terms";
  readonly version: 2;
  readonly authority: {
    readonly rules: readonly CompanyAuthorityRule[];
  };
}

export interface NormalizedPermissionSet {
  readonly schema: "kanon.normalized-permission-set";
  readonly version: 2;
  readonly source: {
    readonly agentId: AgentId;
    readonly releaseId: ReleaseId;
    readonly manifestHash: ManifestHash;
  };
  readonly companyTerms: CompanyAuthorityTerms;
  readonly permissionHash: PermissionHash;
}

export class UnsupportedAuthorityError extends TypeError {
  public readonly code = "UNSUPPORTED_AUTHORITY_CONDITION" as const;

  public constructor(message: string) {
    super(message);
    this.name = "UnsupportedAuthorityError";
  }
}

type UnknownRecord = Record<string, unknown>;

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ABI_TYPE_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*(?:[0-9]+)?(?:\[[0-9]*\])*$/;
const SHA256_HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const PERMISSION_HASH_PATTERN = SHA256_HASH_PATTERN;
const CONTENT_HASH_PATTERN = SHA256_HASH_PATTERN;

function isPlainRecord(value: unknown): value is UnknownRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPlainRecord(value: unknown, field: string): UnknownRecord {
  if (!isPlainRecord(value)) {
    throw new TypeError(`${field} must be a JSON object`);
  }

  return value;
}

function assertExactKeys(
  value: UnknownRecord,
  allowed: readonly string[],
  field: string,
): void {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw new UnsupportedAuthorityError(`${field}.${key} is unsupported`);
    }
  }
}

function assertRequiredKeys(
  value: UnknownRecord,
  required: readonly string[],
  field: string,
): void {
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      throw new TypeError(`${field}.${key} is required`);
    }
  }
}

function assertNonBlankIdentifier(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value ||
    !IDENTIFIER_PATTERN.test(value)
  ) {
    throw new TypeError(`${field} must be a valid identifier`);
  }

  return value;
}

function assertSafePositiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new TypeError(`${field} must be a positive safe integer`);
  }

  return value as number;
}

function assertSafeUnixTimestamp(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new TypeError(`${field} must be a non-negative safe integer`);
  }

  return value as number;
}

function normalizeDecimalQuantity(
  value: unknown,
  field: string,
): DecimalQuantity {
  let decimal: string;
  if (typeof value === "bigint") {
    if (value < 0n) {
      throw new TypeError(`${field} must be non-negative`);
    }
    decimal = value.toString(10);
  } else if (typeof value === "string") {
    if (value.length === 0 || value.trim() !== value || !/^\d+$/.test(value)) {
      throw new TypeError(`${field} must be a canonical decimal quantity`);
    }
    decimal = value.replace(/^0+(?=\d)/, "");
  } else {
    throw new TypeError(`${field} must be a bigint or decimal string`);
  }

  return decimal as DecimalQuantity;
}

function normalizeAddress(value: unknown, field: string): EvmAddress {
  if (typeof value !== "string" || !ADDRESS_PATTERN.test(value)) {
    throw new TypeError(`${field} must be an EVM address`);
  }

  return value.toLowerCase() as EvmAddress;
}

function normalizeValidityWindow(value: unknown): ValidityWindow {
  const record = assertPlainRecord(value, "validityWindow");
  assertExactKeys(record, ["notBeforeUnix", "notAfterUnix"], "validityWindow");
  if (Object.keys(record).length === 0) {
    throw new TypeError("validityWindow must contain a boundary");
  }

  const normalized: {
    notBeforeUnix?: number;
    notAfterUnix?: number;
  } = {};
  if (Object.prototype.hasOwnProperty.call(record, "notBeforeUnix")) {
    normalized.notBeforeUnix = assertSafeUnixTimestamp(
      record.notBeforeUnix,
      "validityWindow.notBeforeUnix",
    );
  }
  if (Object.prototype.hasOwnProperty.call(record, "notAfterUnix")) {
    normalized.notAfterUnix = assertSafeUnixTimestamp(
      record.notAfterUnix,
      "validityWindow.notAfterUnix",
    );
  }
  if (
    normalized.notBeforeUnix !== undefined &&
    normalized.notAfterUnix !== undefined &&
    normalized.notBeforeUnix > normalized.notAfterUnix
  ) {
    throw new TypeError(
      "validityWindow.notBeforeUnix must be before or equal to notAfterUnix",
    );
  }

  return normalized;
}

function normalizeCalldata(value: unknown): CalldataConstraint {
  const record = assertPlainRecord(value, "calldata");
  assertExactKeys(record, ["function", "exactArguments"], "calldata");
  assertRequiredKeys(record, ["function"], "calldata");

  const functionRecord = assertPlainRecord(
    record.function,
    "calldata.function",
  );
  assertExactKeys(functionRecord, ["name", "inputs"], "calldata.function");
  assertRequiredKeys(functionRecord, ["name", "inputs"], "calldata.function");
  const functionName = assertNonBlankIdentifier(
    functionRecord.name,
    "calldata.function.name",
  );
  if (!Array.isArray(functionRecord.inputs)) {
    throw new TypeError("calldata.function.inputs must be an array");
  }

  const names = new Set<string>();
  const inputs = functionRecord.inputs.map((input, index) => {
    const inputRecord = assertPlainRecord(
      input,
      `calldata.function.inputs[${index}]`,
    );
    assertExactKeys(
      inputRecord,
      ["name", "type"],
      `calldata.function.inputs[${index}]`,
    );
    assertRequiredKeys(
      inputRecord,
      ["name", "type"],
      `calldata.function.inputs[${index}]`,
    );
    const name = assertNonBlankIdentifier(
      inputRecord.name,
      `calldata.function.inputs[${index}].name`,
    );
    if (names.has(name)) {
      throw new TypeError(`calldata function input ${name} is duplicated`);
    }
    names.add(name);
    if (
      typeof inputRecord.type !== "string" ||
      !ABI_TYPE_PATTERN.test(inputRecord.type)
    ) {
      throw new TypeError(
        `calldata.function.inputs[${index}].type must be a supported ABI type label`,
      );
    }
    return { name, type: inputRecord.type };
  });

  const argumentsRecord =
    record.exactArguments === undefined
      ? {}
      : assertPlainRecord(record.exactArguments, "calldata.exactArguments");
  for (const [name, value] of Object.entries(argumentsRecord)) {
    if (!names.has(name)) {
      throw new UnsupportedAuthorityError(
        `calldata.exactArguments.${name} is not an ABI input`,
      );
    }
    if (typeof value !== "string") {
      throw new TypeError(`calldata.exactArguments.${name} must be a string`);
    }
  }

  return {
    function: { name: functionName, inputs },
    exactArguments: { ...argumentsRecord } as Record<string, string>,
  };
}

function normalizeRollingSpend(value: unknown): RollingSpendLimit {
  const record = assertPlainRecord(value, "rollingSpend");
  assertExactKeys(record, ["maxValueWei", "windowSeconds"], "rollingSpend");
  assertRequiredKeys(record, ["maxValueWei", "windowSeconds"], "rollingSpend");

  return {
    maxValueWei: normalizeDecimalQuantity(
      record.maxValueWei,
      "rollingSpend.maxValueWei",
    ),
    windowSeconds: assertSafePositiveInteger(
      record.windowSeconds,
      "rollingSpend.windowSeconds",
    ),
  };
}

function normalizeRule(value: unknown, index: number): CompanyAuthorityRule {
  const field = `authority.rules[${index}]`;
  const record = assertPlainRecord(value, field);
  assertExactKeys(
    record,
    [
      "chainId",
      "asset",
      "recipient",
      "maxValueWei",
      "calldata",
      "validityWindow",
      "rollingSpend",
    ],
    field,
  );
  assertRequiredKeys(
    record,
    ["chainId", "asset", "recipient", "maxValueWei"],
    field,
  );

  const asset = record.asset;
  if (asset !== "native") {
    throw new UnsupportedAuthorityError(
      `${field}.asset must be native because the verified Privy path does not prove token enforcement`,
    );
  }

  const normalized: {
    chainId: number;
    asset: "native";
    recipient: EvmAddress;
    maxValueWei: DecimalQuantity;
    calldata?: CalldataConstraint;
    validityWindow?: ValidityWindow;
    rollingSpend?: RollingSpendLimit;
  } = {
    chainId: assertSafePositiveInteger(record.chainId, `${field}.chainId`),
    asset,
    recipient: normalizeAddress(record.recipient, `${field}.recipient`),
    maxValueWei: normalizeDecimalQuantity(
      record.maxValueWei,
      `${field}.maxValueWei`,
    ),
  };

  if (record.calldata !== undefined) {
    normalized.calldata = normalizeCalldata(record.calldata);
  }
  if (record.validityWindow !== undefined) {
    normalized.validityWindow = normalizeValidityWindow(record.validityWindow);
  }
  if (record.rollingSpend !== undefined) {
    normalized.rollingSpend = normalizeRollingSpend(record.rollingSpend);
  }

  return normalized;
}

function normalizeRules(value: unknown): readonly CompanyAuthorityRule[] {
  if (!Array.isArray(value)) {
    throw new TypeError("authority.rules must be an array");
  }

  const unique = new Map<string, CompanyAuthorityRule>();
  for (const [index, rule] of value.entries()) {
    const normalized = normalizeRule(rule, index);
    unique.set(canonicalJson(normalized), normalized);
  }

  return [...unique.entries()]
    .sort(([first], [second]) => (first < second ? -1 : first > second ? 1 : 0))
    .map(([, rule]) => freezeDeep(rule));
}

function normalizeFinalTerms(value: unknown): CompanyAuthorityTerms {
  const record = assertPlainRecord(value, "companyTerms");
  assertExactKeys(record, ["schema", "version", "authority"], "companyTerms");
  assertRequiredKeys(
    record,
    ["schema", "version", "authority"],
    "companyTerms",
  );
  if (
    record.schema !== "kanon.company-authority-terms" ||
    record.version !== 2
  ) {
    throw new TypeError("companyTerms must be final Kanon authority terms");
  }

  const authority = assertPlainRecord(
    record.authority,
    "companyTerms.authority",
  );
  assertExactKeys(authority, ["rules"], "companyTerms.authority");
  assertRequiredKeys(authority, ["rules"], "companyTerms.authority");
  const rules = normalizeRules(authority.rules);
  return freezeDeep({
    schema: "kanon.company-authority-terms" as const,
    version: 2 as const,
    authority: { rules },
  });
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) {
      freezeDeep(child);
    }
    Object.freeze(value);
  }

  return value;
}

function canonicalJson(value: unknown): string {
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
  if (isPlainRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }

  throw new TypeError("permission hash input must contain only JSON values");
}

function hashCanonical(value: string): PermissionHash {
  const hash = `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
  if (!PERMISSION_HASH_PATTERN.test(hash)) {
    throw new Error("permission hash generation failed");
  }
  return hash as PermissionHash;
}

export function createCompanyAuthorityTerms(
  input: CompanyAuthorityTermsInput,
): CompanyAuthorityTerms {
  const record = assertPlainRecord(input, "companyTerms input");
  assertExactKeys(record, ["rules"], "companyTerms input");
  assertRequiredKeys(record, ["rules"], "companyTerms input");

  return freezeDeep({
    schema: "kanon.company-authority-terms" as const,
    version: 2 as const,
    authority: { rules: normalizeRules(record.rules) },
  });
}

export function serializeCompanyAuthorityTerms(
  terms: CompanyAuthorityTerms,
): string {
  return canonicalJson(normalizeFinalTerms(terms));
}

export function hashCompanyAuthorityTerms(
  terms: CompanyAuthorityTerms,
): PermissionHash {
  return hashCanonical(serializeCompanyAuthorityTerms(terms));
}

export function createNormalizedPermissionSet(input: {
  readonly release: AgentRelease;
  readonly companyTerms: CompanyAuthorityTerms;
}): NormalizedPermissionSet {
  assertValidAgentRelease(input.release);
  const companyTerms = normalizeFinalTerms(input.companyTerms);

  return freezeDeep({
    schema: "kanon.normalized-permission-set" as const,
    version: 2 as const,
    source: {
      agentId: input.release.agentId,
      releaseId: input.release.releaseId,
      manifestHash: input.release.manifestHash,
    },
    companyTerms,
    permissionHash: hashCompanyAuthorityTerms(companyTerms),
  });
}

export type PermissionChangeClassification =
  | "NO_CHANGE"
  | "NARROWER"
  | "EXPANDED"
  | "SUBSTITUTED"
  | "UNKNOWN";

export interface PermissionDiff {
  readonly classification: PermissionChangeClassification;
  readonly requiresHumanReview: boolean;
  readonly previousPermissionHash: string;
  readonly nextPermissionHash: string;
  readonly changedPaths: readonly string[];
  readonly reason?: string;
}

interface ValidatedPermissionSet {
  readonly terms: CompanyAuthorityTerms;
  readonly permissionHash: PermissionHash;
}

function stableIdentifier(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value
  ) {
    throw new TypeError(`${field} must be a non-blank stable identifier`);
  }

  if (/\s/.test(value)) {
    throw new TypeError(`${field} must not contain whitespace`);
  }

  return value;
}

function validateNormalizedPermissionSet(
  value: unknown,
  field: string,
): ValidatedPermissionSet {
  const record = assertPlainRecord(value, field);
  assertExactKeys(
    record,
    ["schema", "version", "source", "companyTerms", "permissionHash"],
    field,
  );
  assertRequiredKeys(
    record,
    ["schema", "version", "source", "companyTerms", "permissionHash"],
    field,
  );
  if (
    record.schema !== "kanon.normalized-permission-set" ||
    record.version !== 2
  ) {
    throw new TypeError(`${field} must be a final normalized permission set`);
  }

  const source = assertPlainRecord(record.source, `${field}.source`);
  assertExactKeys(
    source,
    ["agentId", "releaseId", "manifestHash"],
    `${field}.source`,
  );
  assertRequiredKeys(
    source,
    ["agentId", "releaseId", "manifestHash"],
    `${field}.source`,
  );
  stableIdentifier(source.agentId, `${field}.source.agentId`);
  stableIdentifier(source.releaseId, `${field}.source.releaseId`);
  if (
    typeof source.manifestHash !== "string" ||
    !CONTENT_HASH_PATTERN.test(source.manifestHash)
  ) {
    throw new TypeError(`${field}.source.manifestHash must be a sha256 hash`);
  }
  if (
    typeof record.permissionHash !== "string" ||
    !PERMISSION_HASH_PATTERN.test(record.permissionHash)
  ) {
    throw new TypeError(`${field}.permissionHash must be a permission hash`);
  }

  const terms = normalizeFinalTerms(record.companyTerms);
  const computedPermissionHash = hashCompanyAuthorityTerms(terms);
  if (computedPermissionHash !== record.permissionHash) {
    throw new TypeError(`${field}.permissionHash does not match companyTerms`);
  }

  return {
    terms,
    permissionHash: computedPermissionHash,
  };
}

export function assertValidNormalizedPermissionSet(
  value: unknown,
): asserts value is NormalizedPermissionSet {
  validateNormalizedPermissionSet(value, "permissionSet");
}

function quantity(value: DecimalQuantity): bigint {
  return BigInt(value);
}

function sameValue<T>(first: T, second: T): boolean {
  if (first === undefined || second === undefined) {
    return first === second;
  }
  return canonicalJson(first) === canonicalJson(second);
}

function calldataIsSubset(
  candidate: CalldataConstraint | undefined,
  baseline: CalldataConstraint | undefined,
): boolean {
  if (baseline === undefined) {
    return true;
  }
  if (candidate === undefined) {
    return false;
  }
  if (!sameValue(candidate.function, baseline.function)) {
    return false;
  }

  for (const [name, value] of Object.entries(baseline.exactArguments)) {
    if (candidate.exactArguments[name] !== value) {
      return false;
    }
  }

  return true;
}

function validityIsSubset(
  candidate: ValidityWindow | undefined,
  baseline: ValidityWindow | undefined,
): boolean {
  const candidateStart = candidate?.notBeforeUnix ?? Number.NEGATIVE_INFINITY;
  const candidateEnd = candidate?.notAfterUnix ?? Number.POSITIVE_INFINITY;
  const baselineStart = baseline?.notBeforeUnix ?? Number.NEGATIVE_INFINITY;
  const baselineEnd = baseline?.notAfterUnix ?? Number.POSITIVE_INFINITY;
  return candidateStart >= baselineStart && candidateEnd <= baselineEnd;
}

function rollingSpendIsSubset(
  candidate: RollingSpendLimit | undefined,
  baseline: RollingSpendLimit | undefined,
): boolean {
  if (baseline === undefined) {
    return true;
  }
  if (candidate === undefined) {
    return false;
  }

  return (
    quantity(candidate.maxValueWei) <= quantity(baseline.maxValueWei) &&
    candidate.windowSeconds >= baseline.windowSeconds
  );
}

function ruleIsSubset(
  candidate: CompanyAuthorityRule,
  baseline: CompanyAuthorityRule,
): boolean {
  return (
    candidate.chainId === baseline.chainId &&
    candidate.asset === baseline.asset &&
    candidate.recipient === baseline.recipient &&
    quantity(candidate.maxValueWei) <= quantity(baseline.maxValueWei) &&
    calldataIsSubset(candidate.calldata, baseline.calldata) &&
    validityIsSubset(candidate.validityWindow, baseline.validityWindow) &&
    rollingSpendIsSubset(candidate.rollingSpend, baseline.rollingSpend)
  );
}

function authorityIsSubset(
  candidate: CompanyAuthorityTerms,
  baseline: CompanyAuthorityTerms,
): boolean {
  return candidate.authority.rules.every((candidateRule) =>
    baseline.authority.rules.some((baselineRule) =>
      ruleIsSubset(candidateRule, baselineRule),
    ),
  );
}

function ruleLimitsEqual(
  first: CompanyAuthorityRule,
  second: CompanyAuthorityRule,
): boolean {
  return (
    first.asset === second.asset &&
    first.maxValueWei === second.maxValueWei &&
    sameValue(first.rollingSpend, second.rollingSpend)
  );
}

function ruleScopeEqual(
  first: CompanyAuthorityRule,
  second: CompanyAuthorityRule,
): boolean {
  return (
    first.chainId === second.chainId &&
    first.recipient === second.recipient &&
    sameValue(first.calldata, second.calldata) &&
    sameValue(first.validityWindow, second.validityWindow)
  );
}

function isSubstitution(
  previous: CompanyAuthorityTerms,
  next: CompanyAuthorityTerms,
): boolean {
  if (
    previous.authority.rules.length !== next.authority.rules.length ||
    previous.authority.rules.length === 0
  ) {
    return false;
  }

  const remaining = [...previous.authority.rules];
  let changed = false;
  for (const nextRule of next.authority.rules) {
    const matchIndex = remaining.findIndex((previousRule) =>
      ruleLimitsEqual(previousRule, nextRule),
    );
    if (matchIndex < 0) {
      return false;
    }
    const [previousRule] = remaining.splice(matchIndex, 1);
    if (!ruleScopeEqual(previousRule, nextRule)) {
      changed = true;
    }
  }

  return changed && remaining.length === 0;
}

function changedPaths(
  before: unknown,
  after: unknown,
  path: string,
  output: string[],
): void {
  if (sameValue(before, after)) {
    return;
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      changedPaths(before[index], after[index], `${path}[${index}]`, output);
    }
    return;
  }
  if (isPlainRecord(before) && isPlainRecord(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of [...keys].sort()) {
      changedPaths(before[key], after[key], `${path}.${key}`, output);
    }
    return;
  }

  output.push(path);
}

function unknownDiff(
  previous: NormalizedPermissionSet,
  next: NormalizedPermissionSet,
  reason: string,
): PermissionDiff {
  return {
    classification: "UNKNOWN",
    requiresHumanReview: true,
    previousPermissionHash:
      typeof previous?.permissionHash === "string"
        ? previous.permissionHash
        : "",
    nextPermissionHash:
      typeof next?.permissionHash === "string" ? next.permissionHash : "",
    changedPaths: ["permissionSet"],
    reason,
  };
}

export function diffPermissionSets(
  previous: NormalizedPermissionSet,
  next: NormalizedPermissionSet,
): PermissionDiff {
  let previousValidated: ValidatedPermissionSet;
  let nextValidated: ValidatedPermissionSet;
  try {
    previousValidated = validateNormalizedPermissionSet(
      previous,
      "previousPermissionSet",
    );
    nextValidated = validateNormalizedPermissionSet(next, "nextPermissionSet");
  } catch (error) {
    return unknownDiff(
      previous,
      next,
      error instanceof Error
        ? error.message
        : "permission set validation failed",
    );
  }

  const changedPathList: string[] = [];
  changedPaths(
    previousValidated.terms,
    nextValidated.terms,
    "companyTerms",
    changedPathList,
  );

  if (sameValue(previousValidated.terms, nextValidated.terms)) {
    return {
      classification: "NO_CHANGE",
      requiresHumanReview: false,
      previousPermissionHash: previousValidated.permissionHash,
      nextPermissionHash: nextValidated.permissionHash,
      changedPaths: [],
    };
  }

  const nextIsSubset = authorityIsSubset(
    nextValidated.terms,
    previousValidated.terms,
  );
  const previousIsSubset = authorityIsSubset(
    previousValidated.terms,
    nextValidated.terms,
  );

  let classification: PermissionChangeClassification;
  let reason: string | undefined;
  if (nextIsSubset && !previousIsSubset) {
    classification = "NARROWER";
  } else if (previousIsSubset && !nextIsSubset) {
    classification = "EXPANDED";
  } else if (
    !nextIsSubset &&
    !previousIsSubset &&
    isSubstitution(previousValidated.terms, nextValidated.terms)
  ) {
    classification = "SUBSTITUTED";
  } else {
    classification = "UNKNOWN";
    reason =
      "could not prove a monotonic or one-to-one substitution relationship";
  }

  return {
    classification,
    requiresHumanReview:
      classification === "EXPANDED" ||
      classification === "SUBSTITUTED" ||
      classification === "UNKNOWN",
    previousPermissionHash: previousValidated.permissionHash,
    nextPermissionHash: nextValidated.permissionHash,
    changedPaths: changedPathList,
    ...(reason === undefined ? {} : { reason }),
  };
}
