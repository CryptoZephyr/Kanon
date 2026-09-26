import { describe, expect, it } from "vitest";
import {
  describeApiError,
  isTransientError,
  nextStepFor,
  postRevokeAttempted,
} from "../apps/web/src/logic.js";
import { KanonApiError } from "../apps/web/src/api.js";
import type {
  EvidenceResource,
  InstallationResource,
} from "../apps/web/src/api.js";
import { flattenDocsNav } from "../apps/web/src/docs/docs-navigation.js";
import {
  DOC_SECTIONS,
  resolveDocPath,
} from "../apps/web/src/docs/docs-routes.js";

function installation(
  status: InstallationResource["status"],
  extra: Partial<InstallationResource> = {},
): InstallationResource {
  return {
    schema: "kanon.api.installation",
    version: 1,
    id: "installation-test",
    organizationId: "organization-kanon",
    status,
    generation: 0,
    agent: {} as InstallationResource["agent"],
    companyTerms: {} as InstallationResource["companyTerms"],
    evidence: [],
    ...extra,
  };
}

function executionEvidence(outcome: string): EvidenceResource {
  return {
    schema: "kanon.api.execution-evidence",
    version: 1,
    evidence: { outcome },
  };
}

const revocationEvidence: EvidenceResource = {
  schema: "kanon.api.revocation-evidence",
  version: 1,
  evidence: {},
};

describe("nextStepFor", () => {
  const base = {
    installationSource: "session" as const,
    connected: true,
  };

  it("asks to connect when offline", () => {
    expect(nextStepFor({ ...base, connected: false }).key).toBe("connecting");
  });

  it("shows fixture-busy with the wait when another session is live", () => {
    const step = nextStepFor({
      ...base,
      liveSession: {
        installationId: "installation-other",
        status: "ACTIVE",
        ageSeconds: 100,
        expiresInSeconds: 540,
      },
    });
    expect(step.key).toBe("fixture-busy");
    expect(step.detail).toContain("9 minute");
  });

  it("does not show fixture-busy for our own live session", () => {
    const step = nextStepFor({
      ...base,
      installation: installation("ACTIVE"),
      liveSession: {
        installationId: "installation-test",
        status: "ACTIVE",
        ageSeconds: 100,
        expiresInSeconds: 540,
      },
    });
    expect(step.key).toBe("allowed");
  });

  it("starts a run when there is no installation", () => {
    const step = nextStepFor(base);
    expect(step.key).toBe("start");
    expect(step.action?.command).toBe("start-run");
  });

  it("maps each in-flight status to a watching step", () => {
    expect(
      nextStepFor({
        ...base,
        installation: installation("CONFIGURING_AUTHORITY"),
      }).key,
    ).toBe("activating");
    expect(
      nextStepFor({
        ...base,
        installation: installation("AWAITING_REAUTHORIZATION"),
      }).key,
    ).toBe("reauthorizing");
    expect(
      nextStepFor({ ...base, installation: installation("REVOKING") }).key,
    ).toBe("revoking");
  });

  it("routes AWAITING_APPROVAL to the review screen", () => {
    const step = nextStepFor({
      ...base,
      installation: installation("AWAITING_APPROVAL"),
    });
    expect(step.key).toBe("awaiting-approval");
    expect(step.action?.screen).toBe("review");
  });

  it("routes UPDATE_AVAILABLE to review", () => {
    const step = nextStepFor({
      ...base,
      installation: installation("UPDATE_AVAILABLE"),
    });
    expect(step.key).toBe("update-available");
  });

  it("walks an ACTIVE installation through allowed, forbidden, update, revoke", () => {
    const allowed = nextStepFor({
      ...base,
      installation: installation("ACTIVE"),
    });
    expect(allowed.key).toBe("allowed");
    expect(allowed.action?.command).toBe("execute-allowed");

    const forbidden = nextStepFor({
      ...base,
      installation: installation("ACTIVE", {
        evidence: [executionEvidence("SUCCEEDED")],
      }),
    });
    expect(forbidden.key).toBe("forbidden");
    expect(forbidden.action?.command).toBe("execute-forbidden");

    const update = nextStepFor({
      ...base,
      installation: installation("ACTIVE", {
        evidence: [
          executionEvidence("SUCCEEDED"),
          executionEvidence("REJECTED"),
        ],
      }),
    });
    expect(update.key).toBe("update");
    expect(update.action?.screen).toBe("update");

    const revoke = nextStepFor({
      ...base,
      installation: installation("ACTIVE", {
        generation: 1,
        evidence: [
          executionEvidence("SUCCEEDED"),
          executionEvidence("REJECTED"),
        ],
        updateDiff: {} as InstallationResource["updateDiff"],
      }),
    });
    expect(revoke.key).toBe("revoke");
    expect(revoke.action?.command).toBe("revoke");
  });

  it("asks for the post-revoke attempt on a fresh REVOKED run", () => {
    const step = nextStepFor({
      ...base,
      installation: installation("REVOKED"),
    });
    expect(step.key).toBe("post-revoke");
    expect(step.action?.command).toBe("post-revoke");
  });

  it("reports run complete once the post-revoke attempt exists", () => {
    const step = nextStepFor({
      ...base,
      installation: installation("REVOKED", {
        revoke: {
          status: "REVOKED",
          privyAuthorityRevoked: true,
          ensStatus: "revoked",
          postRevokeExecutionFailed: true,
        },
      }),
    });
    expect(step.key).toBe("complete");
  });
});

describe("postRevokeAttempted", () => {
  it("is true when the revoke resource recorded the failed attempt", () => {
    expect(
      postRevokeAttempted(
        installation("REVOKED", {
          revoke: {
            status: "REVOKED",
            privyAuthorityRevoked: true,
            ensStatus: "revoked",
            postRevokeExecutionFailed: true,
          },
        }),
      ),
    ).toBe(true);
  });

  it("is true when a rejected execution follows the revocation evidence", () => {
    expect(
      postRevokeAttempted(
        installation("REVOKED", {
          evidence: [revocationEvidence, executionEvidence("REJECTED")],
        }),
      ),
    ).toBe(true);
  });

  it("is false when rejections only precede revocation", () => {
    expect(
      postRevokeAttempted(
        installation("REVOKED", {
          evidence: [executionEvidence("REJECTED"), revocationEvidence],
        }),
      ),
    ).toBe(false);
  });

  it("is false with no installation", () => {
    expect(postRevokeAttempted(undefined)).toBe(false);
  });
});

describe("describeApiError", () => {
  const cases: [string, string][] = [
    ["DEMO_SESSION_ACTIVE", "Another session is live"],
    ["RATE_LIMITED", "Rate limited"],
    ["DEMO_TERMS_OUT_OF_BOUNDS", "Terms outside the demo ceiling"],
    ["UPSTREAM_TIMEOUT", "The backend timed out"],
    ["UPSTREAM_FAILED", "A dependency could not be reached"],
    ["CONFLICT", "State conflict"],
    ["REVOKED", "Authority was revoked"],
    ["FORBIDDEN", "Not allowed"],
    ["UNAUTHORIZED", "Not authorized"],
    ["NOT_FOUND", "Not found"],
    ["INTERNAL_ERROR", "Server error"],
  ];

  it.each(cases)("maps %s to plain language", (code, title) => {
    const described = describeApiError(new KanonApiError(400, { code }));
    expect(described.title).toBe(title);
    expect(described.recovery.length).toBeGreaterThan(0);
  });

  it("describes a DEMO_SESSION_ACTIVE wait from retryAfterSeconds", () => {
    const described = describeApiError(
      new KanonApiError(409, {
        code: "DEMO_SESSION_ACTIVE",
        details: { retryAfterSeconds: "600" },
      }),
    );
    expect(described.detail).toContain("10 minutes");
  });

  it("describes browser timeouts and network errors", () => {
    expect(
      describeApiError(new DOMException("slow", "TimeoutError")).title,
    ).toBe("Timed out");
    expect(describeApiError(new TypeError("fetch failed")).title).toBe(
      "Network error",
    );
    expect(describeApiError("weird").title).toBe("Something went wrong");
  });
});

describe("isTransientError", () => {
  it("treats 5xx, 408, 429 and upstream failures as transient", () => {
    expect(
      isTransientError(new KanonApiError(503, { code: "UPSTREAM_FAILED" })),
    ).toBe(true);
    expect(isTransientError(new KanonApiError(408, { code: "X" }))).toBe(true);
    expect(isTransientError(new KanonApiError(429, { code: "X" }))).toBe(true);
    expect(isTransientError(new DOMException("slow", "TimeoutError"))).toBe(
      true,
    );
    expect(isTransientError(new TypeError("network"))).toBe(true);
  });

  it("treats definitive 4xx as final", () => {
    expect(
      isTransientError(new KanonApiError(404, { code: "NOT_FOUND" })),
    ).toBe(false);
    expect(
      isTransientError(new KanonApiError(403, { code: "FORBIDDEN" })),
    ).toBe(false);
  });
});

describe("docs routes", () => {
  it("has no duplicate nav hrefs or page ids", () => {
    const flat = flattenDocsNav();
    const hrefs = flat.map((entry) => entry.item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    const ids = DOC_SECTIONS.flatMap((section) =>
      section.pages.map((page) => `${section.id}/${page.id}`),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolves every nav item to a real page", () => {
    for (const entry of flattenDocsNav()) {
      const route = resolveDocPath(entry.item.href);
      expect(route).not.toBe("index");
      expect(route).toBeDefined();
      if (route && route !== "index") {
        expect(route.page.id).toBe(entry.item.id);
        expect(route.page.blocks.length).toBeGreaterThan(0);
      }
    }
  });

  it("resolves /docs to the index and a section path to its first page", () => {
    expect(resolveDocPath("/docs")).toBe("index");
    const sectionRoute = resolveDocPath("/docs/start");
    expect(sectionRoute).not.toBe("index");
    if (sectionRoute && sectionRoute !== "index") {
      expect(sectionRoute.page.id).toBe("introduction");
    }
  });

  it("rejects unknown paths and provides prev/next links", () => {
    expect(resolveDocPath("/docs/nope")).toBeUndefined();
    expect(resolveDocPath("/docs/start/nope")).toBeUndefined();
    const first = resolveDocPath("/docs/start/introduction");
    const second = resolveDocPath("/docs/start/why-kanon");
    if (first === "index" || second === "index" || !first || !second) {
      throw new Error("routes unresolved");
    }
    expect(first.prev).toBeUndefined();
    expect(first.next?.href).toBe("/docs/start/why-kanon");
    expect(second.prev?.href).toBe("/docs/start/introduction");
  });
});
