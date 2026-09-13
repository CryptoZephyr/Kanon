import { createAgentRelease } from "../../packages/manifest/src/index.js";
import {
  createCompanyAuthorityTerms,
  createNormalizedPermissionSet,
  type NormalizedPermissionSet,
} from "../../packages/permissions/src/index.js";
import {
  createEnsIdentityBinding,
  type EnsIdentityBinding,
} from "../../packages/ens/src/index.js";
import {
  createEnsRecordState,
  createHumanDecision,
  createInstallation,
  transitionInstallation,
  type Installation,
  type PrivyControlBinding,
} from "../../packages/shared/src/index.js";
import type { AgentRelease } from "../../packages/manifest/src/index.js";

export const FIXTURE_RECIPIENT = "0x8B88E1E1174eDC65B08de75A5439f130da8A3DFd";

export function fixtureRelease(
  releaseId = "release-t8",
  packageContent = "kanon-fixture-package-t8",
): AgentRelease {
  return createAgentRelease({
    agentId: "com.example.treasury",
    releaseId,
    version: releaseId,
    packageContent,
    runtime: { entry: "worker" },
    capabilities: { chains: [11155111], assets: ["native"] },
  });
}

export function fixturePermissionSet(
  release: AgentRelease,
  maxValueWei = "1",
): NormalizedPermissionSet {
  return createNormalizedPermissionSet({
    release,
    companyTerms: createCompanyAuthorityTerms({
      rules: [
        {
          chainId: 11155111,
          asset: "native",
          recipient: FIXTURE_RECIPIENT,
          maxValueWei,
        },
      ],
    }),
  });
}

export function fixtureEnsBinding(): EnsIdentityBinding {
  return createEnsIdentityBinding({
    chainId: 11155111,
    organizationName: "kanon-ethonline-2026.eth",
    namespaceName: "agents.kanon-ethonline-2026.eth",
    agentName: "representative-agent.agents.kanon-ethonline-2026.eth",
    resolver: "0x0D4560DaFEb04Cf022472B5085070A05E0d77e0B",
    controlWallet: "0x8b88E1E1174eDC65B08de75A5439f130da8A3DFd",
  });
}

export function fixturePrivyBinding(
  permissionSet: NormalizedPermissionSet,
  generation = 0,
): PrivyControlBinding {
  return {
    authorityKind: "DELEGATED_SIGNER",
    walletId: "fixture-business-wallet",
    delegatedSignerId: "fixture-agent-signer",
    policyId: "fixture-agent-policy",
    executionMethod: "eth_sendTransaction",
    permissionHash: permissionSet.permissionHash,
    generation,
    status: "ACTIVE",
  };
}

export function fixtureEnsState(
  release: AgentRelease,
  permissionSet: NormalizedPermissionSet,
  overrides: Partial<
    Pick<
      ReturnType<typeof createEnsRecordState>,
      "status" | "verified" | "observedAt"
    >
  > = {},
) {
  return createEnsRecordState({
    binding: fixtureEnsBinding(),
    agentId: release.agentId,
    releaseId: release.releaseId,
    permissionHash: permissionSet.permissionHash,
    status: "approved",
    verified: true,
    observedAt: "2026-09-12T12:00:00.000Z",
    ...overrides,
  });
}

export function createActiveFixture(): {
  readonly installation: Installation;
  readonly release: AgentRelease;
  readonly permissionSet: NormalizedPermissionSet;
} {
  const release = fixtureRelease();
  const permissionSet = fixturePermissionSet(release);
  let installation = createInstallation({
    id: "installation-t8-fixture",
    organizationId: "organization-kanon",
    release,
    permissionSet,
  });
  installation = transitionInstallation(installation, {
    type: "approval_requested",
  });
  const decision = createHumanDecision({
    id: "decision-approve-t8-fixture",
    action: "APPROVE",
    outcome: "APPROVED",
    decidedBy: "company-owner",
    decidedAt: "2026-09-12T12:01:00.000Z",
    release,
    permissionSet,
  });
  installation = transitionInstallation(installation, {
    type: "approval_granted",
    decision,
  });
  installation = transitionInstallation(installation, {
    type: "authority_configured",
    privy: fixturePrivyBinding(permissionSet),
    ens: fixtureEnsState(release, permissionSet),
  });
  return { installation, release, permissionSet };
}
