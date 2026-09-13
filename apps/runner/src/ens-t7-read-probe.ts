import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  createPublicClient,
  decodeFunctionResult,
  encodeFunctionData,
  getAddress,
  http,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import { sepolia } from "viem/chains";
import {
  EnsV2Adapter,
  createEnsIdentityBinding,
  normalizeEnsAddress,
} from "../../../packages/ens/src/index.js";
import type { PermissionHash } from "../../../packages/permissions/src/index.js";

const UNIVERSAL_RESOLVER = getAddress(
  "0x4a1817d13e9cf196f471725176355c1234b63c70",
);
const RESOLVER = getAddress("0x0D4560DaFEb04Cf022472B5085070A05E0d77e0B");
const CONTROL_WALLET = getAddress("0x8b88E1E1174eDC65B08de75A5439f130da8A3DFd");
const AGENT_NAME = "representative-agent.agents.kanon-ethonline-2026.eth";
const EXPECTED_STATE = {
  agentId: "com.example.treasury",
  releaseId: "release-t6-ethonline-2026",
  permissionHash:
    "sha256:7171a1991636a5923a86991b8b9f284b9a5a5082458645a05d7f69f0f0eed56b" as PermissionHash,
  status: "approved" as const,
};
const RESOLVER_ABI = [
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

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
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

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(requiredEnv("ENS_SEPOLIA_RPC_URL"), { timeout: 20_000 }),
});

const transport = {
  findResolver: async (name: string) => {
    const result = await publicClient.readContract({
      address: UNIVERSAL_RESOLVER,
      abi: UNIVERSAL_RESOLVER_ABI,
      functionName: "findResolver",
      args: [dnsEncode(name)],
    });
    return { resolver: result[0] as Address, node: result[1] as Hex };
  },
  readText: async (
    name: string,
    key:
      | "kanon.agentId"
      | "kanon.release"
      | "kanon.permissionHash"
      | "kanon.status",
  ) => {
    const result = await publicClient.readContract({
      address: UNIVERSAL_RESOLVER,
      abi: UNIVERSAL_RESOLVER_ABI,
      functionName: "resolve",
      args: [
        dnsEncode(name),
        encodeFunctionData({
          abi: RESOLVER_ABI,
          functionName: "text",
          args: [
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            key,
          ],
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
};

const binding = createEnsIdentityBinding({
  chainId: 11155111,
  organizationName: "kanon-ethonline-2026.eth",
  namespaceName: "agents.kanon-ethonline-2026.eth",
  agentName: AGENT_NAME,
  resolver: RESOLVER,
  controlWallet: CONTROL_WALLET,
});
const adapter = new EnsV2Adapter(transport, {
  chainId: 11155111,
  universalResolverV2: normalizeEnsAddress(UNIVERSAL_RESOLVER),
});
const verification = await adapter.verifyApprovedState(binding, EXPECTED_STATE);
if (!verification.ok) {
  throw new Error(
    `T7 ENS approved-state verification failed: ${verification.mismatches.join(",")}`,
  );
}

const evidence = {
  milestone: "T7",
  status: "passed",
  recordedAt: new Date().toISOString(),
  chainId: 11155111,
  writeAttempted: false,
  sensitiveCompanyTermsPublished: false,
  binding,
  deployment: { universalResolverV2: UNIVERSAL_RESOLVER },
  verified: {
    resolver: verification.observed.resolver,
    records: verification.observed.records,
    mismatches: verification.mismatches,
  },
  references: [
    "https://docs.ens.domains/ensv2/permissioned-resolver",
    "https://docs.ens.domains/ensv2/enhanced-access-control",
  ],
};
await mkdir(dirname("evidence/ens/t7-adapter-latest.json"), {
  recursive: true,
});
await writeFile(
  "evidence/ens/t7-adapter-latest.json",
  `${JSON.stringify(evidence, null, 2)}\n`,
  "utf8",
);
console.log("ens_t7_adapter=passed");
console.log(`ens_t7_agent=${AGENT_NAME}`);
console.log(`ens_t7_resolver=${verification.observed.resolver}`);
console.log(
  `ens_t7_records=${Object.keys(verification.observed.records).length}`,
);
