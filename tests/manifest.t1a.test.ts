import {
  createAgentRelease,
  createProvisionalCompanyAuthorityTerms,
  createProvisionalNormalizedPermissionSet,
} from "../packages/manifest/src/index.js";
import { describe, expect, it } from "vitest";

describe("T1A agent release foundation", () => {
  it("creates a stable release identity with package and manifest hashes", async () => {
    const release = createAgentRelease({
      agentId: "com.example.treasury",
      releaseId: "release-2026-09-12",
      version: "0.1.0",
      packageContent: "treasury-agent-package-v1",
      runtime: { entry: "worker" },
      capabilities: {
        chains: [11155111],
        assets: ["native"],
      },
    });

    expect(release.agentId).toBe("com.example.treasury");
    expect(release.releaseId).toBe("release-2026-09-12");
    expect(release.version).toBe("0.1.0");
    expect(release.packageHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(release.manifestHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(release.manifest.capabilities).toEqual({
      chains: [11155111],
      assets: ["native"],
    });
    expect(release.manifest).not.toHaveProperty("companyAuthorityTerms");
    expect(release).not.toHaveProperty("permissionHash");
  });

  it("rejects an invalid release at the provisional normalized-set boundary", () => {
    const companyTerms = createProvisionalCompanyAuthorityTerms({});

    expect(() =>
      createProvisionalNormalizedPermissionSet({
        release: {} as never,
        companyTerms,
      }),
    ).toThrow(/release/);
  });

  it("keeps the manifest hash tied to an immutable capability snapshot", () => {
    const capabilities = {
      chains: [11155111],
    } as { chains: number[] };
    const release = createAgentRelease({
      agentId: "com.example.treasury",
      releaseId: "release-2026-09-12",
      version: "0.1.0",
      packageContent: "treasury-agent-package-v1",
      runtime: { entry: "worker" },
      capabilities,
    });

    capabilities.chains.push(1);

    expect(release.manifest.capabilities).toEqual({ chains: [11155111] });
    expect(release.manifestHash).toBe(release.manifest.manifestHash);
  });

  it("rejects forged company terms at the provisional normalization boundary", () => {
    const release = createAgentRelease({
      agentId: "com.example.treasury",
      releaseId: "release-2026-09-12",
      version: "0.1.0",
      packageContent: "treasury-agent-package-v1",
      runtime: { entry: "worker" },
      capabilities: {},
    });

    expect(() =>
      createProvisionalNormalizedPermissionSet({
        release,
        companyTerms: { provisional: true } as never,
      }),
    ).toThrow(/company authority terms/);
  });

  it("rejects a release with inconsistent manifest hashes", () => {
    const release = createAgentRelease({
      agentId: "com.example.treasury",
      releaseId: "release-2026-09-12",
      version: "0.1.0",
      packageContent: "treasury-agent-package-v1",
      runtime: { entry: "worker" },
      capabilities: {},
    });
    const tamperedRelease = {
      ...release,
      manifestHash:
        "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    } as never;

    expect(() =>
      createProvisionalNormalizedPermissionSet({
        release: tamperedRelease,
        companyTerms: createProvisionalCompanyAuthorityTerms({}),
      }),
    ).toThrow(/manifestHash/);
  });

  it("rejects a release with inconsistent package hashes", () => {
    const release = createAgentRelease({
      agentId: "com.example.treasury",
      releaseId: "release-2026-09-12",
      version: "0.1.0",
      packageContent: "treasury-agent-package-v1",
      runtime: { entry: "worker" },
      capabilities: {},
    });
    const tamperedRelease = {
      ...release,
      manifest: {
        ...release.manifest,
        packageHash:
          "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      },
    } as never;

    expect(() =>
      createProvisionalNormalizedPermissionSet({
        release: tamperedRelease,
        companyTerms: createProvisionalCompanyAuthorityTerms({}),
      }),
    ).toThrow(/packageHash/);
  });

  it("rejects an empty package payload before hashing the release", () => {
    expect(() =>
      createAgentRelease({
        agentId: "com.example.treasury",
        releaseId: "release-2026-09-12",
        version: "0.1.0",
        packageContent: "",
        runtime: { entry: "worker" },
        capabilities: {},
      }),
    ).toThrow(/packageContent/);
  });

  it("rejects a missing stable agent identifier", () => {
    expect(() =>
      createAgentRelease({
        agentId: undefined as never,
        releaseId: "release-2026-09-12",
        version: "0.1.0",
        packageContent: "treasury-agent-package-v1",
        runtime: { entry: "worker" },
        capabilities: {},
      }),
    ).toThrow(/agentId/);
  });

  it("keeps requested identity and provisional company terms separate", () => {
    const release = createAgentRelease({
      agentId: "com.example.treasury",
      releaseId: "release-2026-09-12",
      version: "0.1.0",
      packageContent: "treasury-agent-package-v1",
      runtime: { entry: "worker" },
      capabilities: { chains: [11155111] },
    });
    const companyTerms = createProvisionalCompanyAuthorityTerms({
      pendingReview: true,
    });
    const normalized = createProvisionalNormalizedPermissionSet({
      release,
      companyTerms,
    });

    expect(normalized.source).toEqual({
      agentId: "com.example.treasury",
      releaseId: "release-2026-09-12",
      manifestHash: release.manifestHash,
    });
    expect(normalized.companyTerms).toBe(companyTerms);
    expect(normalized).not.toHaveProperty("permissionHash");
    expect(Object.isFrozen(normalized)).toBe(true);
  });
});
