import { describe, expect, it } from "vitest";
import {
  createCompanyAuthorityTerms,
  createNormalizedPermissionSet,
  diffPermissionSets,
} from "../packages/permissions/src/index.js";
import { transitionInstallation } from "../packages/shared/src/index.js";
import {
  createActiveFixture,
  fixtureRelease,
} from "./support/installation-fixture.js";

function installationWithPendingUpdate() {
  const { installation, permissionSet } = createActiveFixture();
  const nextRelease = fixtureRelease(
    "release-withdrawn-next",
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
  const pending = transitionInstallation(installation, {
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
  return { installation, pending };
}

describe("update_withdrawn transition", () => {
  it("returns an installation with a pending update to ACTIVE", () => {
    const { installation, pending } = installationWithPendingUpdate();
    expect(pending.status).toBe("UPDATE_AVAILABLE");
    expect(pending.pendingUpdate).toBeDefined();

    const withdrawn = transitionInstallation(pending, {
      type: "update_withdrawn",
    });

    expect(withdrawn.status).toBe("ACTIVE");
    expect(withdrawn.pendingUpdate).toBeUndefined();
    expect(withdrawn.generation).toBe(installation.generation);
    expect(withdrawn.release.releaseId).toBe(installation.release.releaseId);
    expect(withdrawn.permissionSet.permissionHash).toBe(
      installation.permissionSet.permissionHash,
    );
    expect(withdrawn.privy).toEqual(installation.privy);
    expect(withdrawn.ens).toEqual(installation.ens);
  });

  it("rejects update_withdrawn from ACTIVE without a pending update", () => {
    const { installation } = createActiveFixture();
    expect(() =>
      transitionInstallation(installation, { type: "update_withdrawn" }),
    ).toThrow(/update_withdrawn/);
  });

  it("rejects update_withdrawn when the pending update is missing", () => {
    const { pending } = installationWithPendingUpdate();
    expect(() =>
      transitionInstallation(
        { ...pending, pendingUpdate: undefined },
        { type: "update_withdrawn" },
      ),
    ).toThrow(/pending update/);
  });
});
