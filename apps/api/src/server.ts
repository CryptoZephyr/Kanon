import { randomUUID, timingSafeEqual } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import {
  assertValidAgentRelease,
  type AgentRelease,
} from "../../../packages/manifest/src/index.js";
import {
  createCompanyAuthorityTerms,
  createNormalizedPermissionSet,
  diffPermissionSets,
  type CompanyAuthorityTermsInput,
  type NormalizedPermissionSet,
} from "../../../packages/permissions/src/index.js";
import {
  createRevokedStatusWritePlan,
  writeRevokedStatus,
} from "../../../packages/ens/src/index.js";
import {
  createApiError,
  createApiSuccess,
  createAgentCapabilityResource,
  createExecutionEvidenceResource,
  createInstallation,
  createInstallationResource,
  createOrganization,
  createOrganizationResource,
  createRevocationEvidenceResource,
  createRevocationRecord,
  createHumanDecision,
  createUpdateDiffResource,
  createWalletResource,
  transitionInstallation,
  type ApiEvidenceResource,
  type ApiErrorCode,
  type Installation,
} from "../../../packages/shared/src/index.js";
import {
  createDeploymentDatabase,
  type DeploymentDatabase,
} from "../../../packages/shared/src/deployment-db.js";
import {
  cleanupRevokedAuthority,
  configureLiveAuthority,
  createReleaseFromInput,
  readLiveWallet,
  readVerifiedEnsState,
  revokeLiveAuthority,
} from "./authority-service.js";
import { runLifecycleProof } from "../../runner/src/lifecycle-t11-t13-probe.js";
import { createRunnerContext } from "../../runner/src/isolated-runner.js";

const PORT = parsePort(process.env.PORT);
const COMPANY_TOKEN = requiredEnvironment("KANON_COMPANY_API_TOKEN");
const RUNNER_BASE_URL = requiredEnvironment("RUNNER_BASE_URL");
const RUNNER_SHARED_SECRET = requiredEnvironment("RUNNER_SHARED_SECRET");
const ORGANIZATION_ID = "organization-kanon";
const ORGANIZATION = createOrganization({
  id: ORGANIZATION_ID,
  name: "Kanon",
  controlWallet: "0x8b88E1E1174eDC65B08de75A5439f130da8A3DFd",
  ensNamespace: "agents.kanon-ethonline-2026.eth",
});

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`${name} is required`);
  }
  return value;
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? "8080");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new TypeError("PORT must be a valid TCP port");
  }
  return port;
}

function safeErrorCode(error: unknown): string {
  if (error instanceof Error && error.name.length > 0) {
    return error.name.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 80);
  }
  return "PROOF_FAILED";
}

function sendJson(
  response: ServerResponse,
  status: number,
  payload: unknown,
): void {
  const body = JSON.stringify(payload);
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(body);
}

function requestId(request: IncomingMessage): string {
  const value = request.headers["x-request-id"];
  return typeof value === "string" && value.length > 0 ? value : randomUUID();
}

function companyAuthorized(request: IncomingMessage): boolean {
  const value = request.headers["x-kanon-company-token"];
  if (typeof value !== "string") return false;
  const expected = Buffer.from(COMPANY_TOKEN, "utf8");
  const received = Buffer.from(value, "utf8");
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.length;
    if (length > 1_000_000) throw new Error("request body is too large");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new Error("request body must be valid JSON");
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringField(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value.length === 0
  ) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function bodyRecord(value: unknown): Record<string, unknown> {
  if (!record(value)) throw new Error("request body must be a JSON object");
  return value;
}

function verifyEnvelope(body: Record<string, unknown>, schema: string): void {
  if (body.schema !== schema || body.version !== 1) {
    throw new Error(`request must use ${schema} version 1`);
  }
}

function fail(
  response: ServerResponse,
  status: number,
  code: ApiErrorCode,
  message: string,
  id: string,
  details?: Readonly<Record<string, string>>,
): void {
  sendJson(
    response,
    status,
    createApiError({ code, message, requestId: id, details }),
  );
}

function organizationResource(): ReturnType<typeof createOrganizationResource> {
  return createOrganizationResource(ORGANIZATION);
}

function assertOrganization(organizationId: string): void {
  if (organizationId !== ORGANIZATION_ID) {
    throw new ResourceError("organization was not found", "NOT_FOUND", 404);
  }
}

class ResourceError extends Error {
  public constructor(
    message: string,
    public readonly code: ApiErrorCode,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ResourceError";
  }
}

function evidenceResource(value: unknown): ApiEvidenceResource {
  if (
    record(value) &&
    value.schema === "kanon.execution-evidence" &&
    value.version === 1
  ) {
    return createExecutionEvidenceResource(value as never);
  }
  if (
    record(value) &&
    value.schema === "kanon.revocation-record" &&
    value.version === 1
  ) {
    return createRevocationEvidenceResource(value as never);
  }
  throw new Error("stored installation evidence has an unsupported schema");
}

function ensReadback(state: {
  readonly binding: NonNullable<Installation["ens"]>["binding"];
  readonly agentId: string;
  readonly releaseId: string;
  readonly permissionHash: string;
  readonly status: "approved" | "active" | "revoked";
}) {
  return {
    binding: state.binding,
    resolver: state.binding.resolver,
    records: {
      "kanon.agentId": state.agentId,
      "kanon.release": state.releaseId,
      "kanon.permissionHash": state.permissionHash,
      "kanon.status": state.status,
    },
  };
}

async function installationResource(
  database: DeploymentDatabase,
  installation: Installation,
) {
  const evidence = (await database.getEvidence(installation.id)).map(
    evidenceResource,
  );
  const pendingDiff = installation.pendingUpdate
    ? diffPermissionSets(
        installation.permissionSet,
        installation.pendingUpdate.permissionSet,
      )
    : undefined;
  if (installation.status !== "ACTIVE") {
    return createInstallationResource({
      installation,
      ...(pendingDiff === undefined ? {} : { pendingDiff }),
      evidence,
    });
  }
  const observedEns = await readVerifiedEnsState(installation);
  const checkedInstallation = { ...installation, ens: observedEns };
  return createInstallationResource({
    installation: checkedInstallation,
    ensReadback: ensReadback(observedEns),
    evidence,
  });
}

async function saveAndRenderInstallation(
  database: DeploymentDatabase,
  installation: Installation,
) {
  await database.saveInstallation(installation);
  if (installation.status === "ACTIVE" && installation.ens) {
    const evidence = (await database.getEvidence(installation.id)).map(
      evidenceResource,
    );
    return createInstallationResource({
      installation,
      ensReadback: ensReadback(installation.ens),
      evidence,
    });
  }
  return installationResource(database, installation);
}

async function parseDecision(
  body: Record<string, unknown>,
  release: AgentRelease,
  permissionSet: NormalizedPermissionSet,
) {
  const decision = bodyRecord(body.decision);
  return createHumanDecision({
    id: stringField(decision, "id"),
    action: decision.action as "APPROVE" | "REJECT" | "REAUTHORIZE" | "REVOKE",
    outcome: decision.outcome as "APPROVED" | "REJECTED",
    decidedBy: stringField(decision, "decidedBy"),
    decidedAt: stringField(decision, "decidedAt"),
    release,
    permissionSet,
  });
}

let proofInFlight = false;
const authorityOperations = new Map<string, Promise<void>>();

function startAuthorityOperation(
  database: DeploymentDatabase,
  configuring: Installation,
): void {
  if (authorityOperations.has(configuring.id)) return;
  const operation = (async (): Promise<void> => {
    const authority = await configureLiveAuthority(configuring);
    const active = transitionInstallation(configuring, {
      type: "authority_configured",
      privy: authority.privy,
      ens: authority.ens,
      ...(configuring.status === "AWAITING_REAUTHORIZATION"
        ? {
            release: configuring.pendingUpdate!.release,
            permissionSet: configuring.pendingUpdate!.permissionSet,
          }
        : {}),
    });
    await database.saveInstallation(active);
  })().finally(() => {
    authorityOperations.delete(configuring.id);
  });
  authorityOperations.set(configuring.id, operation);
  void operation.catch((error: unknown) => {
    console.error(`kanon_authority_operation_failed=${safeErrorCode(error)}`);
  });
}

async function runProof(
  database: DeploymentDatabase,
  runId: string,
): Promise<void> {
  const runningProof = {
    schema: "kanon.deployment-proof",
    version: 1,
    runId,
    status: "running" as const,
    startedAt: new Date().toISOString(),
    frontendTouched: false,
    mainnetWrite: false,
  };
  await database.saveProof(runId, "running", runningProof);
  try {
    const lifecycle = await runLifecycleProof({
      runnerBaseUrl: RUNNER_BASE_URL,
      runnerSharedSecret: RUNNER_SHARED_SECRET,
      persistInstallation: (installation) =>
        database.saveInstallation(installation),
    });
    await database.saveProof(runId, "passed", {
      ...runningProof,
      status: "passed" as const,
      completedAt: new Date().toISOString(),
      lifecycle,
      databaseMigrations: true,
      runnerServiceUsed: true,
      privyAndEns: "live" as const,
    });
  } catch (error) {
    await database.saveProof(runId, "failed", {
      ...runningProof,
      status: "failed" as const,
      completedAt: new Date().toISOString(),
      failureCode: safeErrorCode(error),
      databaseMigrations: true,
      runnerServiceUsed: true,
      privyAndEns: "not-verified" as const,
    });
  } finally {
    proofInFlight = false;
  }
}

async function assertRunnerRejected(installation: Installation): Promise<void> {
  const context = createRunnerContext(installation);
  const response = await fetch(
    `${RUNNER_BASE_URL.replace(/\/$/, "")}/internal/execute`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-runner-shared-secret": RUNNER_SHARED_SECRET,
      },
      body: JSON.stringify({
        installationId: installation.id,
        context,
        request: { to: installation.ens?.binding.controlWallet, valueWei: "1" },
      }),
      signal: AbortSignal.timeout(90_000),
    },
  );
  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (
    response.status === 409 &&
    record(payload) &&
    payload.code === "RUNNER_REFUSED_STALE_OR_REVOKED"
  ) {
    return;
  }
  if (response.ok && record(payload) && record(payload.evidence)) {
    if (payload.evidence.outcome === "REJECTED") return;
  }
  throw new Error("post-revoke delegated execution was not rejected");
}

async function handleOrganizationRequest(
  request: IncomingMessage,
  response: ServerResponse,
  database: DeploymentDatabase,
  url: URL,
  id: string,
): Promise<void> {
  if (!companyAuthorized(request)) {
    fail(
      response,
      401,
      "UNAUTHORIZED",
      "company authorization is required",
      id,
    );
    return;
  }

  const organizationMatch = url.pathname.match(
    /^\/v1\/organizations\/([^/]+)(?:\/(.*))?$/,
  );
  if (!organizationMatch) {
    fail(response, 404, "NOT_FOUND", "resource was not found", id);
    return;
  }
  const organizationId = decodeURIComponent(organizationMatch[1]);
  assertOrganization(organizationId);
  const tail = organizationMatch[2] ?? "";

  if (request.method === "GET" && tail === "") {
    sendJson(response, 200, createApiSuccess(organizationResource()));
    return;
  }

  if (request.method === "GET" && tail === "wallet") {
    const wallet = await readLiveWallet();
    sendJson(
      response,
      200,
      createApiSuccess(
        createWalletResource({
          walletId: wallet.walletId,
          address: wallet.address,
          chainId: wallet.chainId,
          asset: "native",
          status: wallet.status,
        }),
      ),
    );
    return;
  }

  const releaseMatch = tail.match(/^agents\/([^/]+)\/releases$/);
  if (request.method === "POST" && releaseMatch) {
    const agentId = decodeURIComponent(releaseMatch[1]);
    const body = bodyRecord(await readBody(request));
    verifyEnvelope(body, "kanon.api.publish-release");
    if (body.organizationId !== organizationId) {
      throw new Error("organizationId does not match the URL");
    }
    const release = await createReleaseFromInput({
      agentId,
      release: body.release as AgentRelease,
    });
    assertValidAgentRelease(release);
    const current = await database.findInstallationByAgent(
      organizationId,
      agentId,
    );
    const installationId = current?.id ?? `installation-${release.releaseId}`;
    await database.saveRelease(release, installationId);
    sendJson(
      response,
      200,
      createApiSuccess(createAgentCapabilityResource(release)),
    );
    return;
  }

  const agentMatch = tail.match(/^agents\/([^/]+)$/);
  if (request.method === "GET" && agentMatch) {
    const agentId = decodeURIComponent(agentMatch[1]);
    const release = await database.findReleaseByAgent(agentId);
    if (!release)
      throw new ResourceError("agent was not found", "NOT_FOUND", 404);
    sendJson(
      response,
      200,
      createApiSuccess(createAgentCapabilityResource(release)),
    );
    return;
  }

  const installationMatch = tail.match(
    /^installations\/([^/]+)(?:\/(company-terms|approval|update-diff|evidence|revoke))?$/,
  );
  if (!installationMatch) {
    fail(response, 404, "NOT_FOUND", "resource was not found", id);
    return;
  }
  const installationId = decodeURIComponent(installationMatch[1]);
  const operation = installationMatch[2];

  if (request.method === "GET" && operation === undefined) {
    const installation = await database.getInstallation(installationId);
    if (!installation)
      throw new ResourceError("installation was not found", "NOT_FOUND", 404);
    sendJson(
      response,
      200,
      createApiSuccess(await installationResource(database, installation)),
    );
    return;
  }

  if (request.method === "POST" && operation === "company-terms") {
    const body = bodyRecord(await readBody(request));
    verifyEnvelope(body, "kanon.api.define-company-terms");
    if (body.installationId !== installationId) {
      throw new Error("installationId does not match the URL");
    }
    const release = await database.getReleaseForInstallation(installationId);
    if (!release)
      throw new ResourceError(
        "release was not found for installation",
        "NOT_FOUND",
        404,
      );
    const rawTerms = bodyRecord(
      body.companyTerms,
    ) as unknown as CompanyAuthorityTermsInput;
    const companyTerms = createCompanyAuthorityTerms(rawTerms);
    const permissionSet = createNormalizedPermissionSet({
      release,
      companyTerms,
    });
    const existing = await database.getInstallation(installationId);
    if (!existing) {
      let installation = createInstallation({
        id: installationId,
        organizationId,
        release,
        permissionSet,
      });
      installation = transitionInstallation(installation, {
        type: "approval_requested",
      });
      sendJson(
        response,
        200,
        createApiSuccess(
          await saveAndRenderInstallation(database, installation),
        ),
      );
      return;
    }
    if (existing.status === "REVOKED") {
      throw new ResourceError(
        "revoked authority cannot be edited",
        "REVOKED",
        409,
      );
    }
    if (existing.status !== "ACTIVE") {
      throw new ResourceError(
        `company terms cannot be changed while installation is ${existing.status}`,
        "CONFLICT",
        409,
      );
    }
    const diff = diffPermissionSets(existing.permissionSet, permissionSet);
    if (diff.classification === "NO_CHANGE") {
      throw new ResourceError("company terms did not change", "CONFLICT", 409);
    }
    const pending = transitionInstallation(existing, {
      type: "update_available",
      proposal: {
        schema: "kanon.update-proposal",
        version: 1,
        release,
        permissionSet,
        classification: diff.classification,
        requiresHumanReview: diff.requiresHumanReview,
      },
    });
    sendJson(
      response,
      200,
      createApiSuccess(await saveAndRenderInstallation(database, pending)),
    );
    return;
  }

  if (request.method === "GET" && operation === "update-diff") {
    const installation = await database.getInstallation(installationId);
    if (!installation?.pendingUpdate) {
      throw new ResourceError("no pending update was found", "NOT_FOUND", 404);
    }
    const diff = diffPermissionSets(
      installation.permissionSet,
      installation.pendingUpdate.permissionSet,
    );
    sendJson(
      response,
      200,
      createApiSuccess(
        createUpdateDiffResource({
          installationId: installation.id,
          proposal: installation.pendingUpdate,
          diff,
        }),
      ),
    );
    return;
  }

  if (request.method === "GET" && operation === "evidence") {
    const installation = await database.getInstallation(installationId);
    if (!installation)
      throw new ResourceError("installation was not found", "NOT_FOUND", 404);
    sendJson(
      response,
      200,
      createApiSuccess(
        (await database.getEvidence(installation.id)).map(evidenceResource),
      ),
    );
    return;
  }

  if (request.method === "POST" && operation === "approval") {
    const body = bodyRecord(await readBody(request));
    verifyEnvelope(body, "kanon.api.record-approval");
    if (body.installationId !== installationId) {
      throw new Error("installationId does not match the URL");
    }
    const existing = await database.getInstallation(installationId);
    if (!existing)
      throw new ResourceError("installation was not found", "NOT_FOUND", 404);
    const isReauthorization =
      existing.status === "UPDATE_AVAILABLE" ||
      existing.status === "AWAITING_REAUTHORIZATION";
    const targetRelease = isReauthorization
      ? existing.pendingUpdate?.release
      : existing.release;
    const targetPermissionSet = isReauthorization
      ? existing.pendingUpdate?.permissionSet
      : existing.permissionSet;
    if (!targetRelease || !targetPermissionSet) {
      throw new ResourceError("approval target is incomplete", "CONFLICT", 409);
    }
    const decision = await parseDecision(
      body,
      targetRelease,
      targetPermissionSet,
    );
    let configuring = existing;
    if (existing.status === "AWAITING_APPROVAL") {
      configuring = transitionInstallation(existing, {
        type: "approval_granted",
        decision,
      });
      await database.saveInstallation(configuring);
    } else if (existing.status === "UPDATE_AVAILABLE") {
      configuring = transitionInstallation(existing, {
        type: "reauthorization_requested",
        decision,
      });
      await database.saveInstallation(configuring);
    } else if (
      existing.status !== "CONFIGURING_AUTHORITY" &&
      existing.status !== "AWAITING_REAUTHORIZATION"
    ) {
      throw new ResourceError(
        `approval cannot be recorded while installation is ${existing.status}`,
        existing.status === "REVOKED" ? "REVOKED" : "CONFLICT",
        409,
      );
    }
    startAuthorityOperation(database, configuring);
    sendJson(
      response,
      202,
      createApiSuccess(await installationResource(database, configuring)),
    );
    return;
  }

  if (request.method === "POST" && operation === "revoke") {
    const body = bodyRecord(await readBody(request));
    verifyEnvelope(body, "kanon.api.revoke-request");
    if (body.installationId !== installationId) {
      throw new Error("installationId does not match the URL");
    }
    const existing = await database.getInstallation(installationId);
    if (!existing)
      throw new ResourceError("installation was not found", "NOT_FOUND", 404);
    if (existing.status !== "ACTIVE") {
      throw new ResourceError(
        `revocation requires an active installation, got ${existing.status}`,
        existing.status === "REVOKED" ? "REVOKED" : "CONFLICT",
        409,
      );
    }
    const decision = await parseDecision(
      body,
      existing.release,
      existing.permissionSet,
    );
    const revoking = transitionInstallation(existing, {
      type: "revoke_requested",
      decision,
    });
    await database.saveInstallation(revoking);
    const revokedPrivy = await revokeLiveAuthority(existing);
    await assertRunnerRejected(existing);
    const ens = await readVerifiedEnsState(existing);
    const ensRuntime = await import(
      "../../runner/src/lifecycle-t11-t13-probe.js"
    ).then((module) => module.createEnsRuntime());
    const revokePlan = createRevokedStatusWritePlan({
      binding: ens.binding,
      current: {
        agentId: existing.release.agentId,
        releaseId: existing.release.releaseId,
        permissionHash: existing.permissionSet.permissionHash,
        status: ens.status,
      },
      privyAuthority: "REVOKED",
    });
    await writeRevokedStatus(ensRuntime.revocationWriter, revokePlan);
    const revokedState = {
      ...ens,
      status: "revoked" as const,
      observedAt: new Date().toISOString(),
    };
    const revocation = createRevocationRecord({
      decisionId: decision.id,
      privyAuthorityRevoked: true,
      postRevokeExecutionFailed: true,
      recordedAt: new Date().toISOString(),
    });
    const completed = transitionInstallation(revoking, {
      type: "revocation_completed",
      decision,
      revocation,
    });
    await database.saveEvidence(installationId, revocation);
    const finalInstallation = { ...completed, ens: revokedState };
    await database.saveInstallation(finalInstallation);
    try {
      await cleanupRevokedAuthority(revokedPrivy);
    } catch {
      // The delegated signer is already removed. Orphaned policy metadata is not executable.
    }
    sendJson(
      response,
      200,
      createApiSuccess(await installationResource(database, finalInstallation)),
    );
    return;
  }

  fail(response, 404, "NOT_FOUND", "resource was not found", id);
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  database: DeploymentDatabase,
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://kanon.local");
  const id = requestId(request);

  if (request.method === "GET" && url.pathname === "/healthz") {
    try {
      await database.pool.query("SELECT 1");
      sendJson(response, 200, {
        schema: "kanon.api.health",
        version: 1,
        status: "ok",
        service: "api",
        database: "ok",
        requestId: id,
      });
    } catch {
      sendJson(response, 503, {
        schema: "kanon.api.health",
        version: 1,
        status: "degraded",
        service: "api",
        database: "unavailable",
        requestId: id,
      });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/readyz") {
    try {
      await database.pool.query("SELECT 1");
      sendJson(response, 200, { status: "ready", requestId: id });
    } catch {
      sendJson(response, 503, { status: "not-ready", requestId: id });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/v1/proof/latest") {
    const proof = await database.getLatestProof();
    sendJson(response, proof === undefined ? 404 : 200, {
      schema: "kanon.api.proof",
      version: 1,
      proof: proof ?? null,
      requestId: id,
    });
    return;
  }

  const runMatch = url.pathname.match(/^\/v1\/proof\/runs\/([^/]+)$/);
  if (request.method === "GET" && runMatch) {
    const proof = await database.getProof(runMatch[1]);
    sendJson(response, proof === undefined ? 404 : 200, {
      schema: "kanon.api.proof",
      version: 1,
      proof: proof ?? null,
      requestId: id,
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/v1/proof/run") {
    if (!companyAuthorized(request)) {
      fail(
        response,
        401,
        "UNAUTHORIZED",
        "company authorization is required",
        id,
      );
      return;
    }
    try {
      await readBody(request);
    } catch {
      fail(
        response,
        400,
        "INVALID_REQUEST",
        "request body must be valid JSON",
        id,
      );
      return;
    }
    if (proofInFlight) {
      fail(response, 409, "CONFLICT", "proof is already running", id);
      return;
    }
    proofInFlight = true;
    const runId = randomUUID();
    void runProof(database, runId);
    sendJson(response, 202, {
      schema: "kanon.api.proof-started",
      version: 1,
      status: "running",
      runId,
      requestId: id,
    });
    return;
  }

  if (url.pathname.startsWith("/v1/organizations/")) {
    await handleOrganizationRequest(request, response, database, url, id);
    return;
  }

  fail(response, 404, "NOT_FOUND", "resource was not found", id);
}

async function main(): Promise<void> {
  const database = createDeploymentDatabase();
  await database.migrate();
  const server = createServer((request, response) => {
    void handleRequest(request, response, database).catch((error: unknown) => {
      if (error instanceof ResourceError) {
        fail(
          response,
          error.status,
          error.code,
          error.message,
          requestId(request),
        );
        return;
      }
      const unsupported =
        error instanceof Error &&
        error.name === "UnsupportedPolicyCombinationError";
      fail(
        response,
        unsupported ? 422 : 400,
        unsupported ? "UNSUPPORTED_POLICY_COMBINATION" : "INVALID_REQUEST",
        error instanceof Error
          ? error.message
          : "request could not be completed",
        requestId(request),
      );
    });
  });
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`kanon_api_listening=${PORT}`);
  });
  const shutdown = (): void => {
    server.close(() => {
      void database.close();
    });
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

await main();
