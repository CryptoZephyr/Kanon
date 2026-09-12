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
const PERMISSION_HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;

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
