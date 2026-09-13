import { randomUUID, timingSafeEqual } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { createDeploymentDatabase } from "../../../packages/shared/src/deployment-db.js";
import { runLifecycleProof } from "../../runner/src/lifecycle-t11-t13-probe.js";

const PORT = parsePort(process.env.PORT);
const COMPANY_TOKEN = requiredEnvironment("KANON_COMPANY_API_TOKEN");
const RUNNER_BASE_URL = requiredEnvironment("RUNNER_BASE_URL");
const RUNNER_SHARED_SECRET = requiredEnvironment("RUNNER_SHARED_SECRET");

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
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("request body must be valid JSON");
  }
}

let proofInFlight = false;

async function runProof(
  database: ReturnType<typeof createDeploymentDatabase>,
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
    const proof = {
      ...runningProof,
      status: "passed" as const,
      completedAt: new Date().toISOString(),
      lifecycle,
      databaseMigrations: true,
      runnerServiceUsed: true,
      privyAndEns: "live" as const,
    };
    await database.saveProof(runId, "passed", proof);
  } catch (error) {
    const proof = {
      ...runningProof,
      status: "failed" as const,
      completedAt: new Date().toISOString(),
      failureCode: safeErrorCode(error),
      databaseMigrations: true,
      runnerServiceUsed: true,
      privyAndEns: "not-verified" as const,
    };
    await database.saveProof(runId, "failed", proof);
  } finally {
    proofInFlight = false;
  }
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  database: ReturnType<typeof createDeploymentDatabase>,
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
      sendJson(response, 401, {
        schema: "kanon.api.error",
        version: 1,
        code: "UNAUTHORIZED",
        requestId: id,
      });
      return;
    }
    try {
      await readBody(request);
    } catch {
      sendJson(response, 400, {
        schema: "kanon.api.error",
        version: 1,
        code: "INVALID_JSON",
        requestId: id,
      });
      return;
    }
    if (proofInFlight) {
      sendJson(response, 409, {
        schema: "kanon.api.error",
        version: 1,
        code: "PROOF_ALREADY_RUNNING",
        requestId: id,
      });
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

  sendJson(response, 404, {
    schema: "kanon.api.error",
    version: 1,
    code: "NOT_FOUND",
    requestId: id,
  });
}

async function main(): Promise<void> {
  const database = createDeploymentDatabase();
  await database.migrate();
  const server = createServer((request, response) => {
    void handleRequest(request, response, database).catch(() => {
      sendJson(response, 500, {
        schema: "kanon.api.error",
        version: 1,
        code: "INTERNAL_ERROR",
        requestId: requestId(request),
      });
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
