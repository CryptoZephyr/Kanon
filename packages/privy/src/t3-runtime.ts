import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  PrivyClient,
  generateAuthorizationSignature,
  generateP256KeyPair,
  type AuthorizationContext,
  type KeyQuorum,
  type Policy,
  type Wallet,
  type WalletApiRequestSignatureInput,
} from "@privy-io/node";
import {
  buildT3PolicyBody,
  deriveAuthorizationPublicKey,
  expectedDelegationRejectionStatus,
  expectedPolicyRejectionStatus,
  normalizeBase64Der,
  normalizeAuthorizationPrivateKey,
  type T3PolicyInput,
} from "./feasibility.js";

export type {
  Aggregation,
  AggregationInput,
  Policy,
  PolicyCondition,
  PolicyCreateParams,
} from "@privy-io/node/resources";
export type PrivySdkClient = PrivyClient;

const DEFAULT_ALLOWED_RECIPIENT = "0x8b88E1E1174eDC65B08de75A5439f130da8A3DFd";
export const DEFAULT_FORBIDDEN_RECIPIENT =
  "0x2222222222222222222222222222222222222222";
const T3_EXTERNAL_ID = "kanon-t3-sepolia";
const T3_POLICY_NAME = "Kanon T3 delegated signer policy";
const T3_MAX_VALUE_WEI = 1n;
const T3_EVIDENCE_PATH = resolve(
  process.cwd(),
  "evidence",
  "privy",
  "t3-latest.json",
);

const REQUIRED_CONTROL_ENVIRONMENT = [
  "PRIVY_APP_ID",
  "PRIVY_APP_SECRET",
  "PRIVY_AUTHORIZATION_KEY_ID",
  "FINANCIAL_RPC_URL",
  "FINANCIAL_CHAIN_ID",
  "FINANCIAL_ASSET",
] as const;

export interface PrivyControlEnvironment {
  readonly appId: string;
  readonly appSecret: string;
  readonly agentSignerId: string;
  readonly rpcUrl: string;
  readonly chainId: number;
  readonly asset: "native";
  readonly allowedRecipient: string;
  readonly forbiddenRecipient: string;
}

export interface T3Environment extends PrivyControlEnvironment {
  readonly agentPrivateKey: string;
}

export interface OwnerCredentials {
  readonly keyQuorumId: string;
  readonly privateKey: string;
  readonly generated: boolean;
}

export function readPrivyControlEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): PrivyControlEnvironment {
  const missing = REQUIRED_CONTROL_ENVIRONMENT.filter(
    (name) => !environment[name] || environment[name]?.trim() === "",
  );
  if (missing.length > 0) {
    throw new Error(
      `missing required Privy control environment: ${missing.join(", ")}`,
    );
  }

  const chainId = Number(environment.FINANCIAL_CHAIN_ID);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new TypeError("FINANCIAL_CHAIN_ID must be a positive safe integer");
  }

  if (environment.FINANCIAL_ASSET !== "native") {
    throw new Error(
      "Kanon's verified deployment path only accepts FINANCIAL_ASSET=native",
    );
  }

  let rpcUrl: URL;
  try {
    rpcUrl = new URL(environment.FINANCIAL_RPC_URL as string);
  } catch {
    throw new TypeError("FINANCIAL_RPC_URL must be a valid URL");
  }

  if (rpcUrl.protocol !== "http:" && rpcUrl.protocol !== "https:") {
    throw new TypeError("FINANCIAL_RPC_URL must use HTTP or HTTPS");
  }

  return {
    appId: environment.PRIVY_APP_ID as string,
    appSecret: environment.PRIVY_APP_SECRET as string,
    agentSignerId: environment.PRIVY_AUTHORIZATION_KEY_ID as string,
    rpcUrl: rpcUrl.toString(),
    chainId,
    asset: "native",
    allowedRecipient: DEFAULT_ALLOWED_RECIPIENT,
    forbiddenRecipient: DEFAULT_FORBIDDEN_RECIPIENT,
  };
}

interface RunnerSuccess {
  readonly ok: true;
  readonly mode: "sign" | "send" | "update";
  readonly method: string;
  readonly hash?: string;
  readonly transactionId?: string;
  readonly signedTransaction?: boolean;
}

interface RunnerFailure {
  readonly ok: false;
  readonly mode: "sign" | "send" | "update";
  readonly method: string;
  readonly error: {
    readonly name: string;
    readonly status?: number;
    readonly message?: string;
  };
}

export type RunnerResult = RunnerSuccess | RunnerFailure;

export interface T3Evidence {
  readonly status: "passed" | "awaiting-funding";
  readonly recordedAt: string;
  readonly chain: {
    readonly type: "ethereum";
    readonly id: number;
    readonly asset: "native";
  };
  readonly resources: {
    readonly ownerKeyQuorumId: string;
    readonly agentSignerKeyQuorumId: string;
    readonly walletId: string;
    readonly walletAddress: string;
    readonly policyId: string;
  };
  readonly policyFixture: {
    readonly methods: readonly ["eth_signTransaction", "eth_sendTransaction"];
    readonly fields: readonly ["chain_id", "to", "value"];
    readonly maxValueWei: string;
    readonly recipient: string;
  };
  readonly checks: {
    readonly delegatedAllowedSigning: RunnerResult;
    readonly delegatedForbiddenSigning: RunnerResult;
    readonly agentOwnerOperation: RunnerResult;
    readonly delegatedAllowedSend?: RunnerResult;
    readonly receiptStatus?: "success" | "missing";
    readonly signerCountBeforeRevoke?: number;
    readonly signerCountAfterRevoke?: number;
    readonly delegatedAfterRevoke?: RunnerResult;
  };
  readonly documentedSurface: {
    readonly chainRecipientValue: "live-proven";
    readonly contractFunction: "documented";
    readonly nativeAsset: "live-proven";
    readonly spendingRate: "documented-with-caveat";
    readonly timing: "documented";
  };
  readonly references: readonly string[];
}

export function readT3Environment(
  environment: NodeJS.ProcessEnv = process.env,
): T3Environment {
  const control = readPrivyControlEnvironment(environment);
  const agentPrivateKeyValue = environment.PRIVY_AUTHORIZATION_PRIVATE_KEY;
  if (!agentPrivateKeyValue || agentPrivateKeyValue.trim() === "") {
    throw new Error(
      "missing required T3 environment: PRIVY_AUTHORIZATION_PRIVATE_KEY",
    );
  }

  return {
    ...control,
    agentPrivateKey: normalizeAuthorizationPrivateKey(agentPrivateKeyValue),
  };
}

export function createPrivyClient(
  environment: Pick<PrivyControlEnvironment, "appId" | "appSecret">,
): PrivyClient {
  return new PrivyClient({
    appId: environment.appId,
    appSecret: environment.appSecret,
    requestExpiry: { defaultMs: 15 * 60 * 1000 },
  });
}

export function createAuthorizationContext(
  privateKey: string,
): AuthorizationContext {
  return { authorization_private_keys: [privateKey] };
}

export function createPrivyRestAuthorizationHeaders(input: {
  readonly appId: string;
  readonly privateKey: string;
  readonly method: WalletApiRequestSignatureInput["method"];
  readonly url: string;
  readonly body: unknown;
  readonly requestExpiry?: number;
}): Readonly<Record<string, string>> {
  const requestExpiry = input.requestExpiry ?? Date.now() + 15 * 60 * 1000;
  if (!Number.isSafeInteger(requestExpiry) || requestExpiry <= Date.now()) {
    throw new TypeError("requestExpiry must be a future safe integer");
  }

  const headers = {
    "privy-app-id": input.appId,
    "privy-request-expiry": String(requestExpiry),
  } as const;
  const signable: WalletApiRequestSignatureInput = {
    version: 1,
    method: input.method,
    url: input.url,
    body: input.body,
    headers,
  };
  return {
    "privy-authorization-signature": generateAuthorizationSignature({
      authorizationPrivateKey: input.privateKey,
      input: signable,
    }),
    "privy-request-expiry": String(requestExpiry),
  };
}

function assertQuorumMatchesPrivateKey(
  quorum: KeyQuorum,
  privateKey: string,
  label: string,
): void {
  const derivedPublicKey = normalizeBase64Der(
    deriveAuthorizationPublicKey(privateKey),
  );
  const matches = quorum.authorization_keys.some(
    (entry) => normalizeBase64Der(entry.public_key) === derivedPublicKey,
  );
  if (!matches) {
    throw new Error(`${label} does not match the configured key quorum`);
  }

  if (quorum.authorization_threshold !== 1) {
    throw new Error(`${label} quorum is not a one-key quorum`);
  }
}

async function persistGeneratedOwnerCredentials(
  keyQuorumId: string,
  privateKey: string,
): Promise<void> {
  const envPath = resolve(process.cwd(), ".env.local");
  await appendFile(
    envPath,
    `\nPRIVY_OWNER_AUTHORIZATION_PRIVATE_KEY=${privateKey}\nPRIVY_OWNER_KEY_QUORUM_ID=${keyQuorumId}\n`,
    { encoding: "utf8" },
  );
  process.env.PRIVY_OWNER_AUTHORIZATION_PRIVATE_KEY = privateKey;
  process.env.PRIVY_OWNER_KEY_QUORUM_ID = keyQuorumId;
}

export async function readConfiguredOwnerCredentials(
  client: PrivyClient,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<OwnerCredentials> {
  const configuredId = environment.PRIVY_OWNER_KEY_QUORUM_ID;
  const configuredPrivateKey = environment.PRIVY_OWNER_AUTHORIZATION_PRIVATE_KEY
    ? normalizeAuthorizationPrivateKey(
        environment.PRIVY_OWNER_AUTHORIZATION_PRIVATE_KEY,
      )
    : undefined;

  if (!configuredId || !configuredPrivateKey) {
    throw new Error(
      "configured owner quorum ID and owner private key are both required",
    );
  }

  const quorum = await client.keyQuorums().get(configuredId);
  assertQuorumMatchesPrivateKey(
    quorum,
    configuredPrivateKey,
    "configured owner key",
  );
  return {
    keyQuorumId: configuredId,
    privateKey: configuredPrivateKey,
    generated: false,
  };
}

export async function ensureOwnerCredentials(
  client: PrivyClient,
): Promise<OwnerCredentials> {
  const configuredId = process.env.PRIVY_OWNER_KEY_QUORUM_ID;
  const configuredPrivateKey = process.env.PRIVY_OWNER_AUTHORIZATION_PRIVATE_KEY
    ? normalizeAuthorizationPrivateKey(
        process.env.PRIVY_OWNER_AUTHORIZATION_PRIVATE_KEY,
      )
    : undefined;

  if (Boolean(configuredId) !== Boolean(configuredPrivateKey)) {
    throw new Error(
      "owner quorum ID and owner private key must be configured together",
    );
  }

  if (configuredId && configuredPrivateKey) {
    return readConfiguredOwnerCredentials(client);
  }

  const keyPair = await generateP256KeyPair();
  const quorum = await client.keyQuorums().create({
    display_name: "Kanon T3 company owner",
    public_keys: [keyPair.publicKey],
    authorization_threshold: 1,
  });

  try {
    await persistGeneratedOwnerCredentials(quorum.id, keyPair.privateKey);
  } catch (error) {
    try {
      await client.keyQuorums().delete(quorum.id, {
        authorization_context: createAuthorizationContext(keyPair.privateKey),
      });
    } catch {
      throw new Error(
        "could not persist generated owner credentials or roll back owner quorum",
      );
    }
    throw error;
  }

  return {
    keyQuorumId: quorum.id,
    privateKey: keyPair.privateKey,
    generated: true,
  };
}

async function readRpc(
  rpcUrl: string,
  method: string,
  params: readonly unknown[] = [],
): Promise<unknown> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });

  if (!response.ok) {
    throw new Error(`financial RPC returned HTTP ${response.status}`);
  }

  const body = (await response.json()) as {
    readonly error?: { readonly message?: string };
    readonly result?: unknown;
  };
  if (body.error || body.result === undefined) {
    throw new Error("financial RPC returned an error");
  }

  return body.result;
}

async function assertFinancialChain(environment: T3Environment): Promise<void> {
  const result = await readRpc(environment.rpcUrl, "eth_chainId");
  if (
    typeof result !== "string" ||
    Number.parseInt(result, 16) !== environment.chainId
  ) {
    throw new Error(
      "FINANCIAL_RPC_URL chain does not match FINANCIAL_CHAIN_ID",
    );
  }
}

async function getNativeBalance(
  environment: T3Environment,
  address: string,
): Promise<bigint> {
  const result = await readRpc(environment.rpcUrl, "eth_getBalance", [
    address,
    "latest",
  ]);
  if (typeof result !== "string" || !/^0x[0-9a-f]+$/i.test(result)) {
    throw new Error("financial RPC returned an invalid native balance");
  }
  return BigInt(result);
}

async function waitForReceipt(
  environment: T3Environment,
  hash: string,
): Promise<boolean> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const receipt = await readRpc(
      environment.rpcUrl,
      "eth_getTransactionReceipt",
      [hash],
    );
    if (receipt && typeof receipt === "object") {
      const status = (receipt as { readonly status?: unknown }).status;
      return status === "0x1";
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 3000));
  }
  return false;
}

function assertRunnerOutput(value: unknown): asserts value is RunnerResult {
  if (
    value === null ||
    typeof value !== "object" ||
    typeof (value as { readonly ok?: unknown }).ok !== "boolean" ||
    typeof (value as { readonly mode?: unknown }).mode !== "string"
  ) {
    throw new Error("delegated runner returned an invalid result");
  }
}

export async function runDelegatedRunner(input: {
  readonly environment: T3Environment;
  readonly walletId: string;
  readonly mode: "sign" | "send" | "update";
  readonly recipient?: string;
  readonly valueWei?: bigint;
  readonly data?: string;
}): Promise<RunnerResult> {
  const { spawn } = await import("node:child_process");
  const runnerPath = resolve(
    process.cwd(),
    "apps",
    "runner",
    "src",
    "privy-delegated-runner.ts",
  );
  const childEnvironment: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    NODE_PATH: process.env.NODE_PATH,
    PRIVY_APP_ID: input.environment.appId,
    PRIVY_APP_SECRET: input.environment.appSecret,
    PRIVY_AUTHORIZATION_KEY_ID: input.environment.agentSignerId,
    PRIVY_AUTHORIZATION_PRIVATE_KEY: input.environment.agentPrivateKey,
    FINANCIAL_CHAIN_ID: String(input.environment.chainId),
    FINANCIAL_RPC_URL: input.environment.rpcUrl,
    FINANCIAL_ASSET: input.environment.asset,
  };
  const args = [
    "--import=tsx",
    runnerPath,
    `--mode=${input.mode}`,
    `--wallet-id=${input.walletId}`,
    `--chain-id=${input.environment.chainId}`,
    ...(input.recipient ? [`--recipient=${input.recipient}`] : []),
    ...(input.valueWei !== undefined
      ? [`--value-wei=${input.valueWei.toString()}`]
      : []),
    ...(input.data ? [`--data=${input.data}`] : []),
  ];

  return await new Promise<RunnerResult>((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: childEnvironment,
      stdio: ["ignore", "pipe", "ignore"],
    });
    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.on("error", (error) => rejectPromise(error));
    child.on("close", (code) => {
      try {
        const parsed = JSON.parse(stdout.trim()) as unknown;
        assertRunnerOutput(parsed);
        if (code !== 0 && parsed.ok) {
          rejectPromise(new Error("delegated runner exited unexpectedly"));
          return;
        }
        resolvePromise(parsed);
      } catch (error) {
        rejectPromise(error);
      }
    });
  });
}

function sameConditions(
  actual: readonly unknown[],
  expected: readonly unknown[],
): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function policyMatchesFixture(policy: Policy, input: T3PolicyInput): boolean {
  const expected = buildT3PolicyBody(input);
  if (
    policy.name !== expected.name ||
    policy.chain_type !== expected.chain_type ||
    policy.owner_id !== expected.owner_id ||
    policy.version !== expected.version ||
    policy.rules.length !== expected.rules.length
  ) {
    return false;
  }

  return expected.rules.every((expectedRule) => {
    const actualRule = policy.rules.find(
      (rule) => rule.method === expectedRule.method,
    );
    return Boolean(
      actualRule &&
        actualRule.action === expectedRule.action &&
        sameConditions(actualRule.conditions, expectedRule.conditions),
    );
  });
}

export async function findWallet(
  client: PrivyClient,
  externalId: string,
): Promise<Wallet | undefined> {
  for await (const wallet of client.wallets().list({
    chain_type: "ethereum",
    external_id: externalId,
  })) {
    return wallet;
  }
  return undefined;
}

export async function ensureT3Resources(
  client: PrivyClient,
  environment: T3Environment,
  owner: OwnerCredentials,
): Promise<{ readonly wallet: Wallet; readonly policy: Policy }> {
  const policyInput: T3PolicyInput = {
    ownerId: owner.keyQuorumId,
    chainId: environment.chainId,
    recipient: environment.allowedRecipient,
    maxValueWei: T3_MAX_VALUE_WEI,
    name: T3_POLICY_NAME,
  };
  const existingWallet = await findWallet(client, T3_EXTERNAL_ID);

  if (existingWallet) {
    if (existingWallet.owner_id !== owner.keyQuorumId) {
      throw new Error("existing T3 wallet has a different owner");
    }
    if (existingWallet.policy_ids.length !== 0) {
      throw new Error("existing T3 wallet unexpectedly has a base policy");
    }

    if (existingWallet.additional_signers.length !== 1) {
      throw new Error(
        "existing T3 wallet does not have exactly one additional signer",
      );
    }

    const matchingSigner = existingWallet.additional_signers.find(
      (signer) => signer.signer_id === environment.agentSignerId,
    );
    const policyId = matchingSigner?.override_policy_ids?.[0];
    if (
      !matchingSigner ||
      matchingSigner.override_policy_ids?.length !== 1 ||
      !policyId
    ) {
      throw new Error(
        "existing T3 wallet does not have the expected agent policy",
      );
    }

    const policy = await client.policies().get(policyId);
    if (!policyMatchesFixture(policy, policyInput)) {
      throw new Error(
        "existing T3 policy does not match the provisional fixture",
      );
    }

    return { wallet: existingWallet, policy };
  }

  const policy = await client.policies().create({
    ...buildT3PolicyBody(policyInput),
    idempotency_key: "kanon-t3-sepolia-policy",
  });
  const wallet = await client.wallets().create({
    chain_type: "ethereum",
    display_name: "Kanon T3 business wallet",
    external_id: T3_EXTERNAL_ID,
    owner_id: owner.keyQuorumId,
    additional_signers: [
      {
        signer_id: environment.agentSignerId,
        override_policy_ids: [policy.id],
      },
    ],
    idempotency_key: "kanon-t3-sepolia-wallet",
  });
  return { wallet, policy };
}

async function writeEvidence(evidence: T3Evidence): Promise<void> {
  await mkdir(dirname(T3_EVIDENCE_PATH), { recursive: true });
  await writeFile(T3_EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`, {
    encoding: "utf8",
  });
}

function references(): readonly string[] {
  return [
    "https://docs.privy.io/controls/policies/overview",
    "https://docs.privy.io/controls/policies/example-policies/ethereum",
    "https://docs.privy.io/controls/policies/stateful-policies",
    "https://docs.privy.io/controls/authorization-keys/using-owners/overview",
    "https://docs.privy.io/api-reference/wallets/update",
    "https://docs.privy.io/api-reference/wallets/ethereum/eth-send-transaction",
  ];
}

function printRunnerResult(label: string, result: RunnerResult): void {
  if (result.ok) {
    console.log(`${label}=ok`);
    if (result.hash) console.log(`${label}_hash=${result.hash}`);
    if (result.transactionId) {
      console.log(`${label}_transaction_id=${result.transactionId}`);
    }
    return;
  }
  console.log(`${label}=rejected`);
  console.log(`${label}_status=${result.error.status ?? "unknown"}`);
  console.log(`${label}_error=${result.error.name}`);
}

export async function runPrivyFeasibilitySpike(): Promise<T3Evidence> {
  const environment = readT3Environment();
  await assertFinancialChain(environment);
  const client = createPrivyClient(environment);
  const agentQuorum = await client.keyQuorums().get(environment.agentSignerId);
  assertQuorumMatchesPrivateKey(
    agentQuorum,
    environment.agentPrivateKey,
    "configured agent key",
  );
  const owner = await ensureOwnerCredentials(client);
  const { wallet, policy } = await ensureT3Resources(
    client,
    environment,
    owner,
  );
  console.log("privy_t3=resources-ready");
  console.log(`privy_t3_owner_key_quorum_id=${owner.keyQuorumId}`);
  console.log(
    `privy_t3_agent_signer_key_quorum_id=${environment.agentSignerId}`,
  );
  console.log(`privy_t3_wallet_id=${wallet.id}`);
  console.log(`privy_t3_wallet_address=${wallet.address}`);
  console.log(`privy_t3_policy_id=${policy.id}`);
  console.log(`privy_t3_chain_id=${environment.chainId}`);
  console.log("privy_t3_asset=native");
  console.log("privy_t3_policy_fields=chain_id,to,value");

  const delegatedAllowedSigning = await runDelegatedRunner({
    environment,
    walletId: wallet.id,
    mode: "sign",
    recipient: environment.allowedRecipient,
    valueWei: T3_MAX_VALUE_WEI,
  });
  printRunnerResult("privy_t3_allowed_sign", delegatedAllowedSigning);
  if (!delegatedAllowedSigning.ok) {
    throw new Error("delegated allowed signing did not succeed");
  }

  const delegatedForbiddenSigning = await runDelegatedRunner({
    environment,
    walletId: wallet.id,
    mode: "sign",
    recipient: environment.forbiddenRecipient,
    valueWei: T3_MAX_VALUE_WEI,
  });
  printRunnerResult("privy_t3_forbidden_sign", delegatedForbiddenSigning);
  if (
    delegatedForbiddenSigning.ok ||
    !expectedPolicyRejectionStatus(delegatedForbiddenSigning.error.status)
  ) {
    throw new Error("forbidden delegated signing was not rejected by policy");
  }

  const agentOwnerOperation = await runDelegatedRunner({
    environment,
    walletId: wallet.id,
    mode: "update",
  });
  printRunnerResult("privy_t3_agent_owner_update", agentOwnerOperation);
  if (
    agentOwnerOperation.ok ||
    !expectedDelegationRejectionStatus(agentOwnerOperation.error.status)
  ) {
    throw new Error("agent was able to perform an owner-level wallet update");
  }

  const balance = await getNativeBalance(environment, wallet.address);
  const minimumBalance = 2_000_000_000_000_000n;
  if (balance < minimumBalance) {
    const evidence: T3Evidence = {
      status: "awaiting-funding",
      recordedAt: new Date().toISOString(),
      chain: { type: "ethereum", id: environment.chainId, asset: "native" },
      resources: {
        ownerKeyQuorumId: owner.keyQuorumId,
        agentSignerKeyQuorumId: environment.agentSignerId,
        walletId: wallet.id,
        walletAddress: wallet.address,
        policyId: policy.id,
      },
      policyFixture: {
        methods: ["eth_signTransaction", "eth_sendTransaction"],
        fields: ["chain_id", "to", "value"],
        maxValueWei: T3_MAX_VALUE_WEI.toString(),
        recipient: environment.allowedRecipient,
      },
      checks: {
        delegatedAllowedSigning,
        delegatedForbiddenSigning,
        agentOwnerOperation,
      },
      documentedSurface: {
        chainRecipientValue: "live-proven",
        contractFunction: "documented",
        nativeAsset: "live-proven",
        spendingRate: "documented-with-caveat",
        timing: "documented",
      },
      references: references(),
    };
    await writeEvidence(evidence);
    console.log("privy_t3=awaiting-funding");
    console.log("privy_t3_required_native_balance_wei=2000000000000000");
    console.log(`privy_t3_wallet_address=${wallet.address}`);
    return evidence;
  }

  const delegatedAllowedSend = await runDelegatedRunner({
    environment,
    walletId: wallet.id,
    mode: "send",
    recipient: environment.allowedRecipient,
    valueWei: T3_MAX_VALUE_WEI,
  });
  printRunnerResult("privy_t3_allowed_send", delegatedAllowedSend);
  if (!delegatedAllowedSend.ok || !delegatedAllowedSend.hash) {
    throw new Error("delegated allowed send did not succeed");
  }
  const receiptStatus = (await waitForReceipt(
    environment,
    delegatedAllowedSend.hash,
  ))
    ? ("success" as const)
    : ("missing" as const);
  console.log(`privy_t3_receipt=${receiptStatus}`);
  if (receiptStatus !== "success") {
    throw new Error(
      "delegated allowed transaction did not confirm successfully",
    );
  }

  const signerCountBeforeRevoke = wallet.additional_signers.length;
  const revokedWallet = await client.wallets().update(wallet.id, {
    additional_signers: [],
    authorization_context: createAuthorizationContext(owner.privateKey),
  });
  const signerCountAfterRevoke = revokedWallet.additional_signers.length;
  if (signerCountBeforeRevoke !== 1 || signerCountAfterRevoke !== 0) {
    throw new Error(
      "owner-signed signer removal did not produce an empty signer set",
    );
  }
  console.log("privy_t3_revoke=ok");

  const delegatedAfterRevoke = await runDelegatedRunner({
    environment,
    walletId: wallet.id,
    mode: "sign",
    recipient: environment.allowedRecipient,
    valueWei: T3_MAX_VALUE_WEI,
  });
  printRunnerResult("privy_t3_post_revoke_sign", delegatedAfterRevoke);
  if (
    delegatedAfterRevoke.ok ||
    !expectedDelegationRejectionStatus(delegatedAfterRevoke.error.status)
  ) {
    throw new Error("delegated signing still succeeded after signer removal");
  }

  const evidence: T3Evidence = {
    status: "passed",
    recordedAt: new Date().toISOString(),
    chain: { type: "ethereum", id: environment.chainId, asset: "native" },
    resources: {
      ownerKeyQuorumId: owner.keyQuorumId,
      agentSignerKeyQuorumId: environment.agentSignerId,
      walletId: wallet.id,
      walletAddress: wallet.address,
      policyId: policy.id,
    },
    policyFixture: {
      methods: ["eth_signTransaction", "eth_sendTransaction"],
      fields: ["chain_id", "to", "value"],
      maxValueWei: T3_MAX_VALUE_WEI.toString(),
      recipient: environment.allowedRecipient,
    },
    checks: {
      delegatedAllowedSigning,
      delegatedForbiddenSigning,
      agentOwnerOperation,
      delegatedAllowedSend,
      receiptStatus,
      signerCountBeforeRevoke,
      signerCountAfterRevoke,
      delegatedAfterRevoke,
    },
    documentedSurface: {
      chainRecipientValue: "live-proven",
      contractFunction: "documented",
      nativeAsset: "live-proven",
      spendingRate: "documented-with-caveat",
      timing: "documented",
    },
    references: references(),
  };
  await writeEvidence(evidence);
  console.log("privy_t3=passed");
  return evidence;
}
