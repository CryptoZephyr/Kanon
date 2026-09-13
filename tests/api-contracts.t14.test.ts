import {
  API_CONTRACT_SCHEMA,
  API_CONTRACT_VERSION,
  KANON_API_CONTRACT,
  KANON_API_ROUTES,
  createActiveAuthorityResource,
  createAgentCapabilityResource,
  createApiError,
  createApiSuccess,
  createCompanyTermsResource,
  createEnsIdentityResource,
  createExecutionEvidence,
  createExecutionEvidenceResource,
  createInstallationResource,
  createOrganization,
  createOrganizationResource,
  createPrivyAuthorityResource,
  createRevokeRequestResource,
  createRevokeResource,
  createRevocationEvidenceResource,
  createRevocationRecord,
  createWalletResource,
  createUpdateDiffResource,
  createHumanDecision,
  type Installation,
} from "../packages/shared/src/index.js";
import type { EnsApprovedStateRead } from "../packages/ens/src/index.js";
import {
  createCompanyAuthorityTerms,
  createNormalizedPermissionSet,
  diffPermissionSets,
} from "../packages/permissions/src/index.js";
import { describe, expect, it } from "vitest";
import {
  createActiveFixture,
  fixturePermissionSet,
  fixtureRelease,
} from "./support/installation-fixture.js";

function ensReadback(installation: Installation): EnsApprovedStateRead {
  if (!installation.ens) {
    throw new Error("fixture must include ENS state");
  }

  return {
    binding: installation.ens.binding,
    resolver: installation.ens.binding.resolver,
    records: {
      "kanon.agentId": installation.ens.agentId,
      "kanon.release": installation.ens.releaseId,
      "kanon.permissionHash": installation.ens.permissionHash,
      "kanon.status": installation.ens.status,
    },
  };
}

describe("T14 backend and API contract", () => {
  it("freezes a versioned, company-authenticated route surface", () => {
    expect(API_CONTRACT_SCHEMA).toBe("kanon.api-contract");
    expect(API_CONTRACT_VERSION).toBe(1);
    expect(KANON_API_CONTRACT).toEqual({
      schema: API_CONTRACT_SCHEMA,
      version: API_CONTRACT_VERSION,
      routes: KANON_API_ROUTES,
    });

    for (const route of Object.values(KANON_API_ROUTES)) {
      expect(route.auth).toBe("company");
      expect(route.path).toMatch(/^\/v1\//);
    }
  });

  it("projects organization, wallet, agent, and company terms without secrets", () => {
    const organization = createOrganization({
      id: "organization-kanon",
      name: "Kanon",
      controlWallet: "0x8b88E1E1174eDC65B08de75A5439f130da8A3DFd",
      ensNamespace: "agents.kanon-ethonline-2026.eth",
    });
    const organizationResource = createOrganizationResource(organization);
    const walletResource = createWalletResource({
      walletId: "business-wallet",
      address: organization.controlWallet,
      chainId: 11155111,
      asset: "native",
      status: "CONFIGURED",
    });
    const release = fixtureRelease();
    const permissionSet = fixturePermissionSet(release);

    expect(organizationResource.controlWallet).toBe(
      "0x8b88e1e1174edc65b08de75a5439f130da8a3dfd",
    );
    expect(createAgentCapabilityResource(release).manifestHash).toBe(
      release.manifestHash,
    );
    expect(createCompanyTermsResource(permissionSet).permissionHash).toBe(
      permissionSet.permissionHash,
    );
    expect(
      Object.keys(walletResource).some((key) =>
        /private|secret|quorum/i.test(key),
      ),
    ).toBe(false);
  });

  it("requires matching Privy, ENS, generation, hash, and ENS readback for active authority", () => {
    const { installation } = createActiveFixture();
    const activeAuthority = createActiveAuthorityResource({
      installationId: installation.id,
      generation: installation.generation,
      permissionHash: installation.permissionSet.permissionHash,
      privy: installation.privy!,
      ensState: installation.ens!,
      ensReadback: ensReadback(installation),
    });

    expect(activeAuthority.privy.status).toBe("ACTIVE");
    expect(activeAuthority.ens.verified).toBe(true);
    expect(activeAuthority.permissionHash).toBe(
      installation.permissionSet.permissionHash,
    );
    expect(Object.keys(activeAuthority.privy)).not.toContain("ownerQuorum");

    expect(() =>
      createActiveAuthorityResource({
        installationId: installation.id,
        generation: installation.generation + 1,
        permissionHash: installation.permissionSet.permissionHash,
        privy: installation.privy!,
        ensState: installation.ens!,
        ensReadback: ensReadback(installation),
      }),
    ).toThrow(/bindings do not match/);

    expect(() =>
      createEnsIdentityResource({
        state: installation.ens!,
        readback: {
          ...ensReadback(installation),
          records: {
            ...ensReadback(installation).records,
            "kanon.status": "revoked",
          },
        },
      }),
    ).toThrow(/ENS readback/);

    expect(() =>
      createActiveAuthorityResource({
        installationId: installation.id,
        generation: installation.generation,
        permissionHash: installation.permissionSet.permissionHash,
        privy: installation.privy!,
        ensState: { ...installation.ens!, verified: false },
        ensReadback: ensReadback(installation),
      }),
    ).toThrow(/verified ENS/);

    expect(() =>
      createPrivyAuthorityResource({
        ...installation.privy!,
        aggregationId: "unsupported-for-send",
      }),
    ).toThrow(/cannot include aggregationId/);
  });

  it("binds update diffs and revoke resources to their approved records", () => {
    const { installation, release, permissionSet } = createActiveFixture();
    const nextRelease = fixtureRelease("release-t14-expanded", "package-t14");
    const nextPermissionSet = createNormalizedPermissionSet({
      release: nextRelease,
      companyTerms: createCompanyAuthorityTerms({
        rules: [
          {
            chainId: 11155111,
            asset: "native",
            recipient: "0x8B88E1E1174eDC65B08de75A5439f130da8A3DFd",
            maxValueWei: "2",
          },
        ],
      }),
    });
    const diff = diffPermissionSets(permissionSet, nextPermissionSet);
    const proposal = {
      schema: "kanon.update-proposal" as const,
      version: 1 as const,
      release: nextRelease,
      permissionSet: nextPermissionSet,
      classification: diff.classification,
      requiresHumanReview: diff.requiresHumanReview,
    };
    const update = createUpdateDiffResource({
      installationId: installation.id,
      proposal,
      diff,
    });

    expect(update.diff.nextPermissionHash).toBe(
      nextPermissionSet.permissionHash,
    );
    expect(() =>
      createUpdateDiffResource({
        installationId: installation.id,
        proposal: { ...proposal, requiresHumanReview: false },
        diff,
      }),
    ).toThrow(/does not match/);

    const revokeDecision = createHumanDecision({
      id: "decision-t14-revoke",
      action: "REVOKE",
      outcome: "APPROVED",
      decidedBy: "company-owner",
      decidedAt: "2026-09-12T12:10:00.000Z",
      release,
      permissionSet,
    });
    const revokeRequest = createRevokeRequestResource({
      installationId: installation.id,
      decision: revokeDecision,
    });
    const revocation = createRevocationRecord({
      decisionId: revokeDecision.id,
      privyAuthorityRevoked: true,
      postRevokeExecutionFailed: true,
      recordedAt: "2026-09-12T12:11:00.000Z",
    });
    const revoke = createRevokeResource({
      installationId: installation.id,
      status: "REVOKED",
      decisionId: revokeDecision.id,
      revocation,
    });
    const revocationEvidence = createRevocationEvidenceResource(revocation);

    expect(revokeRequest.decision.action).toBe("REVOKE");
    expect(revoke.ensStatus).toBe("revoked");
    expect(revocationEvidence.evidence.ensStatus).toBe("revoked");
    expect(() =>
      createRevokeRequestResource({
        installationId: installation.id,
        decision: { ...revokeDecision, action: "APPROVE" },
      }),
    ).toThrow(/REVOKE/);
  });

  it("builds an active installation resource with evidence and no UI assumptions", () => {
    const { installation } = createActiveFixture();
    const execution = createExecutionEvidence({
      installationId: installation.id,
      generation: installation.generation,
      permissionHash: installation.permissionSet.permissionHash,
      executionMethod: "eth_sendTransaction",
      outcome: "SUCCEEDED",
      transactionHash: "0xabc123",
      recordedAt: "2026-09-12T12:12:00.000Z",
    });
    const resource = createInstallationResource({
      installation,
      ensReadback: ensReadback(installation),
      evidence: [createExecutionEvidenceResource(execution)],
    });

    expect(resource.status).toBe("ACTIVE");
    expect(resource.agent.releaseId).toBe(installation.release.releaseId);
    expect(resource.companyTerms.permissionHash).toBe(
      installation.permissionSet.permissionHash,
    );
    expect(resource.activeAuthority?.ens.records["kanon.status"]).toBe(
      "approved",
    );
    expect(resource.evidence).toHaveLength(1);
    expect(JSON.stringify(resource)).not.toMatch(
      /privateKey|clientSecret|ownerQuorum/,
    );
  });

  it("uses stable success and fail-closed error envelopes", () => {
    const success = createApiSuccess({ ok: true });
    const error = createApiError({
      code: "HUMAN_APPROVAL_REQUIRED",
      message: "Human approval is required",
      requestId: "request-t14",
    });

    expect(success).toEqual({
      schema: "kanon.api.success",
      version: 1,
      data: { ok: true },
    });
    expect(error.code).toBe("HUMAN_APPROVAL_REQUIRED");
    expect(Object.isFrozen(success)).toBe(true);
    expect(Object.isFrozen(error)).toBe(true);
  });
});
