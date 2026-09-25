import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  decodeFunctionResult,
  encodeFunctionData,
  getAddress,
  http,
  isAddressEqual,
  namehash,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import {
  createAgentRelease,
  type AgentRelease,
} from "../../../packages/manifest/src/index.js";
import {
  createCompanyAuthorityTerms,
  createNormalizedPermissionSet,
  diffPermissionSets,
  type NormalizedPermissionSet,
  type PermissionHash,
} from "../../../packages/permissions/src/index.js";
import {
  ENS_PROTECTED_RECORD_KEYS,
  EnsV2Adapter,
  createApprovedStateWritePlan,
  createEnsIdentityBinding,
  createRevokedStatusWritePlan,
  normalizeEnsAddress,
  writeApprovedState,
  writeRevokedStatus,
  type EnsApprovedState,
  type EnsIdentityBinding,
} from "../../../packages/ens/src/index.js";
import {
  createAuthorizationContext,
  createPrivyClient,
  createPrivyRestAuthorizationHeaders,
  findWallet,
  readPrivyControlEnvironment,
  readConfiguredOwnerCredentials,
  readT3Environment,
  type Aggregation,
  type AggregationInput,
  type OwnerCredentials,
  type Policy,
  type PolicyCreateParams,
  type PrivyControlEnvironment,
  type PrivySdkClient,
} from "../../../packages/privy/src/t3-runtime.js";
import {
  buildPrivyAggregationRequirements,
  compilePrivyPolicy,
} from "../../../packages/privy/src/policy-compiler.js";
import { buildT3Transaction } from "../../../packages/privy/src/feasibility.js";
import {
  createEnsRecordState,
  createHumanDecision,
  createInstallation,
  createRevocationRecord,
  transitionInstallation,
  type Installation,
  type PrivyControlBinding,
} from "../../../packages/shared/src/index.js";
import {
  createRunnerContext,
  IsolatedRunner,
  type DelegatedExecutionInput,
  type DelegatedExecutionResult,
} from "./isolated-runner.js";

const EVIDENCE_PATH = resolve(
  process.cwd(),
  "evidence",
  "lifecycle",
  "t11-t13-latest.json",
);

export const CHAIN_ID = 11155111;
export const CONTROL_WALLET = getAddress(
  "0x8b88E1E1174eDC65B08de75A5439f130da8A3DFd",
);
export const REPRESENTATIVE_AGENT_OWNER = getAddress(
  "0x42D5Fb257d479187607D47C19433Be6aEEd4a9A9",
);
export const AGENT_ID = "com.example.treasury";
const RELEASE_A_ID = "release-a-3rd-web-hack-2026";
const RELEASE_B_ID = "release-b-3rd-web-hack-2026";
export const AGENT_NAME =
  "representative-agent.agents.kanon-ethonline-2026.eth";
export const ORGANIZATION_NAME = "kanon-ethonline-2026.eth";
export const NAMESPACE_NAME = "agents.kanon-ethonline-2026.eth";
export const RECIPIENT = CONTROL_WALLET;
export const WALLET_EXTERNAL_ID = "kanon-t3-sepolia";
const RECORD_VALUES_A = {
  agentId: AGENT_ID,
  releaseId: RELEASE_A_ID,
  permissionHash:
    "sha256:7171a1991636a5923a86991b8b9f284b9a5a5082458645a05d7f69f0f0eed56b" as PermissionHash,
  status: "approved" as const,
};

const UNIVERSAL_RESOLVER = getAddress(
  "0x4a1817d13e9cf196f471725176355c1234b63c70",
);
const RESOLVER = getAddress("0x0D4560DaFEb04Cf022472B5085070A05E0d77e0B");
const RESOLVER_ABI = [
  {
    type: "function",
    name: "setText",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "text",
    stateMutability: "view",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
    ],
    outputs: [{ type: "string" }],
  },
] as const;
const UNIVERSAL_RESOLVER_ABI = [
  {
    type: "function",
    name: "findResolver",
    stateMutability: "view",
    inputs: [{ name: "name", type: "bytes" }],
    outputs: [
      { name: "resolver", type: "address" },
      { name: "node", type: "bytes32" },
      { name: "version", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "resolve",
    stateMutability: "view",
    inputs: [
      { name: "name", type: "bytes" },
      { name: "data", type: "bytes" },
    ],
    outputs: [
      { name: "response", type: "bytes" },
      { name: "resolver", type: "address" },
    ],
  },
] as const;

class PrivyRestError extends Error {
  public constructor(public readonly status: number) {
    super(`Privy REST request failed with HTTP ${status}`);
    this.name = "PrivyRestError";
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`${name} is required`);
  }
  return value;
}

function dnsEncode(name: string): Hex {
  const labels = name.split(".").map((label) => {
    const encoded = stringToHex(label).slice(2);
    return `${(encoded.length / 2).toString(16).padStart(2, "0")}${encoded}`;
  });
  return `0x${labels.join("")}00` as Hex;
}

function safeStatus(error: unknown): number | undefined {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { readonly status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

function hexQuantity(value: bigint | number): string {
  const quantity = typeof value === "number" ? BigInt(value) : value;
  if (quantity < 0n) throw new RangeError("quantity must be non-negative");
  return `0x${quantity.toString(16)}`;
}

async function requestPrivyJson(
  environment: PrivyControlEnvironment,
  method: "DELETE" | "POST",
  path: string,
  body?: unknown,
  authorizationPrivateKey?: string,
): Promise<Record<string, unknown>> {
  const url = `https://api.privy.io${path}`;
  const signedHeaders =
    authorizationPrivateKey === undefined
      ? {}
      : createPrivyRestAuthorizationHeaders({
          appId: environment.appId,
          privateKey: authorizationPrivateKey,
          method,
          url,
          body: body ?? "",
        });
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${environment.appId}:${environment.appSecret}`,
      ).toString("base64")}`,
      "privy-app-id": environment.appId,
      ...signedHeaders,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30_000),
  });
  const responseText = await response.text();
  let parsed: unknown = {};
  if (responseText.length > 0) {
    try {
      parsed = JSON.parse(responseText) as unknown;
    } catch {
      parsed = {};
    }
  }
  if (!response.ok) throw new PrivyRestError(response.status);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Privy REST response was not a JSON object");
  }
  return parsed as Record<string, unknown>;
}

export async function createAggregation(
  environment: PrivyControlEnvironment,
  input: AggregationInput,
): Promise<Aggregation> {
  const result = await requestPrivyJson(
    environment,
    "POST",
    "/v1/aggregations",
    input,
  );
  if (typeof result.id !== "string" || result.id.length === 0) {
    throw new Error("Privy aggregation response did not include an ID");
  }
  return result as unknown as Aggregation;
}

export async function deleteAggregation(
  environment: PrivyControlEnvironment,
  aggregationId: string,
  owner: OwnerCredentials,
): Promise<void> {
  await requestPrivyJson(
    environment,
    "DELETE",
    `/v1/aggregations/${encodeURIComponent(aggregationId)}`,
    undefined,
    owner.privateKey,
  );
}

export async function setAgentPolicy(
  client: PrivySdkClient,
  walletId: string,
  agentSignerId: string,
  owner: OwnerCredentials,
  policyId: string,
): Promise<void> {
  const wallet = await client.wallets().update(walletId, {
    additional_signers: [
      { signer_id: agentSignerId, override_policy_ids: [policyId] },
    ],
    authorization_context: createAuthorizationContext(owner.privateKey),
  });
  const signer = wallet.additional_signers.find(
    (candidate) => candidate.signer_id === agentSignerId,
  );
  if (
    !signer ||
    JSON.stringify(signer.override_policy_ids ?? []) !==
      JSON.stringify([policyId])
  ) {
    throw new Error("Privy did not attach the expected delegated policy");
  }
}

export async function removeAgentPolicy(
  client: PrivySdkClient,
  walletId: string,
  owner: OwnerCredentials,
): Promise<void> {
  const wallet = await client.wallets().update(walletId, {
    additional_signers: [],
    authorization_context: createAuthorizationContext(owner.privateKey),
  });
  if (wallet.additional_signers.length !== 0) {
    throw new Error("Privy did not remove the delegated signer");
  }
}

export async function deletePolicy(
  client: PrivySdkClient,
  policy: Pick<Policy, "id">,
  owner: OwnerCredentials,
): Promise<void> {
  await client.policies().delete(policy.id, {
    authorization_context: createAuthorizationContext(owner.privateKey),
  });
}

function release(
  releaseId: string,
  version: string,
  content: string,
): AgentRelease {
  return createAgentRelease({
    agentId: AGENT_ID,
    releaseId,
    version,
    packageContent: content,
    runtime: { entry: "worker" },
    capabilities: { chains: [CHAIN_ID], assets: ["native"] },
  });
}

function permissionSet(
  currentRelease: AgentRelease,
  maxValueWei: string,
  rollingMaxValueWei: string,
): NormalizedPermissionSet {
  return createNormalizedPermissionSet({
    release: currentRelease,
    companyTerms: createCompanyAuthorityTerms({
      rules: [
        {
          chainId: CHAIN_ID,
          asset: "native",
          recipient: RECIPIENT,
          maxValueWei,
          rollingSpend: {
            maxValueWei: rollingMaxValueWei,
            windowSeconds: 3600,
          },
        },
      ],
    }),
  });
}

export function policyCreateParams(
  plan: ReturnType<typeof compilePrivyPolicy>,
  idempotencyKey: string,
): PolicyCreateParams & { readonly idempotency_key: string } {
  return { ...plan.policy, idempotency_key: idempotencyKey };
}

function binding(
  policyId: string,
  aggregationId: string,
  permissionSet: NormalizedPermissionSet,
  generation: number,
): PrivyControlBinding {
  return {
    authorityKind: "DELEGATED_SIGNER",
    walletId: "",
    delegatedSignerId: "",
    policyId,
    aggregationId,
    executionMethod: "eth_signTransaction",
    permissionHash: permissionSet.permissionHash,
    generation,
    status: "ACTIVE",
  };
}

export function ensExpectedState(input: {
  readonly release: AgentRelease;
  readonly permissionSet: NormalizedPermissionSet;
  readonly status: "approved" | "active" | "revoked";
}): EnsApprovedState {
  return {
    agentId: input.release.agentId,
    releaseId: input.release.releaseId,
    permissionHash: input.permissionSet.permissionHash,
    status: input.status,
  };
}

export function ensStateFromRead(
  identity: EnsIdentityBinding,
  state: EnsApprovedState,
  observedAt: string,
) {
  return createEnsRecordState({
    binding: identity,
    agentId: String(state.agentId),
    releaseId: String(state.releaseId),
    permissionHash: String(state.permissionHash) as PermissionHash,
    status: state.status,
    verified: true,
    observedAt,
  });
}

async function waitForReceipt(
  client: ReturnType<typeof createPublicClient>,
  hash: Hex,
): Promise<void> {
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Sepolia transaction reverted: ${hash}`);
  }
}

export function createEnsRuntime() {
  const rpcUrl = requiredEnv("ENS_SEPOLIA_RPC_URL");
  const privateKey = requiredEnv("ENS_CONTROL_PRIVATE_KEY") as Hex;
  const account = privateKeyToAccount(privateKey);
  if (!isAddressEqual(account.address, CONTROL_WALLET)) {
    throw new Error(
      "ENS_CONTROL_PRIVATE_KEY does not derive the configured control wallet",
    );
  }
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl, { timeout: 20_000 }),
  });
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl, { timeout: 20_000 }),
  });
  const identity = createEnsIdentityBinding({
    chainId: CHAIN_ID,
    organizationName: ORGANIZATION_NAME,
    namespaceName: NAMESPACE_NAME,
    agentName: AGENT_NAME,
    resolver: RESOLVER,
    controlWallet: CONTROL_WALLET,
  });
  const adapter = new EnsV2Adapter(
    {
      findResolver: async (name) => {
        const result = await publicClient.readContract({
          address: UNIVERSAL_RESOLVER,
          abi: UNIVERSAL_RESOLVER_ABI,
          functionName: "findResolver",
          args: [dnsEncode(name)],
        });
        return { resolver: result[0] as Address, node: result[1] as Hex };
      },
      readText: async (name, key) => {
        const result = await publicClient.readContract({
          address: UNIVERSAL_RESOLVER,
          abi: UNIVERSAL_RESOLVER_ABI,
          functionName: "resolve",
          args: [
            dnsEncode(name),
            encodeFunctionData({
              abi: RESOLVER_ABI,
              functionName: "text",
              args: [identity.agentNode, key],
            }),
          ],
        });
        return {
          resolver: result[1] as Address,
          value: decodeFunctionResult({
            abi: RESOLVER_ABI,
            functionName: "text",
            data: result[0],
          }) as string,
        };
      },
    },
    {
      chainId: CHAIN_ID,
      universalResolverV2: normalizeEnsAddress(UNIVERSAL_RESOLVER),
    },
  );
  const writer = {
    writeProtectedRecords: async (plan: {
      readonly binding: EnsIdentityBinding;
      readonly records: Readonly<
        Record<(typeof ENS_PROTECTED_RECORD_KEYS)[number], string>
      >;
    }) => {
      const hashes: string[] = [];
      for (const key of ENS_PROTECTED_RECORD_KEYS) {
        const hash = await walletClient.writeContract({
          address: plan.binding.resolver as Address,
          abi: RESOLVER_ABI,
          functionName: "setText",
          args: [namehash(plan.binding.agentName), key, plan.records[key]],
        });
        await waitForReceipt(publicClient, hash);
        hashes.push(hash);
      }
      return hashes;
    },
  };
  const revocationWriter = {
    writeRevokedStatus: async (plan: {
      readonly binding: EnsIdentityBinding;
      readonly record: {
        readonly key: "kanon.status";
        readonly value: "revoked";
      };
    }) => {
      const hash = await walletClient.writeContract({
        address: plan.binding.resolver as Address,
        abi: RESOLVER_ABI,
        functionName: "setText",
        args: [
          namehash(plan.binding.agentName),
          plan.record.key,
          plan.record.value,
        ],
      });
      await waitForReceipt(publicClient, hash);
      return [hash];
    },
  };
  return { publicClient, identity, adapter, writer, revocationWriter };
}

export interface LifecycleProofOptions {
  readonly runnerBaseUrl?: string;
  readonly runnerSharedSecret?: string;
  readonly persistInstallation?: (
    installation: Installation,
  ) => Promise<void> | void;
}

async function executeRemoteRunner(input: {
  readonly baseUrl: string;
  readonly sharedSecret: string;
  readonly context: ReturnType<typeof createRunnerContext>;
  readonly request: Readonly<Record<string, unknown>>;
}): Promise<DelegatedExecutionResult> {
  const response = await fetch(
    `${input.baseUrl.replace(/\/$/, "")}/internal/execute`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-runner-shared-secret": input.sharedSecret,
      },
      body: JSON.stringify({
        installationId: input.context.installationId,
        context: input.context,
        request: input.request,
      }),
      signal: AbortSignal.timeout(90_000),
    },
  );
  const responseText = await response.text();
  let payload: unknown = {};
  try {
    payload =
      responseText.length > 0 ? (JSON.parse(responseText) as unknown) : {};
  } catch {
    payload = {};
  }
  if (
    payload === null ||
    typeof payload !== "object" ||
    !("evidence" in payload)
  ) {
    throw new Error(
      response.ok
        ? "runner returned an invalid execution response"
        : `runner request failed with HTTP ${response.status}`,
    );
  }
  const evidence = (payload as { readonly evidence?: unknown }).evidence;
  if (
    evidence === null ||
    typeof evidence !== "object" ||
    ((evidence as { readonly outcome?: unknown }).outcome !== "SUCCEEDED" &&
      (evidence as { readonly outcome?: unknown }).outcome !== "REJECTED")
  ) {
    throw new Error("runner returned invalid execution evidence");
  }
  const result = evidence as {
    readonly outcome: "SUCCEEDED" | "REJECTED";
    readonly transactionHash?: string;
    readonly rejectionCode?: string;
  };
  if (result.outcome === "SUCCEEDED") {
    if (!result.transactionHash) {
      throw new Error("runner returned successful evidence without a hash");
    }
    return { outcome: "SUCCEEDED", transactionHash: result.transactionHash };
  }
  if (!result.rejectionCode) {
    throw new Error("runner returned rejected evidence without a code");
  }
  return { outcome: "REJECTED", rejectionCode: result.rejectionCode };
}

export async function runLifecycleProof(
  options: LifecycleProofOptions = {},
): Promise<Record<string, unknown>> {
  const runnerBaseUrl = options.runnerBaseUrl ?? process.env.RUNNER_BASE_URL;
  const runnerSharedSecret =
    options.runnerSharedSecret ?? process.env.RUNNER_SHARED_SECRET;
  if (runnerBaseUrl && !runnerSharedSecret) {
    throw new Error("RUNNER_SHARED_SECRET is required with RUNNER_BASE_URL");
  }
  const controlEnvironment = readPrivyControlEnvironment();
  const localEnvironment = runnerBaseUrl ? undefined : readT3Environment();
  const environment = controlEnvironment;
  if (environment.chainId !== CHAIN_ID) {
    throw new Error(
      "T11 to T13 requires the configured Privy fixture on Sepolia",
    );
  }
  const client = createPrivyClient(controlEnvironment);
  const owner = await readConfiguredOwnerCredentials(client);
  const wallet = await findWallet(client, WALLET_EXTERNAL_ID);
  if (!wallet) throw new Error("Kanon T3 wallet was not found");
  if (wallet.owner_id !== owner.keyQuorumId) {
    throw new Error(
      "Kanon wallet owner does not match the configured owner quorum",
    );
  }
  if (
    wallet.policy_ids.length !== 0 ||
    wallet.additional_signers.length !== 0
  ) {
    throw new Error(
      "T11 requires the existing wallet to start without active delegated authority",
    );
  }

  const ens = createEnsRuntime();
  const releaseA = release(RELEASE_A_ID, "1.0.0", "kanon-t11-release-a");
  const permissionSetA = permissionSet(releaseA, "1", "1");
  if (permissionSetA.permissionHash !== RECORD_VALUES_A.permissionHash) {
    throw new Error(
      "T6 ENS permissionHash does not match the verified T11 authority fixture",
    );
  }
  const expectedA = ensExpectedState({
    release: releaseA,
    permissionSet: permissionSetA,
    status: "approved",
  });

  const aggregationRequirementsA = buildPrivyAggregationRequirements({
    permissionSet: permissionSetA,
    ownerId: owner.keyQuorumId,
    policyName: "Kanon T11 release A",
    executionMethod: "eth_signTransaction",
  });
  const aggregationA = await createAggregation(
    environment,
    aggregationRequirementsA[0].input,
  );
  const planA = compilePrivyPolicy({
    permissionSet: permissionSetA,
    ownerId: owner.keyQuorumId,
    policyName: "Kanon T11 release A",
    executionMethod: "eth_signTransaction",
    aggregationIdsByRule: { "rule-1": aggregationA.id },
  });
  const policyA = await client
    .policies()
    .create(policyCreateParams(planA, `kanon-t11-a-${randomUUID()}`));
  let delegatedAuthorityAttached = false;
  let postRevokeExpected = false;
  const financialClient = localEnvironment
    ? createPublicClient({
        chain: sepolia,
        transport: http(localEnvironment.rpcUrl, { timeout: 20_000 }),
      })
    : undefined;
  let remoteContext: ReturnType<typeof createRunnerContext> | undefined;
  const executor = {
    execute: async (input: DelegatedExecutionInput) => {
      if (runnerBaseUrl) {
        if (!remoteContext || !runnerSharedSecret) {
          throw new Error("remote runner context was not prepared");
        }
        return executeRemoteRunner({
          baseUrl: runnerBaseUrl,
          sharedSecret: runnerSharedSecret,
          context: remoteContext,
          request: input.request,
        });
      }
      if (!financialClient || !localEnvironment) {
        throw new Error("local financial executor was not prepared");
      }
      try {
        const request = input.request;
        const recipient = getAddress(String(request.to));
        const valueWei = BigInt(String(request.valueWei));
        const data =
          typeof request.data === "string" ? (request.data as Hex) : undefined;
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
          chainId: CHAIN_ID,
          recipient,
          valueWei,
          data,
        });
        const signableTransaction = {
          ...transaction,
          type: 2 as const,
          nonce: hexQuantity(nonce),
          gas_limit: hexQuantity(gasLimit),
          max_fee_per_gas: hexQuantity(gasPrice * 2n),
          max_priority_fee_per_gas: hexQuantity(gasPrice),
        };
        const signed = await client
          .wallets()
          .ethereum()
          .signTransaction(wallet.id, {
            params: { transaction: signableTransaction },
            authorization_context: createAuthorizationContext(
              localEnvironment.agentPrivateKey,
            ),
            idempotency_key: `kanon-lifecycle-sign-${randomUUID()}`,
          });
        const hash = await financialClient.sendRawTransaction({
          serializedTransaction: signed.signed_transaction as Hex,
        });
        await waitForReceipt(financialClient, hash);
        return { outcome: "SUCCEEDED" as const, transactionHash: hash };
      } catch (error) {
        if (postRevokeExpected) {
          return {
            outcome: "REJECTED" as const,
            rejectionCode: `privy_rejected${safeStatus(error) ? `_${safeStatus(error)}` : ""}`,
          };
        }
        throw error;
      }
    },
  };

  let installation: Installation;
  let policyB: Policy | undefined;
  let aggregationB: Aggregation | undefined;
  let ensWriteA: readonly string[] = [];
  let ensWriteB: readonly string[] = [];
  let ensWriteRevoked: readonly string[] = [];
  let policyADeleted = false;
  let aggregationADeleted = false;
  let policyBDeleted = false;
  let aggregationBDeleted = false;
  let completed = false;
  try {
    await setAgentPolicy(
      client,
      wallet.id,
      environment.agentSignerId,
      owner,
      policyA.id,
    );
    delegatedAuthorityAttached = true;
    const walletAfterAttach = await client.wallets().get(wallet.id);
    const t11DelegatedSignerAttached = !(
      walletAfterAttach.additional_signers.length !== 1 ||
      walletAfterAttach.additional_signers[0]?.signer_id !==
        environment.agentSignerId
    );
    if (!t11DelegatedSignerAttached) {
      throw new Error("T11 wallet readback did not show the delegated signer");
    }

    let baselineVerification = await ens.adapter.verifyApprovedState(
      ens.identity,
      expectedA,
    );
    let ensBaseline: "already-approved" | "written-after-privy-attach" =
      "already-approved";
    if (!baselineVerification.ok) {
      const writePlanA = createApprovedStateWritePlan({
        binding: ens.identity,
        state: expectedA,
        authorization: {
          lifecycle: "ACTIVE",
          privyAuthority: "ACTIVE",
          agentId: releaseA.agentId,
          releaseId: releaseA.releaseId,
          permissionHash: permissionSetA.permissionHash,
        },
      });
      ensWriteA = await writeApprovedState(ens.writer, writePlanA);
      ensBaseline = "written-after-privy-attach";
      baselineVerification = await ens.adapter.verifyApprovedState(
        ens.identity,
        expectedA,
      );
      if (!baselineVerification.ok) {
        throw new Error(
          `T11 ENS baseline did not read back: ${baselineVerification.mismatches.join(",")}`,
        );
      }
    }

    const ensStateA = ensStateFromRead(
      ens.identity,
      expectedA,
      new Date().toISOString(),
    );
    const privyBindingA = binding(
      policyA.id,
      aggregationA.id,
      permissionSetA,
      0,
    );
    const fixedPrivyBindingA = {
      ...privyBindingA,
      walletId: wallet.id,
      delegatedSignerId: environment.agentSignerId,
    };
    installation = createInstallation({
      id: "installation-t11-live",
      organizationId: "organization-kanon",
      release: releaseA,
      permissionSet: permissionSetA,
    });
    installation = transitionInstallation(installation, {
      type: "approval_requested",
    });
    const approvalA = createHumanDecision({
      id: "decision-t11-approve",
      action: "APPROVE",
      outcome: "APPROVED",
      decidedBy: owner.keyQuorumId,
      decidedAt: new Date().toISOString(),
      release: releaseA,
      permissionSet: permissionSetA,
    });
    installation = transitionInstallation(installation, {
      type: "approval_granted",
      decision: approvalA,
    });
    installation = transitionInstallation(installation, {
      type: "authority_configured",
      privy: fixedPrivyBindingA,
      ens: ensStateA,
    });
    if (installation.status !== "ACTIVE") {
      throw new Error("T11 installation did not become active");
    }
    await options.persistInstallation?.(installation);

    let liveInstallation = installation;
    const runner = new IsolatedRunner(
      { getInstallation: () => liveInstallation },
      executor,
    );
    const runnerContextA = createRunnerContext(installation);
    remoteContext = runnerContextA;
    const allowedA = await runner.execute({
      installationId: installation.id,
      context: runnerContextA,
      request: { to: RECIPIENT, valueWei: "1" },
    });
    if (allowedA.outcome !== "SUCCEEDED") {
      throw new Error("T11 allowed delegated execution did not succeed");
    }
    const forbiddenA = await runner.execute({
      installationId: installation.id,
      context: runnerContextA,
      request: { to: environment.forbiddenRecipient, valueWei: "1" },
    });
    if (forbiddenA.outcome !== "REJECTED") {
      throw new Error("T11 forbidden delegated execution was not rejected");
    }

    const releaseB = release(RELEASE_B_ID, "2.0.0", "kanon-t12-release-b");
    const permissionSetB = permissionSet(releaseB, "2", "2");
    const diff = diffPermissionSets(permissionSetA, permissionSetB);
    if (diff.classification !== "EXPANDED" || !diff.requiresHumanReview) {
      throw new Error(
        "T12 release B was not classified as an authority expansion",
      );
    }
    const updateAvailable = transitionInstallation(liveInstallation, {
      type: "update_available",
      proposal: {
        schema: "kanon.update-proposal",
        version: 1,
        release: releaseB,
        permissionSet: permissionSetB,
        classification: diff.classification,
        requiresHumanReview: diff.requiresHumanReview,
      },
    });
    liveInstallation = updateAvailable;
    await options.persistInstallation?.(liveInstallation);
    const reauthorization = createHumanDecision({
      id: "decision-t12-reauthorize",
      action: "REAUTHORIZE",
      outcome: "APPROVED",
      decidedBy: owner.keyQuorumId,
      decidedAt: new Date().toISOString(),
      release: releaseB,
      permissionSet: permissionSetB,
    });
    const awaitingReauthorization = transitionInstallation(updateAvailable, {
      type: "reauthorization_requested",
      decision: reauthorization,
    });
    if (awaitingReauthorization.status !== "AWAITING_REAUTHORIZATION") {
      throw new Error("T12 did not stop at the reauthorization boundary");
    }
    liveInstallation = awaitingReauthorization;
    await options.persistInstallation?.(liveInstallation);
    let expandedAuthorityBlocked = false;
    try {
      await runner.execute({
        installationId: installation.id,
        context: runnerContextA,
        request: { to: RECIPIENT, valueWei: "2" },
      });
    } catch {
      expandedAuthorityBlocked = true;
    }
    if (!expandedAuthorityBlocked) {
      throw new Error(
        "T12 expanded authority was executable before reauthorization",
      );
    }

    const aggregationRequirementsB = buildPrivyAggregationRequirements({
      permissionSet: permissionSetB,
      ownerId: owner.keyQuorumId,
      policyName: "Kanon T12 release B",
      executionMethod: "eth_signTransaction",
    });
    aggregationB = await createAggregation(
      environment,
      aggregationRequirementsB[0].input,
    );
    const planB = compilePrivyPolicy({
      permissionSet: permissionSetB,
      ownerId: owner.keyQuorumId,
      policyName: "Kanon T12 release B",
      executionMethod: "eth_signTransaction",
      aggregationIdsByRule: { "rule-1": aggregationB.id },
    });
    policyB = await client
      .policies()
      .create(policyCreateParams(planB, `kanon-t12-b-${randomUUID()}`));
    await setAgentPolicy(
      client,
      wallet.id,
      environment.agentSignerId,
      owner,
      policyB.id,
    );

    const expectedB = ensExpectedState({
      release: releaseB,
      permissionSet: permissionSetB,
      status: "approved",
    });
    const writePlanB = createApprovedStateWritePlan({
      binding: ens.identity,
      state: expectedB,
      authorization: {
        lifecycle: "ACTIVE",
        privyAuthority: "ACTIVE",
        agentId: releaseB.agentId,
        releaseId: releaseB.releaseId,
        permissionHash: permissionSetB.permissionHash,
      },
    });
    ensWriteB = await writeApprovedState(ens.writer, writePlanB);
    const verificationB = await ens.adapter.verifyApprovedState(
      ens.identity,
      expectedB,
    );
    if (!verificationB.ok) {
      throw new Error(
        `T12 ENS update did not read back: ${verificationB.mismatches.join(",")}`,
      );
    }

    const ensStateB = ensStateFromRead(
      ens.identity,
      expectedB,
      new Date().toISOString(),
    );
    const fixedPrivyBindingB = {
      ...binding(policyB.id, aggregationB.id, permissionSetB, 1),
      walletId: wallet.id,
      delegatedSignerId: environment.agentSignerId,
    };
    liveInstallation = transitionInstallation(awaitingReauthorization, {
      type: "authority_configured",
      release: releaseB,
      permissionSet: permissionSetB,
      privy: fixedPrivyBindingB,
      ens: ensStateB,
    });
    if (
      liveInstallation.status !== "ACTIVE" ||
      liveInstallation.generation !== 1
    ) {
      throw new Error(
        "T12 installation did not activate at the new generation",
      );
    }
    await options.persistInstallation?.(liveInstallation);
    const runnerContextB = createRunnerContext(liveInstallation);
    remoteContext = runnerContextB;
    const directB = await runner.execute({
      installationId: liveInstallation.id,
      context: runnerContextB,
      request: { to: RECIPIENT, valueWei: "2" },
    });
    if (directB.outcome !== "SUCCEEDED") {
      throw new Error(
        "T12 expanded Privy policy did not permit its approved 2 wei action",
      );
    }
    const t12ActiveGeneration = liveInstallation.generation;

    const revokeDecision = createHumanDecision({
      id: "decision-t13-revoke",
      action: "REVOKE",
      outcome: "APPROVED",
      decidedBy: owner.keyQuorumId,
      decidedAt: new Date().toISOString(),
      release: releaseB,
      permissionSet: permissionSetB,
    });
    const revoking = transitionInstallation(liveInstallation, {
      type: "revoke_requested",
      decision: revokeDecision,
    });
    liveInstallation = revoking;
    await options.persistInstallation?.(liveInstallation);
    await removeAgentPolicy(client, wallet.id, owner);
    delegatedAuthorityAttached = false;
    const walletAfterRevoke = await client.wallets().get(wallet.id);
    if (walletAfterRevoke.additional_signers.length !== 0) {
      throw new Error("T13 wallet readback still shows delegated authority");
    }
    postRevokeExpected = true;
    let postRevoke: DelegatedExecutionResult;
    let postRevokeSucceeded = false;
    try {
      postRevoke = await runner.execute({
        installationId: liveInstallation.id,
        context: runnerContextB,
        request: { to: RECIPIENT, valueWei: "1" },
      });
      postRevokeSucceeded = postRevoke.outcome === "SUCCEEDED";
    } catch {
      postRevoke = {
        outcome: "REJECTED",
        rejectionCode: "RUNNER_REFUSED_STALE_OR_REVOKED",
      };
    }
    if (postRevokeSucceeded) {
      throw new Error(
        "T13 delegated execution still succeeded after signer removal",
      );
    }

    const revokeWritePlan = createRevokedStatusWritePlan({
      binding: ens.identity,
      current: expectedB,
      privyAuthority: "REVOKED",
    });
    ensWriteRevoked = await writeRevokedStatus(
      ens.revocationWriter,
      revokeWritePlan,
    );
    const expectedRevoked = ensExpectedState({
      release: releaseB,
      permissionSet: permissionSetB,
      status: "revoked",
    });
    const verificationRevoked = await ens.adapter.verifyApprovedState(
      ens.identity,
      expectedRevoked,
    );
    if (!verificationRevoked.ok) {
      throw new Error(
        `T13 ENS revoked status did not read back: ${verificationRevoked.mismatches.join(",")}`,
      );
    }

    const unauthorizedData = encodeFunctionData({
      abi: RESOLVER_ABI,
      functionName: "setText",
      args: [namehash(AGENT_NAME), "kanon.status", "approved"],
    });
    let unauthorizedRejected = false;
    try {
      await ens.publicClient.call({
        account: REPRESENTATIVE_AGENT_OWNER,
        to: RESOLVER,
        data: unauthorizedData,
      });
    } catch {
      unauthorizedRejected = true;
    }
    if (!unauthorizedRejected) {
      throw new Error(
        "T13 representative agent was able to restore ENS status",
      );
    }
    const finalVerification = await ens.adapter.verifyApprovedState(
      ens.identity,
      expectedRevoked,
    );
    if (!finalVerification.ok) {
      throw new Error("T13 unauthorized ENS attempt changed the revoked state");
    }

    const revocationRecord = createRevocationRecord({
      decisionId: revokeDecision.id,
      privyAuthorityRevoked: true,
      postRevokeExecutionFailed: true,
      recordedAt: new Date().toISOString(),
    });
    liveInstallation = transitionInstallation(revoking, {
      type: "revocation_completed",
      decision: revokeDecision,
      revocation: revocationRecord,
    });
    if (liveInstallation.status !== "REVOKED") {
      throw new Error("T13 installation did not enter REVOKED state");
    }
    await options.persistInstallation?.(liveInstallation);

    await deletePolicy(client, policyA, owner);
    policyADeleted = true;
    await deleteAggregation(environment, aggregationA.id, owner);
    aggregationADeleted = true;
    if (policyB) {
      await deletePolicy(client, policyB, owner);
      policyBDeleted = true;
    }
    if (aggregationB) {
      await deleteAggregation(environment, aggregationB.id, owner);
      aggregationBDeleted = true;
    }

    const evidence = {
      milestone: "T11-T13",
      status: "passed",
      recordedAt: new Date().toISOString(),
      network: { name: "Ethereum Sepolia", chainId: CHAIN_ID },
      resources: {
        walletId: wallet.id,
        walletAddress: wallet.address,
        ownerKeyQuorumId: owner.keyQuorumId,
        delegatedSignerId: environment.agentSignerId,
        ensName: AGENT_NAME,
        ensResolver: RESOLVER,
      },
      t11: {
        status: "passed",
        releaseId: releaseA.releaseId,
        packageHash: releaseA.packageHash,
        manifestHash: releaseA.manifestHash,
        permissionHash: permissionSetA.permissionHash,
        policyId: policyA.id,
        aggregationId: aggregationA.id,
        humanDecisionId: approvalA.id,
        installationStatus: installation.status,
        delegatedSignerAttached: t11DelegatedSignerAttached,
        ensBaseline,
        ensWrites: ensWriteA,
        ensReadback: baselineVerification.observed.records,
        allowedExecution: allowedA,
        forbiddenExecution: forbiddenA,
      },
      t12: {
        status: "passed",
        releaseId: releaseB.releaseId,
        packageHash: releaseB.packageHash,
        manifestHash: releaseB.manifestHash,
        permissionHash: permissionSetB.permissionHash,
        classification: diff.classification,
        requiresHumanReview: diff.requiresHumanReview,
        changedPaths: diff.changedPaths,
        blockedBeforeReauthorization: expandedAuthorityBlocked,
        humanDecisionId: reauthorization.id,
        policyId: policyB.id,
        aggregationId: aggregationB.id,
        directDelegatedExecution: directB,
        ensWrites: ensWriteB,
        ensReadback: verificationB.observed.records,
        activeGeneration: t12ActiveGeneration,
      },
      t13: {
        status: "passed",
        humanDecisionId: revokeDecision.id,
        signerCountAfterRevoke: walletAfterRevoke.additional_signers.length,
        postRevokeExecution: postRevoke,
        ensWrites: ensWriteRevoked,
        ensReadback: finalVerification.observed.records,
        unauthorizedWriter: REPRESENTATIVE_AGENT_OWNER,
        unauthorizedRestoreRejected: unauthorizedRejected,
        installationStatus: liveInstallation.status,
      },
      cleanup: {
        policyADeleted,
        aggregationADeleted,
        policyBDeleted,
        aggregationBDeleted,
      },
      security: {
        companyTermsPublishedToEns: false,
        ownerCredentialPassedToRunnerContext: false,
        mainnetWrite: false,
      },
    };
    await mkdir(dirname(EVIDENCE_PATH), { recursive: true });
    await writeFile(
      EVIDENCE_PATH,
      `${JSON.stringify(evidence, null, 2)}\n`,
      "utf8",
    );
    completed = true;
    console.log("lifecycle_t11_t13=passed");
    console.log(`lifecycle_t11_policy=${policyA.id}`);
    console.log(`lifecycle_t12_policy=${policyB.id}`);
    console.log(
      `lifecycle_t13_status=${finalVerification.observed.records["kanon.status"]}`,
    );
    console.log(`lifecycle_evidence=${EVIDENCE_PATH}`);
    return evidence;
  } finally {
    if (!completed && delegatedAuthorityAttached) {
      try {
        await removeAgentPolicy(client, wallet.id, owner);
      } catch {
        console.error("lifecycle_cleanup=delegated_signer_removal_failed");
      }
    }
    if (!completed && policyB) {
      try {
        await deletePolicy(client, policyB, owner);
      } catch {
        console.error("lifecycle_cleanup=release_b_policy_delete_failed");
      }
    }
    if (!completed && aggregationB) {
      try {
        await deleteAggregation(environment, aggregationB.id, owner);
      } catch {
        console.error("lifecycle_cleanup=release_b_aggregation_delete_failed");
      }
    }
    if (!completed && !policyADeleted) {
      try {
        await deletePolicy(client, policyA, owner);
      } catch {
        console.error("lifecycle_cleanup=release_a_policy_delete_failed");
      }
    }
    if (!completed && !aggregationADeleted) {
      try {
        await deleteAggregation(environment, aggregationA.id, owner);
      } catch {
        console.error("lifecycle_cleanup=release_a_aggregation_delete_failed");
      }
    }
  }
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runLifecycleProof().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "lifecycle proof failed",
    );
    process.exitCode = 1;
  });
}
