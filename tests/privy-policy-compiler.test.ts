import {
  compilePrivyPolicy,
  UnsupportedPolicyCombinationError,
  type PrivyPolicyCompilerInput,
} from "../packages/privy/src/policy-compiler.js";
import {
  createCompanyAuthorityTerms,
  createNormalizedPermissionSet,
  UnsupportedAuthorityError,
} from "../packages/permissions/src/index.js";
import { createAgentRelease } from "../packages/manifest/src/index.js";
import { describe, expect, it } from "vitest";

const RECIPIENT = "0x8B88E1E1174eDC65B08de75A5439f130da8A3DFd";

function permissionSet(input: {
  readonly rollingSpend?: {
    readonly maxValueWei: string;
    readonly windowSeconds: number;
  };
  readonly calldata?: {
    readonly function: {
      readonly name: string;
      readonly inputs: readonly [
        { readonly name: "nonce"; readonly type: "uint256" },
      ];
    };
    readonly exactArguments: Readonly<Record<string, string>>;
  };
}) {
  const release = createAgentRelease({
    agentId: "com.example.treasury",
    releaseId: "release-a",
    version: "1.0.0",
    packageContent: "package",
    runtime: { entry: "worker" },
    capabilities: { chains: [11155111], assets: ["native"] },
  });
  return createNormalizedPermissionSet({
    release,
    companyTerms: createCompanyAuthorityTerms({
      rules: [
        {
          chainId: 11155111,
          asset: "native",
          recipient: RECIPIENT,
          maxValueWei: "1",
          ...(input.calldata === undefined ? {} : { calldata: input.calldata }),
          ...(input.rollingSpend === undefined
            ? {}
            : { rollingSpend: input.rollingSpend }),
        },
      ],
    }),
  });
}

function compilerInput(
  input: Parameters<typeof permissionSet>[0] = {},
): PrivyPolicyCompilerInput {
  return {
    permissionSet: permissionSet(input),
    ownerId: "owner-quorum-id",
    policyName: "Kanon authority policy",
    executionMethod: "eth_sendTransaction",
  };
}

describe("Privy policy compiler", () => {
  it("emits exact stateless conditions for eth_sendTransaction", () => {
    const plan = compilePrivyPolicy(
      compilerInput({
        calldata: {
          function: {
            name: "ping",
            inputs: [{ name: "nonce", type: "uint256" }],
          },
          exactArguments: { nonce: "7" },
        },
      }),
    );

    expect(plan.permissionHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(plan.executionMethod).toBe("eth_sendTransaction");
    expect(plan.policy).toMatchObject({
      chain_type: "ethereum",
      owner_id: "owner-quorum-id",
    });
    expect(plan.policy.rules.map((rule) => rule.method)).toEqual([
      "eth_sendTransaction",
    ]);
    expect(plan.aggregationRequirements).toEqual([]);
    expect(plan.policy.rules[0]?.conditions).toEqual([
      {
        field_source: "ethereum_transaction",
        field: "chain_id",
        operator: "eq",
        value: "11155111",
      },
      {
        field_source: "ethereum_transaction",
        field: "to",
        operator: "eq",
        value: RECIPIENT.toLowerCase(),
      },
      {
        field_source: "ethereum_transaction",
        field: "value",
        operator: "lte",
        value: "0x1",
      },
      {
        field_source: "ethereum_calldata",
        field: "function_name",
        operator: "eq",
        value: "ping",
        abi: [
          {
            type: "function",
            name: "ping",
            inputs: [{ name: "nonce", type: "uint256" }],
          },
        ],
      },
      {
        field_source: "ethereum_calldata",
        field: "ping.nonce",
        operator: "eq",
        value: "7",
        abi: [
          {
            type: "function",
            name: "ping",
            inputs: [{ name: "nonce", type: "uint256" }],
          },
        ],
      },
    ]);
  });

  it("keeps timing conditions inclusive", () => {
    const terms = createCompanyAuthorityTerms({
      rules: [
        {
          chainId: 11155111,
          asset: "native",
          recipient: RECIPIENT,
          maxValueWei: "1",
          validityWindow: { notBeforeUnix: 100, notAfterUnix: 200 },
        },
      ],
    });
    const release = createAgentRelease({
      agentId: "com.example.treasury",
      releaseId: "release-a",
      version: "1.0.0",
      packageContent: "package",
      runtime: { entry: "worker" },
      capabilities: { chains: [11155111], assets: ["native"] },
    });
    const plan = compilePrivyPolicy({
      permissionSet: createNormalizedPermissionSet({
        release,
        companyTerms: terms,
      }),
      ownerId: "owner-quorum-id",
      policyName: "Kanon authority policy",
      executionMethod: "eth_sendTransaction",
    });

    expect(plan.policy.rules[0]?.conditions.slice(-2)).toEqual([
      {
        field_source: "system",
        field: "current_unix_timestamp",
        operator: "gte",
        value: "100",
      },
      {
        field_source: "system",
        field: "current_unix_timestamp",
        operator: "lte",
        value: "200",
      },
    ]);
  });

  it("keeps signer policy attachment separate from owner control", () => {
    const plan = compilePrivyPolicy(compilerInput());

    expect(plan.buildSignerOverride("agent-signer-id", "policy-id")).toEqual({
      signer_id: "agent-signer-id",
      override_policy_ids: ["policy-id"],
    });
    expect(plan.policy).not.toHaveProperty("additional_signers");
  });

  it("compiles rolling limits on eth_signTransaction with a referenced aggregation", () => {
    const plan = compilePrivyPolicy({
      ...compilerInput({
        rollingSpend: { maxValueWei: "1", windowSeconds: 3600 },
      }),
      executionMethod: "eth_signTransaction",
      aggregationIdsByRule: { "rule-1": "aggregation-id" },
    });

    expect(plan.executionMethod).toBe("eth_signTransaction");
    expect(plan.policy.rules.map((rule) => rule.method)).toEqual([
      "eth_signTransaction",
    ]);
    expect(plan.policy.rules[0]?.conditions.at(-1)).toEqual({
      field_source: "reference",
      field: "aggregation.aggregation-id",
      operator: "lte",
      value: "0x1",
    });
    expect(plan.aggregationRequirements).toMatchObject([
      {
        key: "rule-1",
        input: {
          method: "eth_signTransaction",
          owner_id: "owner-quorum-id",
          metric: {
            field: "value",
            field_source: "ethereum_transaction",
            function: "sum",
          },
          window: { type: "rolling", seconds: 3600 },
        },
      },
    ]);
  });

  it("rejects rolling limits for eth_sendTransaction", () => {
    expect(() =>
      compilePrivyPolicy(
        compilerInput({
          rollingSpend: { maxValueWei: "1", windowSeconds: 3600 },
        }),
      ),
    ).toThrow(UnsupportedPolicyCombinationError);
  });

  it("rejects stateful signing without an aggregation instead of dropping the limit", () => {
    expect(() =>
      compilePrivyPolicy({
        ...compilerInput({
          rollingSpend: { maxValueWei: "1", windowSeconds: 3600 },
        }),
        executionMethod: "eth_signTransaction",
      }),
    ).toThrow(UnsupportedPolicyCombinationError);
  });

  it("rejects forged permission sets before compiling", () => {
    const input = compilerInput();
    const forged = {
      ...input.permissionSet,
      permissionHash: ("sha256:" +
        "0".repeat(64)) as typeof input.permissionSet.permissionHash,
    };

    expect(() =>
      compilePrivyPolicy({ ...input, permissionSet: forged }),
    ).toThrow(/permissionHash does not match/);
  });

  it("rejects ambiguous ABI types", () => {
    expect(() =>
      compilePrivyPolicy(
        compilerInput({
          calldata: {
            function: {
              name: "setData",
              inputs: [{ name: "payload", type: "tuple" }],
            },
            exactArguments: {},
          },
        } as never),
      ),
    ).toThrow(UnsupportedAuthorityError);
  });
});
