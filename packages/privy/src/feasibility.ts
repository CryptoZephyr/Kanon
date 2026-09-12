import { createPrivateKey, createPublicKey } from "node:crypto";
import type {
  PolicyCreateParams,
  UnsignedStandardEthereumTransaction,
} from "@privy-io/node/resources";
import { encodeFunctionData, type Hex } from "viem";

export const T3_PROBE_ABI = [
  {
    type: "function",
    name: "ping",
    inputs: [{ name: "nonce", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "pong",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export interface T3PolicyInput {
  readonly ownerId: string;
  readonly chainId: number;
  readonly recipient: string;
  readonly maxValueWei: bigint;
  readonly name: string;
}

function toQuantity(value: bigint | number): string {
  const quantity = typeof value === "bigint" ? value : BigInt(value);
  if (quantity < 0n) {
    throw new RangeError("quantity must be non-negative");
  }

  return `0x${quantity.toString(16)}`;
}

function assertT3PolicyInput(input: T3PolicyInput): void {
  if (input.ownerId.trim() !== input.ownerId || input.ownerId.length === 0) {
    throw new TypeError("ownerId must be non-blank");
  }

  if (!Number.isSafeInteger(input.chainId) || input.chainId <= 0) {
    throw new TypeError("chainId must be a positive safe integer");
  }

  if (!/^0x[0-9a-fA-F]{40}$/.test(input.recipient)) {
    throw new TypeError("recipient must be an EVM address");
  }

  if (input.maxValueWei < 0n) {
    throw new RangeError("maxValueWei must be non-negative");
  }

  if (
    input.name.length === 0 ||
    input.name.length > 50 ||
    input.name.trim() !== input.name
  ) {
    throw new TypeError("name must be a 1-50 character label");
  }
}

export function buildT3PolicyBody(input: T3PolicyInput): PolicyCreateParams {
  assertT3PolicyInput(input);

  const conditions = [
    {
      field_source: "ethereum_transaction" as const,
      field: "chain_id" as const,
      operator: "eq" as const,
      value: String(input.chainId),
    },
    {
      field_source: "ethereum_transaction" as const,
      field: "to" as const,
      operator: "eq" as const,
      value: input.recipient,
    },
    {
      field_source: "ethereum_transaction" as const,
      field: "value" as const,
      operator: "lte" as const,
      value: toQuantity(input.maxValueWei),
    },
  ];

  const methods = ["eth_signTransaction", "eth_sendTransaction"] as const;

  return {
    version: "1.0",
    name: input.name,
    chain_type: "ethereum",
    owner_id: input.ownerId,
    rules: methods.map((method) => ({
      name: `Allow T3 ${method}`,
      method,
      action: "ALLOW" as const,
      conditions,
    })),
  };
}

export function buildT3Transaction(input: {
  readonly chainId: number;
  readonly recipient: string;
  readonly valueWei: bigint;
  readonly data?: string;
}): UnsignedStandardEthereumTransaction {
  if (!Number.isSafeInteger(input.chainId) || input.chainId <= 0) {
    throw new TypeError("chainId must be a positive safe integer");
  }

  if (!/^0x[0-9a-fA-F]{40}$/.test(input.recipient)) {
    throw new TypeError("recipient must be an EVM address");
  }

  if (
    input.data !== undefined &&
    (!/^0x(?:[0-9a-fA-F]{2})*$/.test(input.data) || input.data.length === 2)
  ) {
    throw new TypeError("data must be an even-length hex string");
  }

  return {
    chain_id: input.chainId,
    to: input.recipient,
    value: toQuantity(input.valueWei),
    ...(input.data === undefined ? {} : { data: input.data as Hex }),
  };
}

export function buildT3ProbeCalldata(
  functionName: "ping" | "pong",
  nonce?: bigint,
): Hex {
  if (functionName === "ping") {
    if (nonce === undefined) {
      throw new TypeError("ping probe calldata requires a nonce");
    }

    return encodeFunctionData({
      abi: T3_PROBE_ABI,
      functionName: "ping",
      args: [nonce],
    });
  }

  return encodeFunctionData({
    abi: T3_PROBE_ABI,
    functionName: "pong",
  });
}

export function expectedPolicyRejectionStatus(
  status: number | undefined,
): boolean {
  return status === 400 || status === 403 || status === 422;
}

export function expectedDelegationRejectionStatus(
  status: number | undefined,
): boolean {
  return status === 400 || status === 401 || status === 403 || status === 422;
}

export function deriveAuthorizationPublicKey(privateKey: string): string {
  const normalizedPrivateKey = normalizeAuthorizationPrivateKey(privateKey);
  try {
    const key = createPrivateKey({
      key: Buffer.from(normalizedPrivateKey, "base64"),
      format: "der",
      type: "pkcs8",
    });
    return createPublicKey(key)
      .export({ format: "der", type: "spki" })
      .toString("base64");
  } catch {
    throw new TypeError("authorization private key must be base64 PKCS8");
  }
}

export function normalizeAuthorizationPrivateKey(value: string): string {
  const trimmed = value.trim().replace(/\\n/g, "\n");
  const candidates = new Set<string>([trimmed]);

  const colonIndex = trimmed.indexOf(":");
  if (colonIndex > 0 && trimmed.indexOf(":", colonIndex + 1) === -1) {
    candidates.add(trimmed.slice(colonIndex + 1));
  }

  if (trimmed.includes("BEGIN PRIVATE KEY")) {
    candidates.add(
      trimmed
        .replace(/-----BEGIN PRIVATE KEY-----/g, "")
        .replace(/-----END PRIVATE KEY-----/g, ""),
    );
  }

  for (const candidate of candidates) {
    const compact = candidate.replace(/\s/g, "");
    if (compact.length === 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) {
      continue;
    }

    try {
      createPrivateKey({
        key: Buffer.from(compact, "base64"),
        format: "der",
        type: "pkcs8",
      });
      return compact;
    } catch {
      continue;
    }
  }

  throw new TypeError("authorization private key must be base64 PKCS8");
}

export function normalizeBase64Der(value: string): string {
  return value.replace(/\s/g, "");
}
