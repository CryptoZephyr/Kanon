import {
  SUPPORTED_PRIVY_EXECUTION_METHODS,
  UnsupportedAuthorityError,
  createCompanyAuthorityTerms,
  createNormalizedPermissionSet,
  diffPermissionSets,
  serializeCompanyAuthorityTerms,
} from "../packages/permissions/src/index.js";
import { createAgentRelease } from "../packages/manifest/src/index.js";
import { describe, expect, it } from "vitest";

const RECIPIENT = "0x8B88E1E1174eDC65B08de75A5439f130da8A3DFd";

function release(input: {
  readonly releaseId: string;
  readonly content: string;
}) {
  return createAgentRelease({
    agentId: "com.example.treasury",
    releaseId: input.releaseId,
    version: input.releaseId,
    packageContent: input.content,
    runtime: { entry: "worker" },
    capabilities: { chains: [11155111], assets: ["native"] },
  });
}

function permissionSet(
  companyTerms: Parameters<typeof createCompanyAuthorityTerms>[0],
  releaseId = "release-a",
) {
  return createNormalizedPermissionSet({
    release: release({ releaseId, content: releaseId }),
    companyTerms: createCompanyAuthorityTerms(companyTerms),
  });
}

describe("T1B final authority model", () => {
  it("normalizes the verified Privy authority surface", () => {
    const terms = createCompanyAuthorityTerms({
      rules: [
        {
          chainId: 11155111,
          asset: "native",
          recipient: RECIPIENT,
          maxValueWei: "0001",
          calldata: {
            function: {
              name: "ping",
              inputs: [{ name: "nonce", type: "uint256" }],
            },
            exactArguments: { nonce: "7" },
          },
          validityWindow: { notBeforeUnix: 100, notAfterUnix: 200 },
          rollingSpend: { maxValueWei: "10", windowSeconds: 3600 },
        },
      ],
    });

    expect(terms).toEqual({
      schema: "kanon.company-authority-terms",
      version: 2,
      authority: {
        rules: [
          {
            asset: "native",
            calldata: {
              exactArguments: { nonce: "7" },
              function: {
                inputs: [{ name: "nonce", type: "uint256" }],
                name: "ping",
              },
            },
            chainId: 11155111,
            maxValueWei: "1",
            recipient: RECIPIENT.toLowerCase(),
            rollingSpend: { maxValueWei: "10", windowSeconds: 3600 },
            validityWindow: { notAfterUnix: 200, notBeforeUnix: 100 },
          },
        ],
      },
    });
    expect(Object.isFrozen(terms)).toBe(true);
    expect(Object.isFrozen(terms.authority)).toBe(true);
    expect(Object.isFrozen(terms.authority.rules)).toBe(true);
  });

  it("uses stable canonical serialization and ignores rule order and duplicates", () => {
    const first = createCompanyAuthorityTerms({
      rules: [
        {
          chainId: 11155111,
          asset: "native",
          recipient: RECIPIENT,
          maxValueWei: "1",
        },
        {
          chainId: 11155111,
          asset: "native",
          recipient: RECIPIENT.toLowerCase(),
          maxValueWei: "1",
        },
      ],
    });
    const second = createCompanyAuthorityTerms({
      rules: [
        {
          maxValueWei: 1n,
          recipient: RECIPIENT.toLowerCase(),
          asset: "native",
          chainId: 11155111,
        },
      ],
    });

    expect(serializeCompanyAuthorityTerms(first)).toBe(
      '{"authority":{"rules":[{"asset":"native","chainId":11155111,"maxValueWei":"1","recipient":"0x8b88e1e1174edc65b08de75a5439f130da8a3dfd"}]},"schema":"kanon.company-authority-terms","version":2}',
    );
    expect(serializeCompanyAuthorityTerms(first)).toBe(
      serializeCompanyAuthorityTerms(second),
    );
    const firstPermissionSet = createNormalizedPermissionSet({
      release: release({ releaseId: "release-a", content: "a" }),
      companyTerms: first,
    });
    const secondPermissionSet = createNormalizedPermissionSet({
      release: release({ releaseId: "release-b", content: "b" }),
      companyTerms: second,
    });
    expect(firstPermissionSet.permissionHash).toBe(
      secondPermissionSet.permissionHash,
    );
    expect(firstPermissionSet.permissionHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(firstPermissionSet.source.releaseId).not.toBe(
      secondPermissionSet.source.releaseId,
    );
  });

  it("changes the hash when approved authority changes", () => {
    const oneWei = createCompanyAuthorityTerms({
      rules: [
        {
          chainId: 11155111,
          asset: "native",
          recipient: RECIPIENT,
          maxValueWei: "1",
        },
      ],
    });
    const twoWei = createCompanyAuthorityTerms({
      rules: [
        {
          chainId: 11155111,
          asset: "native",
          recipient: RECIPIENT,
          maxValueWei: "2",
        },
      ],
    });

    const first = createNormalizedPermissionSet({
      release: release({ releaseId: "release-a", content: "a" }),
      companyTerms: oneWei,
    });
    const second = createNormalizedPermissionSet({
      release: release({ releaseId: "release-a", content: "a" }),
      companyTerms: twoWei,
    });

    expect(first.permissionHash).not.toBe(second.permissionHash);
  });

  it("fails closed for unsupported or ambiguous authority input", () => {
    expect(() =>
      createCompanyAuthorityTerms({
        rules: [
          {
            chainId: 11155111,
            asset: "erc20",
            recipient: RECIPIENT,
            maxValueWei: "1",
          },
        ],
      } as never),
    ).toThrow(UnsupportedAuthorityError);

    expect(() =>
      createCompanyAuthorityTerms({
        rules: [
          {
            chainId: 11155111,
            asset: "native",
            recipient: RECIPIENT,
            maxValueWei: "1",
            requestRate: { maxRequests: 1, windowSeconds: 60 },
          },
        ],
      } as never),
    ).toThrow(UnsupportedAuthorityError);

    expect(() =>
      createCompanyAuthorityTerms({
        rules: [
          {
            chainId: 11155111,
            asset: "native",
            recipient: RECIPIENT,
            maxValueWei: 1,
          },
        ],
      } as never),
    ).toThrow(/maxValueWei/);

    expect(() =>
      createCompanyAuthorityTerms({
        rules: [
          {
            chainId: 11155111,
            asset: "native",
            recipient: RECIPIENT,
            maxValueWei: "1",
            validityWindow: { notBeforeUnix: 200, notAfterUnix: 100 },
          },
        ],
      }),
    ).toThrow(/validityWindow/);
  });

  it("keeps the execution method contract explicit", () => {
    expect(SUPPORTED_PRIVY_EXECUTION_METHODS).toEqual([
      "eth_signTransaction",
      "eth_sendTransaction",
    ]);
  });

  it("classifies unchanged authority without reviewing a release-only change", () => {
    const previous = permissionSet({
      rules: [
        {
          chainId: 11155111,
          asset: "native",
          recipient: RECIPIENT,
          maxValueWei: "10",
        },
      ],
    });
    const next = permissionSet(
      {
        rules: [
          {
            chainId: 11155111,
            asset: "native",
            recipient: RECIPIENT.toLowerCase(),
            maxValueWei: 10n,
          },
        ],
      },
      "release-b",
    );

    expect(diffPermissionSets(previous, next)).toEqual({
      classification: "NO_CHANGE",
      requiresHumanReview: false,
      previousPermissionHash: previous.permissionHash,
      nextPermissionHash: next.permissionHash,
      changedPaths: [],
    });
  });

  it("classifies a strictly reduced rule as narrower", () => {
    const previous = permissionSet({
      rules: [
        {
          chainId: 11155111,
          asset: "native",
          recipient: RECIPIENT,
          maxValueWei: "10",
        },
      ],
    });
    const next = permissionSet({
      rules: [
        {
          chainId: 11155111,
          asset: "native",
          recipient: RECIPIENT,
          maxValueWei: "5",
          validityWindow: { notBeforeUnix: 100, notAfterUnix: 200 },
        },
      ],
    });

    const diff = diffPermissionSets(previous, next);
    expect(diff.classification).toBe("NARROWER");
    expect(diff.requiresHumanReview).toBe(false);
    expect(diff.changedPaths).toEqual([
      "companyTerms.authority.rules[0].maxValueWei",
      "companyTerms.authority.rules[0].validityWindow",
    ]);
  });

  it("classifies added scope and widened limits as expanded", () => {
    const previous = permissionSet({
      rules: [
        {
          chainId: 11155111,
          asset: "native",
          recipient: RECIPIENT,
          maxValueWei: "5",
          calldata: {
            function: {
              name: "ping",
              inputs: [{ name: "nonce", type: "uint256" }],
            },
            exactArguments: { nonce: "7" },
          },
          validityWindow: { notBeforeUnix: 100, notAfterUnix: 200 },
        },
      ],
    });
    const next = permissionSet({
      rules: [
        {
          chainId: 11155111,
          asset: "native",
          recipient: RECIPIENT,
          maxValueWei: "10",
        },
        {
          chainId: 11155111,
          asset: "native",
          recipient: "0x0000000000000000000000000000000000000001",
          maxValueWei: "1",
        },
      ],
    });

    const diff = diffPermissionSets(previous, next);
    expect(diff.classification).toBe("EXPANDED");
    expect(diff.requiresHumanReview).toBe(true);
    expect(diff.changedPaths).toContain("companyTerms.authority.rules[1]");
  });

  it("classifies a same-limit scope replacement as substituted", () => {
    const previous = permissionSet({
      rules: [
        {
          chainId: 11155111,
          asset: "native",
          recipient: RECIPIENT,
          maxValueWei: "1",
          calldata: {
            function: {
              name: "ping",
              inputs: [{ name: "nonce", type: "uint256" }],
            },
            exactArguments: { nonce: "7" },
          },
        },
      ],
    });
    const next = permissionSet({
      rules: [
        {
          chainId: 11155111,
          asset: "native",
          recipient: "0x0000000000000000000000000000000000000001",
          maxValueWei: "1",
          calldata: {
            function: {
              name: "pong",
              inputs: [{ name: "nonce", type: "uint256" }],
            },
            exactArguments: { nonce: "7" },
          },
        },
      ],
    });

    const diff = diffPermissionSets(previous, next);
    expect(diff.classification).toBe("SUBSTITUTED");
    expect(diff.requiresHumanReview).toBe(true);
  });

  it("classifies incomparable rolling limits as unknown and requires review", () => {
    const previous = permissionSet({
      rules: [
        {
          chainId: 11155111,
          asset: "native",
          recipient: RECIPIENT,
          maxValueWei: "10",
          rollingSpend: { maxValueWei: "10", windowSeconds: 60 },
        },
      ],
    });
    const next = permissionSet({
      rules: [
        {
          chainId: 11155111,
          asset: "native",
          recipient: RECIPIENT,
          maxValueWei: "10",
          rollingSpend: { maxValueWei: "20", windowSeconds: 120 },
        },
      ],
    });

    const diff = diffPermissionSets(previous, next);
    expect(diff.classification).toBe("UNKNOWN");
    expect(diff.requiresHumanReview).toBe(true);
    expect(diff.reason).toMatch(/could not prove/);
  });

  it("fails closed when a normalized permission hash is forged", () => {
    const previous = permissionSet({
      rules: [
        {
          chainId: 11155111,
          asset: "native",
          recipient: RECIPIENT,
          maxValueWei: "1",
        },
      ],
    });
    const forged = {
      ...previous,
      permissionHash:
        "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    } as never;

    const diff = diffPermissionSets(previous, forged);
    expect(diff.classification).toBe("UNKNOWN");
    expect(diff.requiresHumanReview).toBe(true);
    expect(diff.changedPaths).toEqual(["permissionSet"]);
  });
});
