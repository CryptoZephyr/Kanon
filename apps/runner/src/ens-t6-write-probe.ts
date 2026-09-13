import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  decodeFunctionResult,
  encodeFunctionData,
  getAddress,
  http,
  isAddressEqual,
  keccak256,
  namehash,
  parseEventLogs,
  stringToHex,
  zeroAddress,
  zeroHash,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const ENS_REGISTRAR = getAddress("0xa88553f454b77203b0d036a05c894d555eaaa2cc");
const ENS_REGISTRY = getAddress("0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2");
const FACTORY = getAddress("0x10dc6333cdfe1fcef624c6e0a8221b91804cd7ef");
const USER_REGISTRY_IMPLEMENTATION = getAddress(
  "0x624a25d67b59d587752ebec8dded8827dae52050",
);
const PERMISSIONED_RESOLVER_IMPLEMENTATION = getAddress(
  "0x9eae5c2730a7dd16bdd1dee6421a1b91e3b0365e",
);
const UNIVERSAL_RESOLVER = getAddress(
  "0x4a1817d13e9cf196f471725176355c1234b63c70",
);
const MOCK_USDC = getAddress("0x768f42455a2d082e23ceef7d51e5787c82d67a39");
const CONTROL_WALLET = getAddress("0x8b88E1E1174eDC65B08de75A5439f130da8A3DFd");
const REPRESENTATIVE_AGENT_OWNER = getAddress(
  "0x42D5Fb257d479187607D47C19433Be6aEEd4a9A9",
);
const PARENT_LABEL = "kanon-ethonline-2026";
const PARENT_NAME = `${PARENT_LABEL}.eth`;
const AGENTS_LABEL = "agents";
const REPRESENTATIVE_LABEL = "representative-agent";
const REPRESENTATIVE_NAME = `${REPRESENTATIVE_LABEL}.${AGENTS_LABEL}.${PARENT_NAME}`;
const RECORD_KEYS = [
  "kanon.agentId",
  "kanon.release",
  "kanon.permissionHash",
  "kanon.status",
] as const;
const RECORD_VALUES: Record<(typeof RECORD_KEYS)[number], string> = {
  "kanon.agentId": "com.example.treasury",
  "kanon.release": "release-t6-ethonline-2026",
  "kanon.permissionHash":
    "sha256:7171a1991636a5923a86991b8b9f284b9a5a5082458645a05d7f69f0f0eed56b",
  "kanon.status": "approved",
};

const REGISTRAR_ABI = [
  {
    type: "function",
    name: "MIN_COMMITMENT_AGE",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint64" }],
  },
  {
    type: "function",
    name: "commit",
    stateMutability: "nonpayable",
    inputs: [{ name: "commitment", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "commitmentAt",
    stateMutability: "view",
    inputs: [{ name: "commitment", type: "bytes32" }],
    outputs: [{ type: "uint64" }],
  },
  {
    type: "function",
    name: "getRegisterPrice",
    stateMutability: "view",
    inputs: [
      { name: "label", type: "string" },
      { name: "duration", type: "uint64" },
      { name: "paymentToken", type: "address" },
    ],
    outputs: [
      { name: "base", type: "uint256" },
      { name: "premium", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "isAvailable",
    stateMutability: "view",
    inputs: [{ name: "label", type: "string" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "makeCommitment",
    stateMutability: "pure",
    inputs: [
      { name: "label", type: "string" },
      { name: "owner", type: "address" },
      { name: "secret", type: "bytes32" },
      { name: "subregistry", type: "address" },
      { name: "resolver", type: "address" },
      { name: "duration", type: "uint64" },
      { name: "referrer", type: "bytes32" },
    ],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [
      { name: "label", type: "string" },
      { name: "owner", type: "address" },
      { name: "secret", type: "bytes32" },
      { name: "subregistry", type: "address" },
      { name: "resolver", type: "address" },
      { name: "duration", type: "uint64" },
      { name: "paymentToken", type: "address" },
      { name: "referrer", type: "bytes32" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
] as const;

const REGISTRY_ABI = [
  {
    type: "function",
    name: "findOwner",
    stateMutability: "view",
    inputs: [{ name: "label", type: "string" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "findTokenId",
    stateMutability: "view",
    inputs: [{ name: "label", type: "string" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getParent",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "parent", type: "address" },
      { name: "label", type: "string" },
    ],
  },
  {
    type: "function",
    name: "getResolver",
    stateMutability: "view",
    inputs: [{ name: "label", type: "string" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "getSubregistry",
    stateMutability: "view",
    inputs: [{ name: "label", type: "string" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [
      { name: "label", type: "string" },
      { name: "owner", type: "address" },
      { name: "registry", type: "address" },
      { name: "resolver", type: "address" },
      { name: "roleBitmap", type: "uint256" },
      { name: "expiry", type: "uint64" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "setParent",
    stateMutability: "nonpayable",
    inputs: [
      { name: "parent", type: "address" },
      { name: "label", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setResolver",
    stateMutability: "nonpayable",
    inputs: [
      { name: "anyId", type: "uint256" },
      { name: "resolver", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setSubregistry",
    stateMutability: "nonpayable",
    inputs: [
      { name: "anyId", type: "uint256" },
      { name: "registry", type: "address" },
    ],
    outputs: [],
  },
] as const;

const FACTORY_ABI = [
  {
    type: "function",
    name: "deployProxy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "implementation", type: "address" },
      { name: "salt", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
    outputs: [{ name: "proxy", type: "address" }],
  },
  {
    type: "event",
    name: "ProxyDeployed",
    anonymous: false,
    inputs: [
      { indexed: true, name: "sender", type: "address" },
      { indexed: true, name: "proxyAddress", type: "address" },
      { indexed: false, name: "salt", type: "uint256" },
      { indexed: false, name: "implementation", type: "address" },
    ],
  },
] as const;

const USER_REGISTRY_ABI = [
  {
    type: "function",
    name: "initialize",
    stateMutability: "nonpayable",
    inputs: [
      { name: "rootAccount", type: "address" },
      { name: "roleBitmap", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const RESOLVER_ABI = [
  {
    type: "function",
    name: "authorizeTextRoles",
    stateMutability: "nonpayable",
    inputs: [
      { name: "toName", type: "bytes" },
      { name: "key", type: "string" },
      { name: "account", type: "address" },
      { name: "grant", type: "bool" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "hasRootRoles",
    stateMutability: "view",
    inputs: [
      { name: "roleBitmap", type: "uint256" },
      { name: "account", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "initialize",
    stateMutability: "nonpayable",
    inputs: [
      { name: "admin", type: "address" },
      { name: "roleBitmap", type: "uint256" },
      { name: "setters", type: "bytes[]" },
    ],
    outputs: [],
  },
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

const ERC20_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const ROLE_REGISTRAR = 1n << 0n;
const ROLE_SET_PARENT = 1n << 8n;
const ROLE_RENEW = 1n << 16n;
const ROLE_SET_SUBREGISTRY = 1n << 20n;
const ROLE_SET_RESOLVER = 1n << 24n;
const ROLE_SET_TEXT = 1n << 4n;
const ROLE_SET_TEXT_ADMIN = ROLE_SET_TEXT << 128n;
const REGISTRY_ROOT_ROLES =
  ROLE_REGISTRAR |
  ROLE_RENEW |
  ROLE_SET_PARENT |
  ROLE_SET_SUBREGISTRY |
  ROLE_SET_RESOLVER;
const AGENT_NAMESPACE_ROLES = ROLE_SET_SUBREGISTRY | ROLE_SET_RESOLVER;
const MAX_EXPIRY = (1n << 64n) - 1n;
const REGISTRATION_DURATION = 31_536_000n;
const EVIDENCE_PATH = "evidence/ens/t6-write-latest.json";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function dnsEncode(name: string): Hex {
  const encoded = name
    .split(".")
    .map((label) => {
      const bytes = stringToHex(label).slice(2);
      const length = bytes.length / 2;
      if (length === 0 || length > 255) {
        throw new Error(`invalid DNS label length for ${label}`);
      }
      return `${length.toString(16).padStart(2, "0")}${bytes}`;
    })
    .join("");
  return `0x${encoded}00` as Hex;
}

function deploymentSalt(label: string): bigint {
  return BigInt(keccak256(stringToHex(`kanon-t6:${label}`)));
}

const rpcUrl = requiredEnv("ENS_SEPOLIA_RPC_URL");
const controlPrivateKey = requiredEnv("ENS_CONTROL_PRIVATE_KEY") as Hex;
const configuredNamespace = requiredEnv("ENS_ORG_NAMESPACE");
if (configuredNamespace !== PARENT_NAME) {
  throw new Error(`ENS_ORG_NAMESPACE must equal ${PARENT_NAME}`);
}

const account = privateKeyToAccount(controlPrivateKey);
if (!isAddressEqual(account.address, CONTROL_WALLET)) {
  throw new Error(
    "ENS_CONTROL_PRIVATE_KEY does not derive the configured Kanon control wallet",
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

type TxMap = Record<string, string>;

async function waitForSuccess(hash: Hex) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`transaction reverted: ${hash}`);
  }
  return receipt;
}

async function writeRegistryParent(
  registry: Address,
  parent: Address,
  label: string,
) {
  const hash = await walletClient.writeContract({
    address: registry,
    abi: REGISTRY_ABI,
    functionName: "setParent",
    args: [parent, label],
  });
  await waitForSuccess(hash);
  return hash;
}

async function writeRegistrySubregistry(
  registry: Address,
  tokenId: bigint,
  subregistry: Address,
) {
  const hash = await walletClient.writeContract({
    address: registry,
    abi: REGISTRY_ABI,
    functionName: "setSubregistry",
    args: [tokenId, subregistry],
  });
  await waitForSuccess(hash);
  return hash;
}

async function writeRegistryResolver(
  registry: Address,
  tokenId: bigint,
  resolver: Address,
) {
  const hash = await walletClient.writeContract({
    address: registry,
    abi: REGISTRY_ABI,
    functionName: "setResolver",
    args: [tokenId, resolver],
  });
  await waitForSuccess(hash);
  return hash;
}

async function registerChild(
  registry: Address,
  label: string,
  owner: Address,
  subregistry: Address,
  resolver: Address,
  roleBitmap: bigint,
) {
  const hash = await walletClient.writeContract({
    address: registry,
    abi: REGISTRY_ABI,
    functionName: "register",
    args: [label, owner, subregistry, resolver, roleBitmap, MAX_EXPIRY],
  });
  await waitForSuccess(hash);
  return hash;
}

async function deployUserRegistry(saltLabel: string) {
  const data = encodeFunctionData({
    abi: USER_REGISTRY_ABI,
    functionName: "initialize",
    args: [CONTROL_WALLET, REGISTRY_ROOT_ROLES],
  });
  const hash = await walletClient.writeContract({
    address: FACTORY,
    abi: FACTORY_ABI,
    functionName: "deployProxy",
    args: [USER_REGISTRY_IMPLEMENTATION, deploymentSalt(saltLabel), data],
  });
  const receipt = await waitForSuccess(hash);
  const logs = parseEventLogs({
    abi: FACTORY_ABI,
    eventName: "ProxyDeployed",
    logs: receipt.logs,
  });
  const proxy = logs[0]?.args.proxyAddress;
  if (!proxy) {
    throw new Error(`UserRegistry proxy event missing: ${hash}`);
  }
  return { address: proxy, hash };
}

async function deployResolver(saltLabel: string) {
  const data = encodeFunctionData({
    abi: RESOLVER_ABI,
    functionName: "initialize",
    args: [CONTROL_WALLET, ROLE_SET_TEXT_ADMIN, [] as Hex[]],
  });
  const hash = await walletClient.writeContract({
    address: FACTORY,
    abi: FACTORY_ABI,
    functionName: "deployProxy",
    args: [
      PERMISSIONED_RESOLVER_IMPLEMENTATION,
      deploymentSalt(saltLabel),
      data,
    ],
  });
  const receipt = await waitForSuccess(hash);
  const logs = parseEventLogs({
    abi: FACTORY_ABI,
    eventName: "ProxyDeployed",
    logs: receipt.logs,
  });
  const proxy = logs[0]?.args.proxyAddress;
  if (!proxy) {
    throw new Error(`PermissionedResolver proxy event missing: ${hash}`);
  }
  return { address: proxy, hash };
}

async function authorizeTextRole(resolver: Address, key: string) {
  const hash = await walletClient.writeContract({
    address: resolver,
    abi: RESOLVER_ABI,
    functionName: "authorizeTextRoles",
    args: [dnsEncode(REPRESENTATIVE_NAME), key, CONTROL_WALLET, true],
  });
  await waitForSuccess(hash);
  return hash;
}

async function writeText(
  resolver: Address,
  node: Hex,
  key: string,
  value: string,
) {
  const hash = await walletClient.writeContract({
    address: resolver,
    abi: RESOLVER_ABI,
    functionName: "setText",
    args: [node, key, value],
  });
  await waitForSuccess(hash);
  return hash;
}

async function readTextViaUniversal(name: string, key: string) {
  const node = namehash(name);
  const data = encodeFunctionData({
    abi: RESOLVER_ABI,
    functionName: "text",
    args: [node, key],
  });
  const [response, resolver] = await publicClient.readContract({
    address: UNIVERSAL_RESOLVER,
    abi: UNIVERSAL_RESOLVER_ABI,
    functionName: "resolve",
    args: [dnsEncode(name), data],
  });
  const value = decodeFunctionResult({
    abi: RESOLVER_ABI,
    functionName: "text",
    data: response,
  });
  return { value, resolver };
}

async function waitForCommitment(commitment: Hex) {
  const minimumAge = await publicClient.readContract({
    address: ENS_REGISTRAR,
    abi: REGISTRAR_ABI,
    functionName: "MIN_COMMITMENT_AGE",
  });
  const committedAt = await publicClient.readContract({
    address: ENS_REGISTRAR,
    abi: REGISTRAR_ABI,
    functionName: "commitmentAt",
    args: [commitment],
  });
  if (committedAt === 0n) {
    throw new Error("ENS registrar commitment was not recorded");
  }
  for (;;) {
    const block = await publicClient.getBlock();
    const elapsed = block.timestamp - committedAt;
    if (elapsed >= minimumAge) {
      return;
    }
    const remaining = minimumAge - elapsed;
    console.log(`commitment_wait_seconds=${remaining}`);
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(Number(remaining) * 1000, 5_000)),
    );
  }
}

async function main() {
  const transactions: TxMap = {};
  const initialBalance = await publicClient.getBalance({
    address: CONTROL_WALLET,
  });
  const initialCodeChecks = await Promise.all(
    [
      ENS_REGISTRAR,
      ENS_REGISTRY,
      FACTORY,
      PERMISSIONED_RESOLVER_IMPLEMENTATION,
      UNIVERSAL_RESOLVER,
    ].map(
      async (address) =>
        [address, Boolean(await publicClient.getCode({ address }))] as const,
    ),
  );
  if (initialCodeChecks.some(([, present]) => !present)) {
    throw new Error(
      "one or more official ENSv2 Sepolia deployments have no bytecode",
    );
  }

  const availabilityBeforeWrite = await publicClient.readContract({
    address: ENS_REGISTRAR,
    abi: REGISTRAR_ABI,
    functionName: "isAvailable",
    args: [PARENT_LABEL],
  });
  let parentWasRegisteredByThisRun = false;
  const currentOwner = await publicClient.readContract({
    address: ENS_REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "findOwner",
    args: [PARENT_LABEL],
  });
  if (
    !availabilityBeforeWrite &&
    !isAddressEqual(currentOwner, CONTROL_WALLET)
  ) {
    throw new Error(
      `exact ENS namespace is unavailable on Sepolia: ${PARENT_NAME} is controlled by another owner`,
    );
  }

  if (availabilityBeforeWrite) {
    const paymentPrice = await publicClient.readContract({
      address: ENS_REGISTRAR,
      abi: REGISTRAR_ABI,
      functionName: "getRegisterPrice",
      args: [PARENT_LABEL, REGISTRATION_DURATION, MOCK_USDC],
    });
    const totalPayment = paymentPrice[0] + paymentPrice[1];
    const paymentBalance = await publicClient.readContract({
      address: MOCK_USDC,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [CONTROL_WALLET],
    });
    if (paymentBalance < totalPayment) {
      const mintHash = await walletClient.writeContract({
        address: MOCK_USDC,
        abi: ERC20_ABI,
        functionName: "mint",
        args: [CONTROL_WALLET, totalPayment + 1_000_000n],
      });
      await waitForSuccess(mintHash);
      transactions.paymentMint = mintHash;
    }
    const allowance = await publicClient.readContract({
      address: MOCK_USDC,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [CONTROL_WALLET, ENS_REGISTRAR],
    });
    if (allowance < totalPayment) {
      const approveHash = await walletClient.writeContract({
        address: MOCK_USDC,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [ENS_REGISTRAR, totalPayment],
      });
      await waitForSuccess(approveHash);
      transactions.paymentApproval = approveHash;
    }
    const secret = `0x${randomBytes(32).toString("hex")}` as Hex;
    const commitment = await publicClient.readContract({
      address: ENS_REGISTRAR,
      abi: REGISTRAR_ABI,
      functionName: "makeCommitment",
      args: [
        PARENT_LABEL,
        CONTROL_WALLET,
        secret,
        zeroAddress,
        zeroAddress,
        REGISTRATION_DURATION,
        zeroHash,
      ],
    });
    const commitHash = await walletClient.writeContract({
      address: ENS_REGISTRAR,
      abi: REGISTRAR_ABI,
      functionName: "commit",
      args: [commitment],
    });
    await waitForSuccess(commitHash);
    transactions.parentCommit = commitHash;
    await waitForCommitment(commitment);
    const stillAvailable = await publicClient.readContract({
      address: ENS_REGISTRAR,
      abi: REGISTRAR_ABI,
      functionName: "isAvailable",
      args: [PARENT_LABEL],
    });
    if (!stillAvailable) {
      throw new Error(
        `exact ENS namespace became unavailable before registration: ${PARENT_NAME}`,
      );
    }
    const registerHash = await walletClient.writeContract({
      address: ENS_REGISTRAR,
      abi: REGISTRAR_ABI,
      functionName: "register",
      args: [
        PARENT_LABEL,
        CONTROL_WALLET,
        secret,
        zeroAddress,
        zeroAddress,
        REGISTRATION_DURATION,
        MOCK_USDC,
        zeroHash,
      ],
    });
    await waitForSuccess(registerHash);
    transactions.parentRegister = registerHash;
    parentWasRegisteredByThisRun = true;
    const revokeApprovalHash = await walletClient.writeContract({
      address: MOCK_USDC,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [ENS_REGISTRAR, 0n],
    });
    await waitForSuccess(revokeApprovalHash);
    transactions.paymentApprovalRevoke = revokeApprovalHash;
  }

  const parentOwner = await publicClient.readContract({
    address: ENS_REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "findOwner",
    args: [PARENT_LABEL],
  });
  if (!isAddressEqual(parentOwner, CONTROL_WALLET)) {
    throw new Error(
      "control wallet does not own the registered ENS organization namespace",
    );
  }

  let parentRegistry = await publicClient.readContract({
    address: ENS_REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "getSubregistry",
    args: [PARENT_LABEL],
  });
  if (isAddressEqual(parentRegistry, zeroAddress)) {
    const deployed = await deployUserRegistry("parent-registry");
    parentRegistry = deployed.address;
    transactions.parentRegistryDeploy = deployed.hash;
    const parentTokenId = await publicClient.readContract({
      address: ENS_REGISTRY,
      abi: REGISTRY_ABI,
      functionName: "findTokenId",
      args: [PARENT_LABEL],
    });
    transactions.parentSubregistry = await writeRegistrySubregistry(
      ENS_REGISTRY,
      parentTokenId,
      parentRegistry,
    );
    transactions.parentRegistryParent = await writeRegistryParent(
      parentRegistry,
      ENS_REGISTRY,
      PARENT_LABEL,
    );
  }
  if (!(await publicClient.getCode({ address: parentRegistry }))) {
    throw new Error("parent child registry has no bytecode");
  }

  let agentsRegistry = await publicClient.readContract({
    address: parentRegistry,
    abi: REGISTRY_ABI,
    functionName: "getSubregistry",
    args: [AGENTS_LABEL],
  });
  if (isAddressEqual(agentsRegistry, zeroAddress)) {
    const deployed = await deployUserRegistry("agents-registry");
    agentsRegistry = deployed.address;
    transactions.agentsRegistryDeploy = deployed.hash;
    const agentsRegisterHash = await registerChild(
      parentRegistry,
      AGENTS_LABEL,
      CONTROL_WALLET,
      agentsRegistry,
      zeroAddress,
      AGENT_NAMESPACE_ROLES,
    );
    transactions.agentsRegister = agentsRegisterHash;
    transactions.agentsRegistryParent = await writeRegistryParent(
      agentsRegistry,
      parentRegistry,
      AGENTS_LABEL,
    );
  }
  if (!(await publicClient.getCode({ address: agentsRegistry }))) {
    throw new Error("agents child registry has no bytecode");
  }
  const agentsOwner = await publicClient.readContract({
    address: parentRegistry,
    abi: REGISTRY_ABI,
    functionName: "findOwner",
    args: [AGENTS_LABEL],
  });
  if (!isAddressEqual(agentsOwner, CONTROL_WALLET)) {
    throw new Error("control wallet does not own the agents namespace");
  }

  let resolver: Address = await publicClient.readContract({
    address: agentsRegistry,
    abi: REGISTRY_ABI,
    functionName: "getResolver",
    args: [REPRESENTATIVE_LABEL],
  });
  let representativeOwner = await publicClient.readContract({
    address: agentsRegistry,
    abi: REGISTRY_ABI,
    functionName: "findOwner",
    args: [REPRESENTATIVE_LABEL],
  });
  if (isAddressEqual(representativeOwner, zeroAddress)) {
    const deployed = await deployResolver("representative-agent-resolver");
    resolver = deployed.address;
    transactions.resolverDeploy = deployed.hash;
    transactions.representativeAgentRegister = await registerChild(
      agentsRegistry,
      REPRESENTATIVE_LABEL,
      REPRESENTATIVE_AGENT_OWNER,
      zeroAddress,
      resolver,
      0n,
    );
  } else if (!isAddressEqual(representativeOwner, REPRESENTATIVE_AGENT_OWNER)) {
    throw new Error(
      "representative agent name is owned by an unexpected address",
    );
  } else if (isAddressEqual(resolver, zeroAddress)) {
    const representativeTokenId = await publicClient.readContract({
      address: agentsRegistry,
      abi: REGISTRY_ABI,
      functionName: "findTokenId",
      args: [REPRESENTATIVE_LABEL],
    });
    const deployed = await deployResolver("representative-agent-resolver");
    resolver = deployed.address;
    transactions.resolverDeploy = deployed.hash;
    transactions.representativeResolver = await writeRegistryResolver(
      agentsRegistry,
      representativeTokenId,
      resolver,
    );
  }
  representativeOwner = await publicClient.readContract({
    address: agentsRegistry,
    abi: REGISTRY_ABI,
    functionName: "findOwner",
    args: [REPRESENTATIVE_LABEL],
  });
  if (!isAddressEqual(representativeOwner, REPRESENTATIVE_AGENT_OWNER)) {
    throw new Error(
      "representative agent owner did not verify after ENS registration",
    );
  }
  if (!(await publicClient.getCode({ address: resolver }))) {
    throw new Error(
      "representative-agent Permissioned Resolver has no bytecode",
    );
  }

  const resolverAdmin = await publicClient.readContract({
    address: resolver,
    abi: RESOLVER_ABI,
    functionName: "hasRootRoles",
    args: [ROLE_SET_TEXT_ADMIN, CONTROL_WALLET],
  });
  if (!resolverAdmin) {
    throw new Error(
      "control wallet is not the configured Permissioned Resolver text-role admin",
    );
  }
  const agentRootTextRoleBefore = await publicClient.readContract({
    address: resolver,
    abi: RESOLVER_ABI,
    functionName: "hasRootRoles",
    args: [ROLE_SET_TEXT, REPRESENTATIVE_AGENT_OWNER],
  });
  if (agentRootTextRoleBefore) {
    throw new Error(
      "representative agent unexpectedly has a root text-writer role",
    );
  }

  for (const key of RECORD_KEYS) {
    transactions[`authorize_${key}`] = await authorizeTextRole(resolver, key);
  }

  const representativeNode = namehash(REPRESENTATIVE_NAME);
  for (const key of RECORD_KEYS) {
    transactions[`write_${key}`] = await writeText(
      resolver,
      representativeNode,
      key,
      RECORD_VALUES[key],
    );
  }

  const authorizedStatusHash = await writeText(
    resolver,
    representativeNode,
    "kanon.status",
    "approved",
  );
  transactions.authorizedStatusRewrite = authorizedStatusHash;

  const statusBeforeUnauthorizedAttempt = await readTextViaUniversal(
    REPRESENTATIVE_NAME,
    "kanon.status",
  );
  const unauthorizedData = encodeFunctionData({
    abi: RESOLVER_ABI,
    functionName: "setText",
    args: [representativeNode, "kanon.status", "tampered-by-agent"],
  });
  let unauthorizedRejected = false;
  let unauthorizedErrorName = "";
  try {
    await publicClient.call({
      account: REPRESENTATIVE_AGENT_OWNER,
      to: resolver,
      data: unauthorizedData,
    });
  } catch (error) {
    unauthorizedRejected = true;
    unauthorizedErrorName =
      error instanceof Error ? error.name : "UnknownError";
  }
  if (!unauthorizedRejected) {
    throw new Error(
      "unauthorized representative agent resolver write was accepted",
    );
  }
  const statusAfterUnauthorizedAttempt = await readTextViaUniversal(
    REPRESENTATIVE_NAME,
    "kanon.status",
  );
  if (statusAfterUnauthorizedAttempt.value !== "approved") {
    throw new Error(
      "protected status changed after unauthorized writer attempt",
    );
  }

  const readBack: Record<string, string> = {};
  const resolutionResolvers: Record<string, Address> = {};
  for (const key of RECORD_KEYS) {
    const resolved = await readTextViaUniversal(REPRESENTATIVE_NAME, key);
    readBack[key] = resolved.value;
    resolutionResolvers[key] = resolved.resolver;
    if (resolved.value !== RECORD_VALUES[key]) {
      throw new Error(
        `ENS normal resolution returned an unexpected value for ${key}`,
      );
    }
  }
  if (
    Object.values(resolutionResolvers).some(
      (value) => !isAddressEqual(value, resolver),
    )
  ) {
    throw new Error("ENS normal resolution returned an unexpected resolver");
  }

  const [
    parentSubregistry,
    agentsSubregistry,
    representativeResolver,
    resolverPath,
  ] = await Promise.all([
    publicClient.readContract({
      address: ENS_REGISTRY,
      abi: REGISTRY_ABI,
      functionName: "getSubregistry",
      args: [PARENT_LABEL],
    }),
    publicClient.readContract({
      address: parentRegistry,
      abi: REGISTRY_ABI,
      functionName: "getSubregistry",
      args: [AGENTS_LABEL],
    }),
    publicClient.readContract({
      address: agentsRegistry,
      abi: REGISTRY_ABI,
      functionName: "getResolver",
      args: [REPRESENTATIVE_LABEL],
    }),
    publicClient.readContract({
      address: UNIVERSAL_RESOLVER,
      abi: UNIVERSAL_RESOLVER_ABI,
      functionName: "findResolver",
      args: [dnsEncode(REPRESENTATIVE_NAME)],
    }),
  ]);
  if (
    !isAddressEqual(parentSubregistry, parentRegistry) ||
    !isAddressEqual(agentsSubregistry, agentsRegistry) ||
    !isAddressEqual(representativeResolver, resolver) ||
    !isAddressEqual(resolverPath[0], resolver)
  ) {
    throw new Error("ENSv2 hierarchy or resolver path did not verify");
  }

  const controlTextRootRole = await publicClient.readContract({
    address: resolver,
    abi: RESOLVER_ABI,
    functionName: "hasRootRoles",
    args: [ROLE_SET_TEXT, CONTROL_WALLET],
  });
  const agentTextRootRole = await publicClient.readContract({
    address: resolver,
    abi: RESOLVER_ABI,
    functionName: "hasRootRoles",
    args: [ROLE_SET_TEXT, REPRESENTATIVE_AGENT_OWNER],
  });
  if (controlTextRootRole || agentTextRootRole) {
    throw new Error(
      "resolver root roles are broader than the intended scoped text permissions",
    );
  }

  const finalBalance = await publicClient.getBalance({
    address: CONTROL_WALLET,
  });
  const evidence = {
    milestone: "T6",
    status: "passed",
    recordedAt: new Date().toISOString(),
    network: { name: "Ethereum Sepolia", chainId: 11155111 },
    namespace: {
      parent: PARENT_NAME,
      agents: `${AGENTS_LABEL}.${PARENT_NAME}`,
      representativeAgent: REPRESENTATIVE_NAME,
      representativeLabel: REPRESENTATIVE_LABEL,
      availabilityBeforeWrite,
      parentWasRegisteredByThisRun,
    },
    actors: {
      controlWallet: CONTROL_WALLET,
      representativeAgentOwner: REPRESENTATIVE_AGENT_OWNER,
      controlWalletOwnsParent: isAddressEqual(parentOwner, CONTROL_WALLET),
      representativeAgentHasNoRegistryRoles: true,
    },
    deployments: {
      ethRegistrar: ENS_REGISTRAR,
      ethRegistry: ENS_REGISTRY,
      verifiableFactory: FACTORY,
      userRegistryImplementation: USER_REGISTRY_IMPLEMENTATION,
      permissionedResolverImplementation: PERMISSIONED_RESOLVER_IMPLEMENTATION,
      universalResolverV2: UNIVERSAL_RESOLVER,
      mockUsdc: MOCK_USDC,
      parentRegistry,
      agentsRegistry,
      permissionedResolver: resolver,
    },
    payment: {
      token: "MockUSDC",
      registrar: ENS_REGISTRAR,
      durationSeconds: REGISTRATION_DURATION.toString(),
      note: "Sepolia deployment test token only",
    },
    transactions,
    hierarchy: {
      parentOwner,
      parentSubregistry,
      agentsOwner,
      agentsSubregistry,
      representativeOwner,
      representativeResolver,
      universalResolver: {
        resolver: resolverPath[0],
        node: resolverPath[1],
        version: resolverPath[2].toString(),
      },
    },
    records: {
      protectedKeys: [...RECORD_KEYS],
      expected: RECORD_VALUES,
      readBackThroughUniversalResolver: readBack,
      resolverReturnedByNormalResolution: resolutionResolvers,
    },
    permissionProof: {
      resolverRootTextAdminForControl: resolverAdmin,
      controlHasNoRootTextWriterRole: !controlTextRootRole,
      representativeAgentHasNoRootTextWriterRole: !agentTextRootRole,
      scopedCompanyWriter: CONTROL_WALLET,
      authorizedCompanyWriteSucceeded: true,
      authorizedStatusRewrite: transactions.authorizedStatusRewrite,
      unauthorizedWriter: REPRESENTATIVE_AGENT_OWNER,
      unauthorizedWriteRejected: unauthorizedRejected,
      unauthorizedErrorName,
      protectedStatusUnchanged:
        statusBeforeUnauthorizedAttempt.value ===
        statusAfterUnauthorizedAttempt.value,
    },
    balance: {
      initialWei: initialBalance.toString(),
      finalWei: finalBalance.toString(),
    },
    references: {
      deploymentCommit: "97a57293f3b4279d94b571e678edb53ce62638f4",
      deployments: "https://docs.ens.domains/learn/deployments",
      permissionedRegistry:
        "https://docs.ens.domains/ensv2/permissioned-registry",
      permissionedResolver:
        "https://docs.ens.domains/ensv2/permissioned-resolver",
      enhancedAccessControl:
        "https://docs.ens.domains/ensv2/enhanced-access-control",
    },
  };
  await mkdir(dirname(EVIDENCE_PATH), { recursive: true });
  await writeFile(
    EVIDENCE_PATH,
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
  );
  console.log("ens_t6_write=passed");
  console.log(`ens_t6_parent=${PARENT_NAME}`);
  console.log(`ens_t6_agents=${AGENTS_LABEL}.${PARENT_NAME}`);
  console.log(`ens_t6_representative=${REPRESENTATIVE_NAME}`);
  console.log(`ens_t6_parent_owner=${parentOwner}`);
  console.log(`ens_t6_resolver=${resolver}`);
  console.log(`ens_t6_unauthorized_rejected=${unauthorizedRejected}`);
}

await main();
