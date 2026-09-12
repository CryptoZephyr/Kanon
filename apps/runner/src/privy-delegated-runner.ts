import { randomUUID } from "node:crypto";
import {
  createAuthorizationContext,
  createPrivyClient,
  readT3Environment,
  type RunnerResult,
} from "../../../packages/privy/src/t3-runtime.js";
import { buildT3Transaction } from "../../../packages/privy/src/feasibility.js";

type RunnerMode = "sign" | "send" | "update";

interface RunnerOptions {
  readonly mode: RunnerMode;
  readonly walletId: string;
  readonly chainId: number;
  readonly recipient?: string;
  readonly valueWei?: bigint;
}

function parseArguments(argumentsList: readonly string[]): RunnerOptions {
  const values = new Map<string, string>();
  for (const argument of argumentsList) {
    const separator = argument.indexOf("=");
    if (!argument.startsWith("--") || separator < 3) {
      throw new Error("runner arguments must use --name=value");
    }
    values.set(argument.slice(2, separator), argument.slice(separator + 1));
  }

  const mode = values.get("mode");
  if (mode !== "sign" && mode !== "send" && mode !== "update") {
    throw new Error("runner mode must be sign, send, or update");
  }

  const walletId = values.get("wallet-id");
  if (!walletId) {
    throw new Error("runner wallet-id is required");
  }

  const chainId = Number(values.get("chain-id"));
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new Error("runner chain-id must be a positive safe integer");
  }

  const recipient = values.get("recipient");
  const rawValueWei = values.get("value-wei");
  const valueWei = rawValueWei === undefined ? undefined : BigInt(rawValueWei);
  if (mode !== "update" && (!recipient || valueWei === undefined)) {
    throw new Error("transaction runner modes require recipient and value-wei");
  }

  return { mode, walletId, chainId, recipient, valueWei };
}

function errorStatus(error: unknown): number | undefined {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { readonly status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

function safeError(
  error: unknown,
): Extract<RunnerResult, { readonly ok: false }>["error"] {
  const secrets = [
    process.env.PRIVY_APP_SECRET ?? "",
    process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY ?? "",
  ];
  let message =
    error instanceof Error ? error.message.slice(0, 240) : undefined;
  if (message) {
    for (const secret of secrets) {
      if (secret.length > 0) message = message.split(secret).join("[REDACTED]");
    }
  }
  const body =
    error && typeof error === "object" && "error" in error
      ? (error as { readonly error?: unknown }).error
      : undefined;
  if (body && typeof body === "object") {
    const details = ["code", "message", "detail", "type"]
      .map((key) => {
        const value = (body as Record<string, unknown>)[key];
        return typeof value === "string" ? `${key}=${value}` : undefined;
      })
      .filter((value): value is string => value !== undefined)
      .join(";");
    if (details.length > 0) message = details.slice(0, 240);
  }
  return {
    name: error instanceof Error ? error.name : "UnknownError",
    status: errorStatus(error),
    ...(message ? { message } : {}),
  };
}

async function execute(options: RunnerOptions): Promise<RunnerResult> {
  const environment = readT3Environment();
  if (environment.chainId !== options.chainId) {
    throw new Error(
      "runner chain-id does not match configured financial chain",
    );
  }

  const client = createPrivyClient(environment);
  const context = createAuthorizationContext(environment.agentPrivateKey);

  if (options.mode === "update") {
    const updated = await client.wallets().update(options.walletId, {
      additional_signers: [],
      authorization_context: context,
    });
    return {
      ok: true,
      mode: options.mode,
      method: "PATCH /v1/wallets/{wallet_id}",
      ...(updated.additional_signers.length === 0
        ? {}
        : { signedTransaction: false }),
    };
  }

  const transaction = buildT3Transaction({
    chainId: options.chainId,
    recipient: options.recipient as string,
    valueWei: options.valueWei as bigint,
  });

  if (options.mode === "sign") {
    const response = await client
      .wallets()
      .ethereum()
      .signTransaction(options.walletId, {
        params: { transaction },
        authorization_context: context,
        idempotency_key: `kanon-t3-sign-${randomUUID()}`,
      });
    return {
      ok: true,
      mode: options.mode,
      method: "eth_signTransaction",
      signedTransaction: response.signed_transaction.length > 0,
    };
  }

  const response = await client
    .wallets()
    .ethereum()
    .sendTransaction(options.walletId, {
      caip2: `eip155:${options.chainId}`,
      params: { transaction },
      authorization_context: context,
      idempotency_key: `kanon-t3-send-${randomUUID()}`,
    });
  return {
    ok: true,
    mode: options.mode,
    method: "eth_sendTransaction",
    hash: response.hash,
    ...(response.transaction_id
      ? { transactionId: response.transaction_id }
      : {}),
  };
}

async function main(): Promise<void> {
  try {
    const options = parseArguments(process.argv.slice(2));
    const result = await execute(options);
    console.log(JSON.stringify(result));
  } catch (error) {
    const mode = process.argv.some((argument) => argument === "--mode=send")
      ? "send"
      : process.argv.some((argument) => argument === "--mode=update")
        ? "update"
        : "sign";
    const result: RunnerResult = {
      ok: false,
      mode,
      method:
        mode === "send"
          ? "eth_sendTransaction"
          : mode === "update"
            ? "PATCH /v1/wallets/{wallet_id}"
            : "eth_signTransaction",
      error: safeError(error),
    };
    console.log(JSON.stringify(result));
    process.exitCode = 1;
  }
}

await main();
