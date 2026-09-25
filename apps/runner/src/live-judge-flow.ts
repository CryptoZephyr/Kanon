import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const EVIDENCE_PATH = resolve(
  process.cwd(),
  "evidence",
  "3rd-web-hack",
  "live-judge-flow-latest.json",
);

const ORGANIZATION_ID = "organization-kanon";
const AGENT_ID = "com.example.treasury";
const CONTROL_WALLET = "0x8b88e1e1174edc65b08de75a5439f130da8a3dfd";

function smokeBaseUrl(): string {
  const flagIndex = process.argv.indexOf("--base");
  const flagValue = flagIndex >= 0 ? process.argv[flagIndex + 1] : undefined;
  const raw =
    flagValue ??
    process.env.KANON_SMOKE_BASE_URL ??
    "https://kanon-agents.vercel.app/api";
  return raw.replace(/\/$/, "");
}

const DRY_RUN = process.argv.includes("--dry-run");
const BASE_URL = smokeBaseUrl();

function fail(message: string): never {
  throw new Error(`live judge flow failed: ${message}`);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function api<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  timeoutMs = 120_000,
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    const code = record(payload) ? String(payload.code ?? "") : "";
    const message = record(payload) ? String(payload.message ?? "") : "";
    fail(
      `${method} ${path} returned HTTP ${response.status} ${code} ${message}`.trim(),
    );
  }
  if (record(payload) && payload.schema === "kanon.api.success") {
    return payload.data as T;
  }
  return payload as T;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function step(name: string): void {
  console.log(`live_judge_step=${name}`);
}

interface Installation {
  readonly id: string;
  readonly status: string;
  readonly generation: number;
  readonly companyTerms: {
    readonly permissionHash: string;
    readonly companyTerms: {
      readonly authority: {
        readonly rules: readonly {
          readonly recipient: string;
          readonly maxValueWei: string;
        }[];
      };
    };
  };
  readonly agent: {
    readonly releaseId: string;
  };
  readonly activeAuthority?: {
    readonly permissionHash: string;
    readonly privy: { readonly status: string };
    readonly ens: {
      readonly verified: boolean;
      readonly records: Record<string, string>;
    };
  };
  readonly updateDiff?: {
    readonly proposal: {
      readonly classification: string;
      readonly requiresHumanReview: boolean;
    };
    readonly diff: {
      readonly classification: string;
      readonly nextPermissionHash: string;
      readonly changedPaths: readonly string[];
    };
  };
  readonly revoke?: {
    readonly status: string;
    readonly privyAuthorityRevoked: boolean;
    readonly ensStatus: string;
    readonly postRevokeExecutionFailed: boolean;
  };
  readonly evidence: readonly {
    readonly schema: string;
    readonly evidence: Record<string, unknown>;
  }[];
}

function releaseId(): string {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const random = Math.random().toString(36).slice(2, 8);
  return `release-3wh-${day}-${random}`;
}

function termsBody(
  installationId: string,
  maxValueWei: string,
  rollingMaxWei: string,
  windowSeconds: number,
) {
  return {
    schema: "kanon.api.define-company-terms",
    version: 1,
    installationId,
    companyTerms: {
      rules: [
        {
          chainId: 11155111,
          asset: "native",
          recipient: CONTROL_WALLET,
          maxValueWei,
          rollingSpend: {
            maxValueWei: rollingMaxWei,
            windowSeconds,
          },
        },
      ],
    },
  };
}

function decisionBody(installationId: string, action: string, id: string) {
  return {
    schema: "kanon.api.record-approval",
    version: 1,
    installationId,
    decision: {
      id,
      action,
      outcome: "APPROVED",
      decidedBy: "live-judge-flow",
      decidedAt: new Date().toISOString(),
    },
  };
}

function executions(
  installation: Installation,
): readonly Record<string, unknown>[] {
  return installation.evidence
    .filter((entry) => entry.schema === "kanon.api.execution-evidence")
    .map((entry) => entry.evidence);
}

async function waitForStatus(
  installationId: string,
  expected: readonly string[],
  deadlineMs: number,
): Promise<Installation> {
  const deadline = Date.now() + deadlineMs;
  let current = await api<Installation>(
    "GET",
    `/v1/organizations/${ORGANIZATION_ID}/installations/${encodeURIComponent(installationId)}`,
  );
  while (
    !expected.includes(current.status) ||
    current.status === "AWAITING_REAUTHORIZATION" ||
    current.status === "CONFIGURING_AUTHORITY"
  ) {
    if (
      ["UPDATE_AVAILABLE", "REVOKED"].includes(current.status) &&
      expected.includes(current.status)
    ) {
      return current;
    }
    if (Date.now() > deadline) {
      fail(
        `installation ${installationId} stayed ${current.status} past the deadline (expected ${expected.join("/")})`,
      );
    }
    if (
      !["CONFIGURING_AUTHORITY", "AWAITING_REAUTHORIZATION"].includes(
        current.status,
      ) &&
      !expected.includes(current.status)
    ) {
      fail(
        `installation ${installationId} became ${current.status}, expected ${expected.join("/")}`,
      );
    }
    await sleep(3_000);
    current = await api<Installation>(
      "GET",
      `/v1/organizations/${ORGANIZATION_ID}/installations/${encodeURIComponent(installationId)}`,
    );
  }
  return current;
}

async function main(): Promise<void> {
  const evidence: Record<string, unknown> = {
    schema: "kanon.live-judge-flow",
    version: 1,
    baseUrl: BASE_URL,
    startedAt: new Date().toISOString(),
    dryRun: DRY_RUN,
    steps: [] as string[],
  };
  const steps = evidence.steps as string[];
  const mark = (name: string): void => {
    steps.push(name);
    step(name);
  };

  step("status");
  const status = await api<Record<string, unknown>>("GET", "/v1/status");
  if (status.schema !== "kanon.api.status" || status.api !== "ok") {
    fail("status endpoint did not report api ok");
  }
  evidence.status = status;
  mark("status");

  if (DRY_RUN) {
    evidence.completedAt = new Date().toISOString();
    await mkdir(dirname(EVIDENCE_PATH), { recursive: true });
    await writeFile(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(`live_judge_flow=dry-run evidence=${EVIDENCE_PATH}`);
    return;
  }

  const v1 = releaseId();
  const installationId = `installation-${v1}`;

  step("publish v1");
  await api(
    "POST",
    `/v1/organizations/${ORGANIZATION_ID}/agents/${AGENT_ID}/releases`,
    {
      schema: "kanon.api.publish-release",
      version: 1,
      organizationId: ORGANIZATION_ID,
      installationId,
      release: {
        releaseId: v1,
        version: "1.0.0",
        packageContent: `kanon-3wh-${v1}`,
        runtime: { entry: "worker" },
        capabilities: {
          transactions: [
            {
              method: "eth_sendTransaction",
              assets: ["native"],
              chains: [11155111],
            },
          ],
        },
      },
    },
  );
  mark("publish-v1");
  evidence.installationId = installationId;
  evidence.releaseV1 = v1;

  step("define terms v1");
  let installation = await api<Installation>(
    "POST",
    `/v1/organizations/${ORGANIZATION_ID}/installations/${encodeURIComponent(installationId)}/company-terms`,
    termsBody(installationId, "1", "1", 3600),
  );
  const permissionHashV1 = installation.companyTerms.permissionHash;
  evidence.permissionHashV1 = permissionHashV1;
  mark("terms-v1");

  step("approve + activate");
  await api(
    "POST",
    `/v1/organizations/${ORGANIZATION_ID}/installations/${encodeURIComponent(installationId)}/approval`,
    decisionBody(installationId, "APPROVE", `decision-${v1}-approve`),
  );
  installation = await waitForStatus(installationId, ["ACTIVE"], 240_000);
  if (installation.status !== "ACTIVE") {
    fail("installation did not reach ACTIVE");
  }
  mark("approved-active");

  step("verify ENS records");
  const ens = installation.activeAuthority?.ens;
  if (!ens?.verified) {
    fail("active installation has no verified ENS readback");
  }
  if (
    ens.records["kanon.permissionHash"] !== permissionHashV1 ||
    ens.records["kanon.release"] !== v1 ||
    ens.records["kanon.agentId"] !== AGENT_ID ||
    !["approved", "active"].includes(ens.records["kanon.status"] ?? "")
  ) {
    fail(
      `ENS records do not match the approved boundary: ${JSON.stringify(ens.records)}`,
    );
  }
  evidence.ensRecordsV1 = ens.records;
  mark("ens-verified");

  step("allowed execution");
  installation = await api<Installation>(
    "POST",
    `/v1/organizations/${ORGANIZATION_ID}/installations/${encodeURIComponent(installationId)}/executions`,
    {
      schema: "kanon.api.execution-request",
      version: 1,
      installationId,
      scenario: "ALLOWED",
    },
  );
  const allowed = executions(installation).at(-1);
  if (
    allowed?.outcome !== "SUCCEEDED" ||
    typeof allowed.transactionHash !== "string"
  ) {
    fail(`allowed execution did not succeed: ${JSON.stringify(allowed)}`);
  }
  evidence.allowedTransactionHash = allowed.transactionHash;
  mark("allowed-succeeded");

  step("forbidden execution");
  installation = await api<Installation>(
    "POST",
    `/v1/organizations/${ORGANIZATION_ID}/installations/${encodeURIComponent(installationId)}/executions`,
    {
      schema: "kanon.api.execution-request",
      version: 1,
      installationId,
      scenario: "FORBIDDEN",
    },
  );
  const forbidden = executions(installation).at(-1);
  if (
    forbidden?.outcome !== "REJECTED" ||
    typeof forbidden.rejectionCode !== "string"
  ) {
    fail(`forbidden execution was not rejected: ${JSON.stringify(forbidden)}`);
  }
  evidence.forbiddenRejectionCode = forbidden.rejectionCode;
  mark("forbidden-rejected");

  step("publish v2 + expanded terms");
  const v2 = `${v1}-v2`;
  await api(
    "POST",
    `/v1/organizations/${ORGANIZATION_ID}/agents/${AGENT_ID}/releases`,
    {
      schema: "kanon.api.publish-release",
      version: 1,
      organizationId: ORGANIZATION_ID,
      installationId,
      release: {
        releaseId: v2,
        version: "2.0.0",
        packageContent: `kanon-3wh-${v2}`,
        runtime: { entry: "worker" },
        capabilities: {
          transactions: [
            {
              method: "eth_sendTransaction",
              assets: ["native"],
              chains: [11155111],
            },
          ],
        },
      },
    },
  );
  installation = await api<Installation>(
    "POST",
    `/v1/organizations/${ORGANIZATION_ID}/installations/${encodeURIComponent(installationId)}/company-terms`,
    termsBody(installationId, "2", "2", 3600),
  );
  if (installation.status !== "UPDATE_AVAILABLE") {
    fail(
      `expanded terms produced ${installation.status}, expected UPDATE_AVAILABLE`,
    );
  }
  const classification = installation.updateDiff?.proposal.classification;
  const requiresHumanReview =
    installation.updateDiff?.proposal.requiresHumanReview;
  if (classification !== "EXPANDED" || requiresHumanReview !== true) {
    fail(
      `expanded release classification mismatch: ${classification} requiresHumanReview=${requiresHumanReview}`,
    );
  }
  evidence.classification = classification;
  evidence.changedPaths = installation.updateDiff?.diff.changedPaths;
  mark("expanded-blocked");

  step("reauthorize");
  await api(
    "POST",
    `/v1/organizations/${ORGANIZATION_ID}/installations/${encodeURIComponent(installationId)}/approval`,
    decisionBody(installationId, "REAUTHORIZE", `decision-${v2}-reauthorize`),
  );
  installation = await waitForStatus(installationId, ["ACTIVE"], 240_000);
  if (installation.status !== "ACTIVE" || installation.generation !== 1) {
    fail(
      `reauthorization ended at status=${installation.status} generation=${installation.generation}`,
    );
  }
  mark("reauthorized-generation-1");

  step("revoke");
  installation = await api<Installation>(
    "POST",
    `/v1/organizations/${ORGANIZATION_ID}/installations/${encodeURIComponent(installationId)}/revoke`,
    {
      schema: "kanon.api.revoke-request",
      version: 1,
      installationId,
      decision: {
        id: `decision-${v2}-revoke`,
        action: "REVOKE",
        outcome: "APPROVED",
        decidedBy: "live-judge-flow",
        decidedAt: new Date().toISOString(),
      },
    },
  );
  if (installation.status !== "REVOKED") {
    fail(`revoke ended at ${installation.status}`);
  }
  const revoke = installation.revoke;
  if (
    !revoke?.privyAuthorityRevoked ||
    !revoke.postRevokeExecutionFailed ||
    revoke.ensStatus !== "revoked"
  ) {
    fail(`revocation evidence incomplete: ${JSON.stringify(revoke)}`);
  }
  evidence.revocation = revoke;
  mark("revoked");

  step("post-revoke execution attempt");
  installation = await api<Installation>(
    "POST",
    `/v1/organizations/${ORGANIZATION_ID}/installations/${encodeURIComponent(installationId)}/executions`,
    {
      schema: "kanon.api.execution-request",
      version: 1,
      installationId,
      scenario: "ALLOWED",
    },
  );
  const postRevoke = executions(installation).at(-1);
  if (
    postRevoke?.outcome !== "REJECTED" ||
    typeof postRevoke.rejectionCode !== "string"
  ) {
    fail(
      `post-revoke execution was not rejected: ${JSON.stringify(postRevoke)}`,
    );
  }
  evidence.postRevokeRejectionCode = postRevoke.rejectionCode;
  mark("post-revoke-rejected");

  evidence.status = "passed";
  evidence.completedAt = new Date().toISOString();
  await mkdir(dirname(EVIDENCE_PATH), { recursive: true });
  await writeFile(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`live_judge_flow=passed evidence=${EVIDENCE_PATH}`);
}

await main();
