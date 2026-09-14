import { randomUUID, timingSafeEqual } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { createPublicClient, getAddress, http, type Hex } from "viem";
import { sepolia } from "viem/chains";
import {
  createAuthorizationContext,
  createPrivyClient,
  readT3Environment,
} from "../../../packages/privy/src/t3-runtime.js";
import { buildT3Transaction } from "../../../packages/privy/src/feasibility.js";
import {
  createDeploymentDatabase,
  type DeploymentDatabase,
} from "../../../packages/shared/src/deployment-db.js";
import type { InstallationId } from "../../../packages/shared/src/index.js";
import {
  IsolatedRunner,
  RunnerRefusalError,
  type DelegatedExecutionInput,
  type DelegatedExecutionResult,
  type RunnerContext,
} from "./isolated-runner.js";

const PORT = parsePort(process.env.PORT);
const SHARED_SECRET = requiredEnvironment("RUNNER_SHARED_SECRET");
const environment = readT3Environment();
if (environment.chainId !== 11155111) {
  throw new Error("runner deployment requires Ethereum Sepolia");
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") throw new Error(`${name} is required`);
  return value;
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? "8080");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new TypeError("PORT must be a valid TCP port");
  }
  return port;
}

function sendJson(
  response: ServerResponse,
  status: number,
  payload: unknown,
): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(JSON.stringify(payload));
}

function authorized(request: IncomingMessage): boolean {
  const value = request.headers["x-runner-shared-secret"];
  if (typeof value !== "string") return false;
  const expected = Buffer.from(SHARED_SECRET, "utf8");
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
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new Error("request body must be valid JSON");
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function contextFromBody(value: unknown): {
  readonly installationId: string;
  readonly context: RunnerContext;
  readonly request: Readonly<Record<string, unknown>>;
} {
  if (!record(value) || !record(value.context) || !record(value.request)) {
    throw new Error("runner request is missing context or request");
  }
  const installationId = value.installationId;
  if (typeof installationId !== "string" || installationId.length === 0) {
    throw new Error("runner request has an invalid installation ID");
  }
  const context = value.context as unknown as RunnerContext;
  if (
    typeof context.installationId !== "string" ||
    typeof context.generation !== "number" ||
    typeof context.permissionHash !== "string" ||
    typeof context.executionMethod !== "string" ||
    !record(context.delegatedAuthority)
  ) {
    throw new Error("runner request has an invalid authority context");
  }
  return {
    installationId,
    context,
    request: value.request,
  };
}

function rejectionStatus(error: unknown): number | undefined {
  if (!record(error)) return undefined;
  const status = error.status;
  return typeof status === "number" ? status : undefined;
}

async function executeOnPrivy(
  client: ReturnType<typeof createPrivyClient>,
  financialClient: ReturnType<typeof createPublicClient>,
  input: DelegatedExecutionInput,
): Promise<DelegatedExecutionResult> {
  if (input.executionMethod !== "eth_signTransaction") {
    throw new RunnerRefusalError(
      "deployment runner only permits the verified eth_signTransaction path",
    );
  }
  const toValue = input.request.to;
  const valueValue = input.request.valueWei;
  if (typeof toValue !== "string" || typeof valueValue !== "string") {
    throw new Error("runner transaction requires to and valueWei strings");
  }
  const recipient = getAddress(toValue);
  const valueWei = BigInt(valueValue);
  if (valueWei < 0n) throw new Error("transaction value must be non-negative");
  const dataValue = input.request.data;
  const data =
    dataValue === undefined
      ? undefined
      : typeof dataValue === "string"
        ? (dataValue as Hex)
        : (() => {
            throw new Error("transaction data must be a hex string");
          })();
  const wallet = await client.wallets().get(input.walletId);
  const delegatedSigner = wallet.additional_signers.find(
    (signer) =>
      signer.signer_id === input.delegatedSignerId &&
      (signer.override_policy_ids ?? []).includes(input.policyId),
  );
  if (!delegatedSigner) {
    return {
      outcome: "REJECTED",
      rejectionCode: "PRIVY_DELEGATED_AUTHORITY_REVOKED",
    };
  }
  const account = getAddress(wallet.address);
  const [nonce, gasPrice] = await Promise.all([
    financialClient.getTransactionCount({ address: account }),
    financialClient.getGasPrice(),
  ]);
  const gasLimit = await financialClient.estimateGas({
    account,
    to: recipient,
    value: valueWei,
    ...(data === undefined ? {} : { data }),
  });
  const transaction = buildT3Transaction({
    chainId: environment.chainId,
    recipient,
    valueWei,
    data,
  });
  const quantity = (value: bigint): string => `0x${value.toString(16)}`;
  try {
    const signed = await client
      .wallets()
      .ethereum()
      .signTransaction(input.walletId, {
        params: {
          transaction: {
            ...transaction,
            type: 2 as const,
            nonce: quantity(BigInt(nonce)),
            gas_limit: quantity(gasLimit),
            max_fee_per_gas: quantity(gasPrice * 2n),
            max_priority_fee_per_gas: quantity(gasPrice),
          },
        },
        authorization_context: createAuthorizationContext(
          environment.agentPrivateKey,
        ),
        idempotency_key: `kanon-deployment-${randomUUID()}`,
      });
    const serialized = signed.signed_transaction;
    if (typeof serialized !== "string" || !serialized.startsWith("0x")) {
      throw new Error("Privy returned an invalid signed transaction");
    }
    const transactionHash = await financialClient.sendRawTransaction({
      serializedTransaction: serialized as Hex,
    });
    const receipt = await financialClient.waitForTransactionReceipt({
      hash: transactionHash,
      timeout: 90_000,
    });
    if (receipt.status !== "success") {
      throw new Error("broadcast transaction did not confirm successfully");
    }
    return { outcome: "SUCCEEDED", transactionHash };
  } catch (error) {
    const status = rejectionStatus(error);
    if (status === 400 || status === 403 || status === 422) {
      return {
        outcome: "REJECTED",
        rejectionCode: `PRIVY_POLICY_REJECTED_${status}`,
      };
    }
    throw error;
  }
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  database: DeploymentDatabase,
  runner: IsolatedRunner,
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://kanon.runner");
  if (request.method === "GET" && url.pathname === "/healthz") {
    try {
      await database.pool.query("SELECT 1");
      sendJson(response, 200, {
        schema: "kanon.runner.health",
        version: 1,
        status: "ok",
        service: "runner",
        database: "ok",
      });
    } catch {
      sendJson(response, 503, { status: "degraded", service: "runner" });
    }
    return;
  }
  if (request.method !== "POST" || url.pathname !== "/internal/execute") {
    sendJson(response, 404, { code: "NOT_FOUND" });
    return;
  }
  if (!authorized(request)) {
    sendJson(response, 401, { code: "UNAUTHORIZED" });
    return;
  }
  try {
    const parsed = contextFromBody(await readBody(request));
    const evidence = await runner.execute({
      installationId: parsed.installationId as InstallationId,
      context: parsed.context,
      request: parsed.request,
    });
    sendJson(response, 200, {
      schema: "kanon.runner.execution",
      version: 1,
      evidence,
    });
  } catch (error) {
    if (error instanceof RunnerRefusalError) {
      sendJson(response, 409, {
        schema: "kanon.runner.error",
        version: 1,
        code: error.code,
      });
      return;
    }
    sendJson(response, 400, {
      schema: "kanon.runner.error",
      version: 1,
      code: "EXECUTION_FAILED",
    });
  }
}

async function main(): Promise<void> {
  const database = createDeploymentDatabase();
  await database.migrate();
  const client = createPrivyClient(environment);
  const financialClient = createPublicClient({
    chain: sepolia,
    transport: http(environment.rpcUrl, { timeout: 20_000 }),
  });
  const runner = new IsolatedRunner(
    {
      getInstallation: async (installationId) => {
        const installation = await database.getInstallation(installationId);
        if (!installation) {
          throw new RunnerRefusalError("installation was not found");
        }
        return installation;
      },
    },
    { execute: (input) => executeOnPrivy(client, financialClient, input) },
  );
  const server = createServer((request, response) => {
    void handleRequest(request, response, database, runner).catch(() => {
      sendJson(response, 500, { code: "INTERNAL_ERROR" });
    });
  });
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`kanon_runner_listening=${PORT}`);
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
