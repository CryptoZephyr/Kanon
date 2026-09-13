import {
  createRunnerContext,
  IsolatedRunner,
  RunnerRefusalError,
  type DelegatedExecutionInput,
} from "../apps/runner/src/isolated-runner.js";
import type { Installation } from "../packages/shared/src/index.js";
import { createActiveFixture } from "./support/installation-fixture.js";
import { describe, expect, it, vi } from "vitest";

describe("T10 isolated runner", () => {
  it("executes with the selected delegated method and no owner authority", async () => {
    const fixture = createActiveFixture();
    const context = createRunnerContext(fixture.installation);
    let received: DelegatedExecutionInput | undefined;
    const runner = new IsolatedRunner(
      { getInstallation: () => fixture.installation },
      {
        execute: async (input) => {
          received = input;
          return {
            outcome: "SUCCEEDED",
            transactionHash: "0xrunner-success",
          };
        },
      },
    );

    const evidence = await runner.execute({
      installationId: fixture.installation.id,
      context,
      request: {
        to: "0x8b88e1e1174edc65b08de75a5439f130da8a3dfd",
        value: "0x1",
      },
    });

    expect(evidence.outcome).toBe("SUCCEEDED");
    expect(evidence.executionMethod).toBe("eth_sendTransaction");
    expect(received?.executionMethod).toBe("eth_sendTransaction");
    expect(received?.walletId).toBe("fixture-business-wallet");
    expect(received).not.toHaveProperty("ownerId");
    expect(received).not.toHaveProperty("ownerAuthorizationKey");
    expect(received).not.toHaveProperty("ownerPrivateKey");
  });

  it("returns Privy rejection evidence for a forbidden action", async () => {
    const fixture = createActiveFixture();
    const context = createRunnerContext(fixture.installation);
    const runner = new IsolatedRunner(
      { getInstallation: () => fixture.installation },
      {
        execute: async () => ({
          outcome: "REJECTED" as const,
          rejectionCode: "policy_violation",
        }),
      },
    );

    const evidence = await runner.execute({
      installationId: fixture.installation.id,
      context,
      request: {
        to: "0x2222222222222222222222222222222222222222",
        value: "0x1",
      },
    });

    expect(evidence).toMatchObject({
      outcome: "REJECTED",
      rejectionCode: "policy_violation",
      executionMethod: "eth_sendTransaction",
    });
  });

  it("refuses stale and revoked installations before invoking the executor", async () => {
    const fixture = createActiveFixture();
    const context = createRunnerContext(fixture.installation);
    let current: Installation = fixture.installation;
    const execute = vi.fn(async () => ({
      outcome: "SUCCEEDED" as const,
      transactionHash: "0xshould-not-run",
    }));
    const runner = new IsolatedRunner(
      { getInstallation: () => current },
      { execute },
    );

    current = {
      ...fixture.installation,
      generation: fixture.installation.generation + 1,
    };
    await expect(
      runner.execute({
        installationId: fixture.installation.id,
        context,
        request: {},
      }),
    ).rejects.toBeInstanceOf(RunnerRefusalError);
    expect(execute).not.toHaveBeenCalled();

    current = {
      ...fixture.installation,
      privy: {
        ...fixture.installation.privy!,
        policyId: "fixture-changed-policy",
      },
    };
    await expect(
      runner.execute({
        installationId: fixture.installation.id,
        context,
        request: {},
      }),
    ).rejects.toMatchObject({ code: "RUNNER_REFUSED_STALE_OR_REVOKED" });
    expect(execute).not.toHaveBeenCalled();

    current = {
      ...fixture.installation,
      status: "REVOKED",
      privy: { ...fixture.installation.privy!, status: "REVOKED" },
      ens: { ...fixture.installation.ens!, status: "revoked" },
    };
    await expect(
      runner.execute({
        installationId: fixture.installation.id,
        context,
        request: {},
      }),
    ).rejects.toMatchObject({ code: "RUNNER_REFUSED_STALE_OR_REVOKED" });
    expect(execute).not.toHaveBeenCalled();
  });
});
