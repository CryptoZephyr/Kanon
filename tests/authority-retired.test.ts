import { describe, expect, it } from "vitest";
import {
  createCompanyAuthorityTerms,
  createNormalizedPermissionSet,
  diffPermissionSets,
} from "../packages/permissions/src/index.js";
import {
  createHumanDecision,
  createInstallation,
  createInstallationResource,
  createRetirementRecord,
  createRevocationRecord,
  transitionInstallation,
  type Installation,
} from "../packages/shared/src/index.js";
import {
  createActiveFixture,
  fixtureRelease,
} from "./support/installation-fixture.js";

const RETIRED_AT = "2026-09-12T13:00:00.000Z";

function retirement(input?: {
  readonly privySignerCountAfter?: number;
  readonly ensRevokedWritten?: boolean;
}) {
  return createRetirementRecord({
    reason: "demo-session-expiry",
    retiredAt: RETIRED_AT,
    privySignerCountAfter: input?.privySignerCountAfter ?? 0,
    ensRevokedWritten: input?.ensRevokedWritten ?? false,
  });
}

function freshInstallation(id: string, releaseId: string): Installation {
  const release = fixtureRelease(releaseId, `kanon-fixture-${releaseId}`);
  return createInstallation({
    id,
    organizationId: "organization-kanon",
    release,
    permissionSet: createNormalizedPermissionSet({
      release,
      companyTerms: createCompanyAuthorityTerms({
        rules: [
          {
            chainId: 11155111,
            asset: "native",
            recipient: "0x8b88e1e1174edc65b08de75a5439f130da8a3dfd",
            maxValueWei: "1",
          },
        ],
      }),
    }),
  });
}

function configuringFixture(): Installation {
  const requested = transitionInstallation(
    freshInstallation("installation-retire-cfg", "release-retire-cfg"),
    { type: "approval_requested" },
  );
  return transitionInstallation(requested, {
    type: "approval_granted",
    decision: createHumanDecision({
      id: "decision-retire-cfg",
      action: "APPROVE",
      outcome: "APPROVED",
      decidedBy: "company-owner",
      decidedAt: "2026-09-12T12:30:00.000Z",
      release: requested.release,
      permissionSet: requested.permissionSet,
    }),
  });
}

function awaitingApprovalFixture(): Installation {
  return transitionInstallation(
    freshInstallation("installation-retire-await", "release-retire-await"),
    { type: "approval_requested" },
  );
}

function updateAvailableFixture(): Installation {
  const { installation, permissionSet } = createActiveFixture();
  const nextRelease = fixtureRelease(
    "release-retire-next",
    "kanon-fixture-package-next",
  );
  const nextPermissionSet = createNormalizedPermissionSet({
    release: nextRelease,
    companyTerms: createCompanyAuthorityTerms({
      rules: [
        {
          chainId: 11155111,
          asset: "native",
          recipient: permissionSet.companyTerms.authority.rules[0].recipient,
          maxValueWei: "2",
        },
      ],
    }),
  });
  const diff = diffPermissionSets(permissionSet, nextPermissionSet);
  return transitionInstallation(installation, {
    type: "update_available",
    proposal: {
      schema: "kanon.update-proposal",
      version: 1,
      release: nextRelease,
      permissionSet: nextPermissionSet,
      classification: diff.classification,
      requiresHumanReview: diff.requiresHumanReview,
    },
  });
}

function awaitingReauthorizationFixture(): Installation {
  const pending = updateAvailableFixture();
  if (!pending.pendingUpdate) {
    throw new Error("fixture must carry a pending update");
  }
  return transitionInstallation(pending, {
    type: "reauthorization_requested",
    decision: createHumanDecision({
      id: "decision-retire-reauth",
      action: "REAUTHORIZE",
      outcome: "APPROVED",
      decidedBy: "company-owner",
      decidedAt: "2026-09-12T12:40:00.000Z",
      release: pending.pendingUpdate.release,
      permissionSet: pending.pendingUpdate.permissionSet,
    }),
  });
}

function revokingFixture(): Installation {
  const { installation, release, permissionSet } = createActiveFixture();
  return transitionInstallation(installation, {
    type: "revoke_requested",
    decision: createHumanDecision({
      id: "decision-retire-revoke",
      action: "REVOKE",
      outcome: "APPROVED",
      decidedBy: "company-owner",
      decidedAt: "2026-09-12T12:50:00.000Z",
      release,
      permissionSet,
    }),
  });
}

function revokedFixture(): Installation {
  const revoking = revokingFixture();
  if (!revoking.approvedDecision) {
    throw new Error("fixture must carry the revoke decision");
  }
  return transitionInstallation(revoking, {
    type: "revocation_completed",
    decision: revoking.approvedDecision,
    revocation: createRevocationRecord({
      decisionId: revoking.approvedDecision.id,
      privyAuthorityRevoked: true,
      postRevokeExecutionFailed: true,
      recordedAt: RETIRED_AT,
    }),
  });
}

describe("authority_retired transition", () => {
  it("retires an ACTIVE installation without fabricating revocation evidence", () => {
    const { installation } = createActiveFixture();
    const retired = transitionInstallation(installation, {
      type: "authority_retired",
      retirement: retirement(),
    });

    expect(retired.status).toBe("REVOKED");
    expect(retired.retirement?.reason).toBe("demo-session-expiry");
    expect(retired.retirement?.privySignerCountAfter).toBe(0);
    expect(retired.revocation).toBeUndefined();
    expect(retired.privy?.status).toBe("REVOKED");
    expect(retired.generation).toBe(installation.generation);
    expect(retired.ens?.status).toBe("approved");
  });

  it("clears the pending update when retiring UPDATE_AVAILABLE", () => {
    const pending = updateAvailableFixture();
    const retired = transitionInstallation(pending, {
      type: "authority_retired",
      retirement: retirement(),
    });

    expect(retired.status).toBe("REVOKED");
    expect(retired.pendingUpdate).toBeUndefined();
  });

  it("retires CONFIGURING_AUTHORITY, AWAITING_REAUTHORIZATION, and REVOKING", () => {
    for (const fixture of [
      configuringFixture,
      awaitingReauthorizationFixture,
      revokingFixture,
    ]) {
      const source = fixture();
      const retired = transitionInstallation(source, {
        type: "authority_retired",
        retirement: retirement(),
      });
      expect(retired.status).toBe("REVOKED");
      expect(retired.retirement).toBeDefined();
    }
  });

  it("marks the stored ENS snapshot revoked only when the write happened", () => {
    const { installation } = createActiveFixture();
    const written = transitionInstallation(installation, {
      type: "authority_retired",
      retirement: retirement({ ensRevokedWritten: true }),
    });
    expect(written.ens?.status).toBe("revoked");
  });

  it("rejects retirement while delegated signers remain", () => {
    const { installation } = createActiveFixture();
    expect(() =>
      transitionInstallation(installation, {
        type: "authority_retired",
        retirement: {
          schema: "kanon.retirement-record",
          version: 1,
          reason: "demo-session-expiry",
          retiredAt: RETIRED_AT,
          privySignerCountAfter: 1,
          ensRevokedWritten: false,
        },
      }),
    ).toThrow(/zero remaining delegated signers/);
    expect(() =>
      createRetirementRecord({
        reason: "demo-session-expiry",
        retiredAt: RETIRED_AT,
        privySignerCountAfter: 1,
        ensRevokedWritten: false,
      }),
    ).toThrow(/zero remaining delegated signers/);
  });

  it("rejects retirement from VALIDATED, AWAITING_APPROVAL, and REVOKED", () => {
    for (const source of [
      freshInstallation("installation-retire-val", "release-retire-val"),
      awaitingApprovalFixture(),
      revokedFixture(),
    ]) {
      expect(() =>
        transitionInstallation(source, {
          type: "authority_retired",
          retirement: retirement(),
        }),
      ).toThrow(/authority_retired/);
    }
  });

  it("produces an installation resource without a revocation panel", () => {
    const { installation } = createActiveFixture();
    const retired = transitionInstallation(installation, {
      type: "authority_retired",
      retirement: retirement(),
    });
    const resource = createInstallationResource({ installation: retired });
    expect(resource.status).toBe("REVOKED");
    expect(resource.revoke).toBeUndefined();
    expect(resource.retirement?.reason).toBe("demo-session-expiry");
    expect(resource.retirement?.ensRevokedWritten).toBe(false);
  });
});

describe("recordedAuthority projection", () => {
  it("exposes stored Privy and ENS bindings for a revoked installation", () => {
    const { installation } = createActiveFixture();
    const retired = transitionInstallation(installation, {
      type: "authority_retired",
      retirement: retirement({ ensRevokedWritten: true }),
    });
    const resource = createInstallationResource({ installation: retired });

    expect(resource.activeAuthority).toBeUndefined();
    const recorded = resource.recordedAuthority;
    expect(recorded?.privy?.walletId).toBe("fixture-business-wallet");
    expect(recorded?.privy?.policyId).toBe("fixture-agent-policy");
    expect(recorded?.privy?.status).toBe("REVOKED");
    expect(recorded?.privy && "permissionHash" in recorded.privy).toBe(false);
    expect(recorded?.privy && "aggregationId" in recorded.privy).toBe(false);
    expect(recorded?.ens?.source).toBe("recorded");
    expect(recorded?.ens?.agentName).toBe(
      "representative-agent.agents.kanon-ethonline-2026.eth",
    );
    expect(recorded?.ens?.records["kanon.release"]).toBe(
      installation.release.releaseId,
    );
    expect(recorded?.ens?.records["kanon.status"]).toBe("revoked");
  });

  it("uses live on-chain records when a readback is supplied", () => {
    const { installation } = createActiveFixture();
    const retired = transitionInstallation(installation, {
      type: "authority_retired",
      retirement: retirement(),
    });
    const resource = createInstallationResource({
      installation: retired,
      recordedEnsRead: {
        binding: installation.ens!.binding,
        resolver: installation.ens!.binding.resolver,
        records: {
          "kanon.agentId": "com.example.treasury",
          "kanon.release": "release-later-session",
          "kanon.permissionHash": "sha256:" + "ab".repeat(32),
          "kanon.status": "active",
        },
      },
    });

    expect(resource.recordedAuthority?.ens?.source).toBe("live");
    expect(resource.recordedAuthority?.ens?.records["kanon.release"]).toBe(
      "release-later-session",
    );
    expect(resource.recordedAuthority?.ens?.status).toBe("active");
  });

  it("omits the projection for installations that never held authority", () => {
    const awaiting = transitionInstallation(
      freshInstallation("installation-no-auth", "release-no-auth"),
      { type: "approval_requested" },
    );
    const resource = createInstallationResource({ installation: awaiting });
    expect(resource.recordedAuthority).toBeUndefined();
  });
});
