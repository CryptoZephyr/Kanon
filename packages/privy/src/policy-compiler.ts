import type {
  AbiSchema,
  AggregationInput,
  PolicyCondition,
  PolicyCreateParams,
} from "@privy-io/node/resources";
import {
  assertValidNormalizedPermissionSet,
  type CompanyAuthorityRule,
  type NormalizedPermissionSet,
  type PermissionHash,
  UnsupportedAuthorityError,
} from "../../permissions/src/index.js";

export interface PrivyPolicyCompilerInput {
  readonly permissionSet: NormalizedPermissionSet;
  readonly ownerId: string;
  readonly policyName: string;
  readonly executionMethod: PrivyExecutionMethod;
  readonly aggregationIdsByRule?: Readonly<Record<string, string>>;
}

export type PrivyExecutionMethod =
  | "eth_signTransaction"
  | "eth_sendTransaction";

export interface PrivySignerOverride {
  readonly signer_id: string;
  readonly override_policy_ids: readonly [string];
}

export interface PrivyPolicyPlan {
  readonly permissionHash: PermissionHash;
  readonly executionMethod: PrivyExecutionMethod;
  readonly policy: PolicyCreateParams;
  readonly aggregationRequirements: readonly PrivyAggregationRequirement[];
  readonly buildSignerOverride: (
    agentSignerId: string,
    policyId: string,
  ) => PrivySignerOverride;
}

export interface PrivyAggregationRequirement {
  readonly key: string;
  readonly input: AggregationInput;
}

export class UnsupportedPolicyCombinationError extends TypeError {
  public readonly code = "UNSUPPORTED_POLICY_COMBINATION" as const;

  public constructor(message: string) {
    super(message);
    this.name = "UnsupportedPolicyCombinationError";
  }
}

const SUPPORTED_PRIMITIVE_TYPES = new Set([
  "address",
  "bool",
  "bytes",
  "string",
  "uint256",
]);

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

function assertPolicyName(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 50 ||
    value.trim() !== value
  ) {
    throw new TypeError("policyName must be a 1-50 character label");
  }

  return value;
}

function assertExecutionMethod(
  value: unknown,
): asserts value is PrivyExecutionMethod {
  if (value !== "eth_signTransaction" && value !== "eth_sendTransaction") {
    throw new TypeError(
      "executionMethod must be eth_signTransaction or eth_sendTransaction",
    );
  }
}

function toHexQuantity(value: string): string {
  return `0x${BigInt(value).toString(16)}`;
}

function assertSupportedAbi(rule: CompanyAuthorityRule): void {
  const calldata = rule.calldata;
  if (calldata === undefined) return;

  for (const input of calldata.function.inputs) {
    if (!SUPPORTED_PRIMITIVE_TYPES.has(input.type)) {
      throw new UnsupportedAuthorityError(
        `calldata input type ${input.type} is not proven by the Privy compiler surface`,
      );
    }
  }

  for (const [name, value] of Object.entries(calldata.exactArguments)) {
    const input = calldata.function.inputs.find(
      (candidate) => candidate.name === name,
    );
    if (!input) {
      throw new UnsupportedAuthorityError(
        `calldata argument ${name} is not present in the ABI`,
      );
    }

    if (input.type === "uint256" && !/^\d+$/.test(value)) {
      throw new UnsupportedAuthorityError(
        `calldata argument ${name} must be a decimal uint256 value`,
      );
    }
  }
}

function calldataAbi(rule: CompanyAuthorityRule): AbiSchema | undefined {
  const calldata = rule.calldata;
  if (calldata === undefined) return undefined;

  return [
    {
      type: "function",
      name: calldata.function.name,
      inputs: calldata.function.inputs.map((input) => ({
        name: input.name,
        type: input.type,
      })),
    },
  ];
}

function baseConditions(rule: CompanyAuthorityRule): PolicyCondition[] {
  const conditions: PolicyCondition[] = [
    {
      field_source: "ethereum_transaction",
      field: "chain_id",
      operator: "eq",
      value: String(rule.chainId),
    },
    {
      field_source: "ethereum_transaction",
      field: "to",
      operator: "eq",
      value: rule.recipient,
    },
    {
      field_source: "ethereum_transaction",
      field: "value",
      operator: "lte",
      value: toHexQuantity(rule.maxValueWei),
    },
  ];

  if (rule.calldata !== undefined) {
    const abi = calldataAbi(rule);
    if (abi === undefined) {
      throw new Error("calldata ABI was not generated");
    }

    conditions.push({
      field_source: "ethereum_calldata",
      field: "function_name",
      operator: "eq",
      value: rule.calldata.function.name,
      abi,
    });

    for (const input of rule.calldata.function.inputs) {
      const value = rule.calldata.exactArguments[input.name];
      if (value === undefined) continue;

      conditions.push({
        field_source: "ethereum_calldata",
        field: `${rule.calldata.function.name}.${input.name}`,
        operator: "eq",
        value,
        abi,
      });
    }
  }

  if (rule.validityWindow?.notBeforeUnix !== undefined) {
    conditions.push({
      field_source: "system",
      field: "current_unix_timestamp",
      operator: "gte",
      value: String(rule.validityWindow.notBeforeUnix),
    });
  }
  if (rule.validityWindow?.notAfterUnix !== undefined) {
    conditions.push({
      field_source: "system",
      field: "current_unix_timestamp",
      operator: "lte",
      value: String(rule.validityWindow.notAfterUnix),
    });
  }

  return conditions;
}

function aggregationKey(index: number): string {
  return `rule-${index + 1}`;
}

function aggregationRequirement(
  rule: CompanyAuthorityRule,
  index: number,
  ownerId: string,
  policyName: string,
): PrivyAggregationRequirement {
  if (rule.rollingSpend === undefined) {
    throw new Error("aggregation requirement needs a rolling spend limit");
  }

  return {
    key: aggregationKey(index),
    input: {
      name: `${policyName} rolling spend ${index + 1}`,
      method: "eth_signTransaction",
      owner_id: ownerId,
      metric: {
        field: "value",
        field_source: "ethereum_transaction",
        function: "sum",
      },
      window: {
        type: "rolling",
        seconds: rule.rollingSpend.windowSeconds,
      },
      conditions: [
        {
          field_source: "ethereum_transaction",
          field: "chain_id",
          operator: "eq",
          value: String(rule.chainId),
        },
        {
          field_source: "ethereum_transaction",
          field: "to",
          operator: "eq",
          value: rule.recipient,
        },
      ],
    },
  };
}

function statefulCondition(
  rule: CompanyAuthorityRule,
  aggregationId: string,
): PolicyCondition {
  if (rule.rollingSpend === undefined) {
    throw new Error("stateful condition needs a rolling spend limit");
  }

  return {
    field_source: "reference",
    field: `aggregation.${aggregationId}`,
    operator: "lte",
    value: toHexQuantity(rule.rollingSpend.maxValueWei),
  };
}

function buildPolicyRule(
  rule: CompanyAuthorityRule,
  index: number,
  method: PrivyExecutionMethod,
  aggregationId: string | undefined,
): PolicyCreateParams.Rule {
  assertSupportedAbi(rule);

  if (rule.rollingSpend !== undefined && method === "eth_sendTransaction") {
    throw new UnsupportedPolicyCombinationError(
      `company authority rule ${index + 1} requests rollingSpend, but ${method} cannot enforce Privy aggregation references`,
    );
  }
  if (rule.rollingSpend !== undefined && aggregationId === undefined) {
    throw new UnsupportedPolicyCombinationError(
      `company authority rule ${index + 1} requests rollingSpend, but no Privy aggregation ID was supplied for ${method}`,
    );
  }

  const conditions = baseConditions(rule);
  if (rule.rollingSpend !== undefined && aggregationId !== undefined) {
    conditions.push(statefulCondition(rule, aggregationId));
  }

  return {
    name: `Kanon authority rule ${index + 1} ${method}`,
    method,
    action: "ALLOW",
    conditions,
  };
}

function buildSignerOverride(
  agentSignerId: string,
  policyId: string,
): PrivySignerOverride {
  return {
    signer_id: assertNonBlank(agentSignerId, "agentSignerId"),
    override_policy_ids: [assertNonBlank(policyId, "policyId")],
  };
}

export function buildPrivyAggregationRequirements(
  input: PrivyPolicyCompilerInput,
): readonly PrivyAggregationRequirement[] {
  assertValidNormalizedPermissionSet(input.permissionSet);
  const ownerId = assertNonBlank(input.ownerId, "ownerId");
  const policyName = assertPolicyName(input.policyName);
  assertExecutionMethod(input.executionMethod);
  const rules = input.permissionSet.companyTerms.authority.rules;

  if (
    input.executionMethod === "eth_sendTransaction" &&
    rules.some((rule) => rule.rollingSpend !== undefined)
  ) {
    const index = rules.findIndex((rule) => rule.rollingSpend !== undefined);
    throw new UnsupportedPolicyCombinationError(
      `company authority rule ${index + 1} requests rollingSpend, but ${input.executionMethod} cannot enforce Privy aggregation references`,
    );
  }

  return rules.flatMap((rule, index) =>
    rule.rollingSpend === undefined
      ? []
      : [aggregationRequirement(rule, index, ownerId, policyName)],
  );
}

export function compilePrivyPolicy(
  input: PrivyPolicyCompilerInput,
): PrivyPolicyPlan {
  assertValidNormalizedPermissionSet(input.permissionSet);
  const ownerId = assertNonBlank(input.ownerId, "ownerId");
  const policyName = assertPolicyName(input.policyName);
  assertExecutionMethod(input.executionMethod);
  const rules = input.permissionSet.companyTerms.authority.rules;

  if (rules.length === 0) {
    throw new UnsupportedAuthorityError(
      "an empty company authority set cannot produce an executable policy",
    );
  }

  const rollingRuleKeys = new Set(
    rules.flatMap((rule, index) =>
      rule.rollingSpend === undefined ? [] : [aggregationKey(index)],
    ),
  );
  const aggregationIds = input.aggregationIdsByRule ?? {};
  for (const key of Object.keys(aggregationIds)) {
    if (!rollingRuleKeys.has(key)) {
      throw new UnsupportedPolicyCombinationError(
        `aggregation ID ${key} does not correspond to a rolling authority rule`,
      );
    }
  }

  const aggregationRequirements = buildPrivyAggregationRequirements(input);
  const policyRules = rules.map((rule, index) =>
    buildPolicyRule(
      rule,
      index,
      input.executionMethod,
      rule.rollingSpend === undefined
        ? undefined
        : aggregationIds[aggregationKey(index)],
    ),
  );

  return {
    permissionHash: input.permissionSet.permissionHash,
    executionMethod: input.executionMethod,
    policy: {
      version: "1.0",
      name: policyName,
      chain_type: "ethereum",
      owner_id: ownerId,
      rules: policyRules,
    },
    aggregationRequirements,
    buildSignerOverride,
  };
}
