import { describe, expect, it } from "vitest";
import {
  assertDemoRouteAllowed,
  assertDemoTermsWithinEnvelope,
  createDemoRateLimiter,
  DemoGuardError,
  executionRequestForScenario,
  resolveRole,
} from "../apps/api/src/demo-guard.js";
import {
  fixturePermissionSet,
  fixtureRelease,
  FIXTURE_RECIPIENT,
} from "./support/installation-fixture.js";

const CONTROL_WALLET = "0x8b88E1E1174eDC65B08de75A5439f130da8A3DFd";
const FORBIDDEN_RECIPIENT = "0x2222222222222222222222222222222222222222";

describe("resolveRole", () => {
  const tokens = { companyToken: "company-secret", demoToken: "demo-secret" };

  it("resolves the operator role for the company token", () => {
    expect(
      resolveRole({ "x-kanon-company-token": "company-secret" }, tokens),
    ).toBe("operator");
  });

  it("resolves the demo role for the demo token", () => {
    expect(resolveRole({ "x-kanon-demo-token": "demo-secret" }, tokens)).toBe(
      "demo",
    );
  });

  it("returns undefined for missing or wrong credentials", () => {
    expect(resolveRole({}, tokens)).toBeUndefined();
    expect(
      resolveRole({ "x-kanon-company-token": "nope" }, tokens),
    ).toBeUndefined();
    expect(
      resolveRole({ "x-kanon-demo-token": "nope" }, tokens),
    ).toBeUndefined();
  });

  it("returns undefined for a wrong-length token", () => {
    expect(
      resolveRole({ "x-kanon-company-token": "x" }, tokens),
    ).toBeUndefined();
    expect(
      resolveRole({ "x-kanon-company-token": "company-secret-extra" }, tokens),
    ).toBeUndefined();
  });

  it("does not resolve the demo role when the demo token is unset", () => {
    expect(
      resolveRole(
        { "x-kanon-demo-token": "demo-secret" },
        { companyToken: "company-secret" },
      ),
    ).toBeUndefined();
  });
});

describe("assertDemoRouteAllowed", () => {
  it("allows demo read routes", () => {
    expect(() => assertDemoRouteAllowed("GET", "/v1/status")).not.toThrow();
    expect(() =>
      assertDemoRouteAllowed("GET", "/v1/proof/latest"),
    ).not.toThrow();
    expect(() =>
      assertDemoRouteAllowed("GET", "/v1/proof/runs/run-1"),
    ).not.toThrow();
    expect(() =>
      assertDemoRouteAllowed("GET", "/v1/organizations/organization-kanon"),
    ).not.toThrow();
    expect(() =>
      assertDemoRouteAllowed(
        "GET",
        "/v1/organizations/organization-kanon/wallet",
      ),
    ).not.toThrow();
    expect(() =>
      assertDemoRouteAllowed(
        "GET",
        "/v1/organizations/organization-kanon/agents/com.example.treasury",
      ),
    ).not.toThrow();
    expect(() =>
      assertDemoRouteAllowed(
        "GET",
        "/v1/organizations/organization-kanon/installations",
      ),
    ).not.toThrow();
    expect(() =>
      assertDemoRouteAllowed(
        "GET",
        "/v1/organizations/organization-kanon/installations/installation-1",
      ),
    ).not.toThrow();
    expect(() =>
      assertDemoRouteAllowed(
        "GET",
        "/v1/organizations/organization-kanon/installations/installation-1/update-diff",
      ),
    ).not.toThrow();
    expect(() =>
      assertDemoRouteAllowed(
        "GET",
        "/v1/organizations/organization-kanon/installations/installation-1/evidence",
      ),
    ).not.toThrow();
  });

  it("allows demo mutation routes", () => {
    for (const path of [
      "/v1/organizations/organization-kanon/agents/com.example.treasury/releases",
      "/v1/organizations/organization-kanon/installations/installation-1/company-terms",
      "/v1/organizations/organization-kanon/installations/installation-1/approval",
      "/v1/organizations/organization-kanon/installations/installation-1/executions",
      "/v1/organizations/organization-kanon/installations/installation-1/revoke",
      "/v1/organizations/organization-kanon/installations/installation-1/reject-update",
    ]) {
      expect(() => assertDemoRouteAllowed("POST", path)).not.toThrow();
    }
  });

  it("denies the proof run for the demo role", () => {
    try {
      assertDemoRouteAllowed("POST", "/v1/proof/run");
      expect.unreachable("proof run must be denied");
    } catch (error) {
      expect(error).toBeInstanceOf(DemoGuardError);
      expect((error as DemoGuardError).status).toBe(403);
      expect((error as DemoGuardError).code).toBe("FORBIDDEN");
    }
  });

  it("denies unknown POST routes", () => {
    expect(() =>
      assertDemoRouteAllowed(
        "POST",
        "/v1/organizations/organization-kanon/installations/installation-1/admin",
      ),
    ).toThrow(DemoGuardError);
    expect(() =>
      assertDemoRouteAllowed("POST", "/v1/organizations/organization-kanon"),
    ).toThrow(DemoGuardError);
  });

  it("denies routes outside the allowlist", () => {
    expect(() => assertDemoRouteAllowed("GET", "/v1/proof/run")).toThrow(
      DemoGuardError,
    );
    expect(() => assertDemoRouteAllowed("DELETE", "/v1/status")).toThrow(
      DemoGuardError,
    );
    expect(() => assertDemoRouteAllowed("GET", "/internal/execute")).toThrow(
      DemoGuardError,
    );
  });
});

describe("assertDemoTermsWithinEnvelope", () => {
  const valid = {
    rules: [
      {
        chainId: 11155111,
        asset: "native",
        recipient: CONTROL_WALLET,
        maxValueWei: "1",
        rollingSpend: { maxValueWei: "1", windowSeconds: 3600 },
      },
    ],
  };

  function expectOutOfBounds(input: unknown, field: string): void {
    try {
      assertDemoTermsWithinEnvelope(input as never, {
        controlWallet: CONTROL_WALLET,
      });
      expect.unreachable("terms outside the envelope must be rejected");
    } catch (error) {
      expect(error).toBeInstanceOf(DemoGuardError);
      expect((error as DemoGuardError).status).toBe(422);
      expect((error as DemoGuardError).code).toBe("DEMO_TERMS_OUT_OF_BOUNDS");
      expect((error as DemoGuardError).message).toContain(field);
    }
  }

  it("accepts the exact demo envelope", () => {
    expect(() =>
      assertDemoTermsWithinEnvelope(valid as never, {
        controlWallet: CONTROL_WALLET,
      }),
    ).not.toThrow();
  });

  it("rejects a recipient other than the control wallet", () => {
    expectOutOfBounds(
      {
        rules: [
          {
            ...valid.rules[0],
            recipient: FORBIDDEN_RECIPIENT,
          },
        ],
      },
      "recipient",
    );
  });

  it("rejects a per-action value above the ceiling", () => {
    expectOutOfBounds(
      {
        rules: [{ ...valid.rules[0], maxValueWei: "1001" }],
      },
      "maxValueWei",
    );
  });

  it("rejects missing rolling spend", () => {
    const { rollingSpend: _omitted, ...rule } = valid.rules[0];
    void _omitted;
    expectOutOfBounds({ rules: [rule] }, "rollingSpend");
  });

  it("rejects a rolling window outside the envelope", () => {
    expectOutOfBounds(
      {
        rules: [
          {
            ...valid.rules[0],
            rollingSpend: { maxValueWei: "1", windowSeconds: 30 },
          },
        ],
      },
      "windowSeconds",
    );
  });

  it("rejects calldata constraints", () => {
    expectOutOfBounds(
      {
        rules: [
          {
            ...valid.rules[0],
            calldata: {
              function: { name: "transfer", inputs: [] },
              exactArguments: {},
            },
          },
        ],
      },
      "calldata",
    );
  });

  it("rejects validity windows", () => {
    expectOutOfBounds(
      {
        rules: [
          {
            ...valid.rules[0],
            validityWindow: { notAfterUnix: 1_800_000_000 },
          },
        ],
      },
      "validityWindow",
    );
  });

  it("rejects more than one rule", () => {
    expectOutOfBounds({ rules: [valid.rules[0], valid.rules[0]] }, "rules");
  });
});

describe("createDemoRateLimiter", () => {
  it("limits demo mutations per client key with a sliding window", () => {
    let now = 0;
    const limiter = createDemoRateLimiter({
      now: () => now,
      mutationPerClient: 2,
      mutationGlobal: 100,
      mutationWindowMs: 10_000,
    });
    limiter.assertMutationAllowed("client-a");
    limiter.assertMutationAllowed("client-a");
    try {
      limiter.assertMutationAllowed("client-a");
      expect.unreachable("third mutation must be rate limited");
    } catch (error) {
      expect((error as DemoGuardError).status).toBe(429);
      expect((error as DemoGuardError).code).toBe("RATE_LIMITED");
    }
    limiter.assertMutationAllowed("client-b");
    now = 11_000;
    limiter.assertMutationAllowed("client-a");
  });

  it("applies a global mutation cap across clients", () => {
    const limiter = createDemoRateLimiter({
      mutationPerClient: 100,
      mutationGlobal: 3,
    });
    limiter.assertMutationAllowed("client-a");
    limiter.assertMutationAllowed("client-b");
    limiter.assertMutationAllowed("client-c");
    expect(() => limiter.assertMutationAllowed("client-d")).toThrow(
      DemoGuardError,
    );
  });

  it("limits executions per installation and globally", () => {
    const limiter = createDemoRateLimiter({
      executionPerInstallation: 2,
      executionGlobal: 3,
    });
    limiter.assertExecutionAllowed("installation-1");
    limiter.assertExecutionAllowed("installation-1");
    expect(() => limiter.assertExecutionAllowed("installation-1")).toThrow(
      DemoGuardError,
    );
    limiter.assertExecutionAllowed("installation-2");
    expect(() => limiter.assertExecutionAllowed("installation-3")).toThrow(
      DemoGuardError,
    );
  });
});

describe("executionRequestForScenario", () => {
  const permissionSet = fixturePermissionSet(fixtureRelease());

  it("targets the approved recipient for an allowed scenario", () => {
    expect(
      executionRequestForScenario(
        permissionSet,
        "ALLOWED",
        FORBIDDEN_RECIPIENT,
      ),
    ).toEqual({ to: FIXTURE_RECIPIENT.toLowerCase(), valueWei: "1" });
  });

  it("targets the forbidden recipient for a forbidden scenario", () => {
    expect(
      executionRequestForScenario(
        permissionSet,
        "FORBIDDEN",
        FORBIDDEN_RECIPIENT,
      ),
    ).toEqual({ to: FORBIDDEN_RECIPIENT, valueWei: "1" });
  });

  it("fails closed when the forbidden probe overlaps the approved recipient", () => {
    expect(() =>
      executionRequestForScenario(
        permissionSet,
        "FORBIDDEN",
        FIXTURE_RECIPIENT.toLowerCase(),
      ),
    ).toThrow(DemoGuardError);
  });
});
