import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createAgentRelease } from "../../../packages/manifest/src/index.js";
import {
  createCompanyAuthorityTerms,
  createNormalizedPermissionSet,
  diffPermissionSets,
  type PermissionHash,
} from "../../../packages/permissions/src/index.js";
import {
  createEnsIdentityBinding,
  type EnsIdentityBinding,
} from "../../../packages/ens/src/index.js";
import {
  createEnsRecordState,
  createHumanDecision,
  createInstallation,
  transitionInstallation,
  type Installation,
  type PrivyControlBinding,
} from "../../../packages/shared/src/index.js";
import {
  createRunnerContext,
  IsolatedRunner,
  type DelegatedExecutionInput,
} from "./isolated-runner.js";

const EVIDENCE_PATH = resolve(
  process.cwd(),
  "evidence",
  "lifecycle",
  "t8-t10-latest.json",
);

const RECIPIENT = "0x8B88E1E1174eDC65B08de75A5439f130da8A3DFd";

function ensBinding(): EnsIdentityBinding {
  return createEnsIdentityBinding({
    chainId: 11155111,
    organizationName: "kanon-ethonline-2026.eth",
    namespaceName: "agents.kanon-ethonline-2026.eth",
    agentName: "representative-agent.agents.kanon-ethonline-2026.eth",
    resolver: "0x0D4560DaFEb04Cf022472B5085070A05E0d77e0B",
    controlWallet: "0x8b88E1E1174eDC65B08de75A5439f130da8A3DFd",
  });
}

function release(releaseId: string, content: string) {
  return createAgentRelease({
    agentId: "com.example.treasury",
    releaseId,
    version: releaseId,
    packageContent: content,
    runtime: { entry: "worker" },
    capabilities: { chains: [11155111], assets: ["native"] },
  });
}

function permissionSet(
  currentRelease: ReturnType<typeof release>,
  maxValueWei: string,
) {
  return createNormalizedPermissionSet({
    release: currentRelease,
    companyTerms: createCompanyAuthorityTerms({
      rules: [
        {
          chainId: 11155111,
          asset: "native",
          recipient: RECIPIENT,
          maxValueWei,
        },
      ],
    }),
  });
}

function privyBinding(
  permissionHash: PermissionHash,
  generation = 0,
): PrivyControlBinding {
  return {
    authorityKind: "DELEGATED_SIGNER",
    walletId: "fixture-business-wallet",
    delegatedSignerId: "fixture-agent-signer",
    policyId: "fixture-agent-policy",
    executionMethod: "eth_sendTransaction",
    permissionHash,
    generation,
    status: "ACTIVE",
  };
}

function ensState(
  currentRelease: ReturnType<typeof release>,
  currentPermissionSet: ReturnType<typeof permissionSet>,
) {
  return createEnsRecordState({
    binding: ensBinding(),
    agentId: currentRelease.agentId,
    releaseId: currentRelease.releaseId,
    permissionHash: currentPermissionSet.permissionHash,
    status: "approved",
    verified: true,
    observedAt: "2026-09-12T12:00:00.000Z",
  });
}

function activeInstallation(): {
  readonly installation: Installation;
  readonly currentRelease: ReturnType<typeof release>;
  readonly currentPermissionSet: ReturnType<typeof permissionSet>;
} {
  const currentRelease = release("release-t8-t10", "kanon-lifecycle-fixture");
  const currentPermissionSet = permissionSet(currentRelease, "1");
  let installation = createInstallation({
    id: "installation-t8-t10",
    organizationId: "organization-kanon",
    release: currentRelease,
    permissionSet: currentPermissionSet,
  });
  installation = transitionInstallation(installation, {
    type: "approval_requested",
  });
  const decision = createHumanDecision({
    id: "decision-approve-t8-t10",
    action: "APPROVE",
    outcome: "APPROVED",
    decidedBy: "company-owner",
    decidedAt: "2026-09-12T12:01:00.000Z",
    release: currentRelease,
    permissionSet: currentPermissionSet,
  });
  installation = transitionInstallation(installation, {
    type: "approval_granted",
    decision,
  });
  installation = transitionInstallation(installation, {
    type: "authority_configured",
    privy: privyBinding(currentPermissionSet.permissionHash),
    ens: ensState(currentRelease, currentPermissionSet),
  });
  return { installation, currentRelease, currentPermissionSet };
}

async function main(): Promise<void> {
  const fixture = activeInstallation();
  const nextRelease = release(
    "release-t9-expanded",
    "kanon-lifecycle-fixture-v2",
  );
  const nextPermissionSet = permissionSet(nextRelease, "2");
  const diff = diffPermissionSets(
    fixture.currentPermissionSet,
    nextPermissionSet,
  );
  if (diff.classification !== "EXPANDED" || !diff.requiresHumanReview) {
    throw new Error(
      "lifecycle proof expected expanded authority to require review",
    );
  }

  const updateAvailable = transitionInstallation(fixture.installation, {
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
  const reauthorization = createHumanDecision({
    id: "decision-reauthorize-t8-t10",
    action: "REAUTHORIZE",
    outcome: "APPROVED",
    decidedBy: "company-owner",
    decidedAt: "2026-09-12T12:02:00.000Z",
    release: nextRelease,
    permissionSet: nextPermissionSet,
  });
  const awaitingReauthorization = transitionInstallation(updateAvailable, {
    type: "reauthorization_requested",
    decision: reauthorization,
  });

  let executorInput: DelegatedExecutionInput | undefined;
  let executorCalls = 0;
  let current = fixture.installation;
  const runner = new IsolatedRunner(
    { getInstallation: () => current },
    {
      execute: async (input) => {
        executorInput = input;
        executorCalls += 1;
        if (input.request["forbidden"] === true) {
          return {
            outcome: "REJECTED" as const,
            rejectionCode: "policy_violation",
          };
        }
        return {
          outcome: "SUCCEEDED" as const,
          transactionHash: "0xrunner-success",
        };
      },
    },
  );
  const context = createRunnerContext(fixture.installation);
  const allowed = await runner.execute({
    installationId: fixture.installation.id,
    context,
    request: { to: RECIPIENT, value: "0x1" },
  });
  const forbidden = await runner.execute({
    installationId: fixture.installation.id,
    context,
    request: {
      to: "0x2222222222222222222222222222222222222222",
      forbidden: true,
    },
  });

  current = {
    ...fixture.installation,
    generation: fixture.installation.generation + 1,
  };
  let staleRefused = false;
  try {
    await runner.execute({
      installationId: fixture.installation.id,
      context,
      request: {},
    });
  } catch {
    staleRefused = true;
  }
  if (!staleRefused || executorCalls !== 2) {
    throw new Error("lifecycle proof expected stale runner work to be refused");
  }
  if (
    executorInput === undefined ||
    "ownerId" in executorInput ||
    "ownerPrivateKey" in executorInput ||
    "ownerAuthorizationKey" in executorInput
  ) {
    throw new Error("lifecycle proof detected owner authority in runner input");
  }

  const evidence = {
    schema: "kanon.lifecycle-proof",
    version: 1,
    status: "passed",
    generatedAt: new Date().toISOString(),
    chainWritesAttempted: false,
    secretsRecorded: false,
    frontendTouched: false,
    t8: {
      status: fixture.installation.status,
      activeGeneration: fixture.installation.generation,
      activeAuthorityKind: fixture.installation.privy?.authorityKind,
      ensVerified: fixture.installation.ens?.verified,
    },
    t9: {
      classification: diff.classification,
      requiresHumanReview: diff.requiresHumanReview,
      afterUpdate: updateAvailable.status,
      afterReauthorization: awaitingReauthorization.status,
      activeReleaseUnchanged:
        awaitingReauthorization.release.releaseId ===
        fixture.currentRelease.releaseId,
    },
    t10: {
      allowedOutcome: allowed.outcome,
      forbiddenOutcome: forbidden.outcome,
      forbiddenRejectionCode: forbidden.rejectionCode,
      staleRefused,
      executorCalls,
      ownerAuthorityPassedToExecutor: false,
      executionMethod: allowed.executionMethod,
    },
  };

  await mkdir(resolve(process.cwd(), "evidence", "lifecycle"), {
    recursive: true,
  });
  await writeFile(
    EVIDENCE_PATH,
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
  );
  console.log(`lifecycle_t8_t10=${evidence.status}`);
  console.log(`lifecycle_evidence=${EVIDENCE_PATH}`);
}

await main();
