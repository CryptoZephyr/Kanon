import {
  createCompanyAuthorityTerms,
  createNormalizedPermissionSet,
  diffPermissionSets,
  type PermissionHash,
} from "../packages/permissions/src/index.js";
import {
  createHumanDecision,
  createRevocationRecord,
  transitionInstallation,
} from "../packages/shared/src/index.js";
import {
  createActiveFixture,
  fixtureEnsState,
  fixturePermissionSet,
  fixturePrivyBinding,
  fixtureRelease,
  FIXTURE_RECIPIENT,
} from "./support/installation-fixture.js";
import { describe, expect, it } from "vitest";

describe("T8 installation state", () => {
  it("requires exact human approval before matching Privy and ENS activation", () => {
    const { installation } = createActiveFixture();

    expect(installation.status).toBe("ACTIVE");
    expect(installation.approvedDecision?.action).toBe("APPROVE");
    expect(installation.privy?.authorityKind).toBe("DELEGATED_SIGNER");
    expect(installation.ens?.verified).toBe(true);
    expect(installation.privy?.permissionHash).toBe(
      installation.permissionSet.permissionHash,
    );
  });

  it("fails closed when authority or ENS approved state is stale or mismatched", () => {
    const { installation, release, permissionSet } = createActiveFixture();
    const configuring = {
      ...installation,
      status: "CONFIGURING_AUTHORITY" as const,
      privy: undefined,
      ens: undefined,
    };

    expect(() =>
      transitionInstallation(configuring, {
        type: "authority_configured",
        privy: {
          ...fixturePrivyBinding(permissionSet),
          status: "REVOKED",
        },
        ens: fixtureEnsState(release, permissionSet),
      }),
    ).toThrow(/active Privy/);

    expect(() =>
      transitionInstallation(configuring, {
        type: "authority_configured",
        privy: fixturePrivyBinding(permissionSet),
        ens: fixtureEnsState(release, permissionSet, { verified: false }),
      }),
    ).toThrow(/verified ENS/);

    expect(() =>
      transitionInstallation(configuring, {
        type: "authority_configured",
        privy: {
          ...fixturePrivyBinding(permissionSet),
          permissionHash:
            "sha256:0000000000000000000000000000000000000000000000000000000000000000" as PermissionHash,
        },
        ens: fixtureEnsState(release, permissionSet),
      }),
    ).toThrow(/do not match/);
  });
});

describe("T9 approval and update boundary", () => {
  it("keeps expanded authority behind explicit reauthorization", () => {
    const { installation, release, permissionSet } = createActiveFixture();
    const nextRelease = fixtureRelease("release-t9-expanded", "package-t9");
    const nextPermissionSet = createNormalizedPermissionSet({
      release: nextRelease,
      companyTerms: createCompanyAuthorityTerms({
        rules: [
          {
            chainId: 11155111,
            asset: "native",
            recipient: FIXTURE_RECIPIENT,
            maxValueWei: "2",
          },
        ],
      }),
    });
    const diff = diffPermissionSets(permissionSet, nextPermissionSet);
    expect(diff.classification).toBe("EXPANDED");
    expect(diff.requiresHumanReview).toBe(true);

    expect(() =>
      transitionInstallation(installation, {
        type: "update_available",
        proposal: {
          schema: "kanon.update-proposal",
          version: 1,
          release: nextRelease,
          permissionSet: nextPermissionSet,
          classification: diff.classification,
          requiresHumanReview: false,
        },
      }),
    ).toThrow(/require human review/);

    const withUpdate = transitionInstallation(installation, {
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
    expect(withUpdate.status).toBe("UPDATE_AVAILABLE");

    const reauthorization = createHumanDecision({
      id: "decision-reauthorize-t9",
      action: "REAUTHORIZE",
      outcome: "APPROVED",
      decidedBy: "company-owner",
      decidedAt: "2026-09-12T12:02:00.000Z",
      release: nextRelease,
      permissionSet: nextPermissionSet,
    });
    const awaiting = transitionInstallation(withUpdate, {
      type: "reauthorization_requested",
      decision: reauthorization,
    });

    expect(awaiting.status).toBe("AWAITING_REAUTHORIZATION");
    expect(awaiting.release.releaseId).toBe(release.releaseId);
    expect(awaiting.permissionSet.permissionHash).toBe(
      permissionSet.permissionHash,
    );
    expect(() =>
      transitionInstallation(awaiting, {
        type: "authority_configured",
        privy: fixturePrivyBinding(nextPermissionSet, 0),
        ens: fixtureEnsState(nextRelease, nextPermissionSet),
        release: nextRelease,
        permissionSet: nextPermissionSet,
      }),
    ).toThrow(/generation/);

    const reconfigured = transitionInstallation(awaiting, {
      type: "authority_configured",
      privy: fixturePrivyBinding(nextPermissionSet, 1),
      ens: fixtureEnsState(nextRelease, nextPermissionSet),
      release: nextRelease,
      permissionSet: nextPermissionSet,
    });
    expect(reconfigured.status).toBe("ACTIVE");
    expect(reconfigured.release.releaseId).toBe(nextRelease.releaseId);
    expect(reconfigured.permissionSet.permissionHash).toBe(
      nextPermissionSet.permissionHash,
    );
    expect(reconfigured.generation).toBe(1);
  });

  it("rejects a human decision bound to a different release or permission set", () => {
    const { installation } = createActiveFixture();
    const otherRelease = fixtureRelease("release-t9-other", "package-t9-other");
    const otherPermissionSet = fixturePermissionSet(otherRelease, "1");
    const forgedDecision = createHumanDecision({
      id: "decision-wrong-release",
      action: "APPROVE",
      outcome: "APPROVED",
      decidedBy: "company-owner",
      decidedAt: "2026-09-12T12:03:00.000Z",
      release: otherRelease,
      permissionSet: otherPermissionSet,
    });
    const awaiting = {
      ...installation,
      status: "AWAITING_APPROVAL" as const,
    };

    expect(() =>
      transitionInstallation(awaiting, {
        type: "approval_granted",
        decision: forgedDecision,
      }),
    ).toThrow(/not bound/);
  });

  it("does not mark an installation revoked before all revocation evidence exists", () => {
    const { installation, release, permissionSet } = createActiveFixture();
    const revokeDecision = createHumanDecision({
      id: "decision-revoke-t9",
      action: "REVOKE",
      outcome: "APPROVED",
      decidedBy: "company-owner",
      decidedAt: "2026-09-12T12:04:00.000Z",
      release,
      permissionSet,
    });
    const revoking = transitionInstallation(installation, {
      type: "revoke_requested",
      decision: revokeDecision,
    });
    const incomplete = createRevocationRecord({
      decisionId: revokeDecision.id,
      privyAuthorityRevoked: true,
      postRevokeExecutionFailed: false,
      recordedAt: "2026-09-12T12:05:00.000Z",
    });

    expect(() =>
      transitionInstallation(revoking, {
        type: "revocation_completed",
        decision: revokeDecision,
        revocation: incomplete,
      }),
    ).toThrow(/failed execution/);

    const complete = createRevocationRecord({
      decisionId: revokeDecision.id,
      privyAuthorityRevoked: true,
      postRevokeExecutionFailed: true,
      recordedAt: "2026-09-12T12:06:00.000Z",
    });
    const revoked = transitionInstallation(revoking, {
      type: "revocation_completed",
      decision: revokeDecision,
      revocation: complete,
    });
    expect(revoked.status).toBe("REVOKED");
    expect(revoked.privy?.status).toBe("REVOKED");
    expect(revoked.ens?.status).toBe("revoked");
  });
});
