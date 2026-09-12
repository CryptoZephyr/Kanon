import {
  buildT3PolicyBody,
  buildT3Transaction,
  deriveAuthorizationPublicKey,
  expectedDelegationRejectionStatus,
  expectedPolicyRejectionStatus,
  normalizeBase64Der,
  normalizeAuthorizationPrivateKey,
  type T3PolicyInput,
} from "../packages/privy/src/feasibility.js";
import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";

const input: T3PolicyInput = {
  ownerId: "owner-quorum-id",
  chainId: 11155111,
  recipient: "0x1111111111111111111111111111111111111111",
  maxValueWei: 1n,
  name: "Kanon T3 delegated signer policy",
};

describe("Privy feasibility spike helpers", () => {
  it("builds a narrow, provisional policy fixture", () => {
    const policy = buildT3PolicyBody(input);

    expect(policy).toMatchObject({
      version: "1.0",
      name: input.name,
      chain_type: "ethereum",
      owner_id: input.ownerId,
    });
    expect(policy.rules).toHaveLength(2);
    expect(policy.rules.map((rule) => rule.method)).toEqual([
      "eth_signTransaction",
      "eth_sendTransaction",
    ]);
    expect(policy.rules.every((rule) => rule.action === "ALLOW")).toBe(true);
    expect(policy.rules.every((rule) => rule.conditions)).toBe(true);
    expect(policy.rules[0]?.conditions).toEqual([
      {
        field_source: "ethereum_transaction",
        field: "chain_id",
        operator: "eq",
        value: "11155111",
      },
      {
        field_source: "ethereum_transaction",
        field: "to",
        operator: "eq",
        value: input.recipient,
      },
      {
        field_source: "ethereum_transaction",
        field: "value",
        operator: "lte",
        value: "0x1",
      },
    ]);
    expect(policy.rules.some((rule) => rule.method === "*")).toBe(false);
  });

  it("builds a transaction that carries the same explicitly tested scope", () => {
    expect(
      buildT3Transaction({
        chainId: input.chainId,
        recipient: input.recipient,
        valueWei: input.maxValueWei,
      }),
    ).toEqual({
      chain_id: 11155111,
      to: input.recipient,
      value: "0x1",
    });
  });

  it("recognizes only HTTP statuses used for a policy rejection", () => {
    expect(expectedPolicyRejectionStatus(400)).toBe(true);
    expect(expectedPolicyRejectionStatus(403)).toBe(true);
    expect(expectedPolicyRejectionStatus(422)).toBe(true);
    expect(expectedPolicyRejectionStatus(401)).toBe(false);
    expect(expectedPolicyRejectionStatus(500)).toBe(false);
    expect(expectedPolicyRejectionStatus(undefined)).toBe(false);
    expect(expectedDelegationRejectionStatus(401)).toBe(true);
    expect(expectedDelegationRejectionStatus(403)).toBe(true);
    expect(expectedDelegationRejectionStatus(500)).toBe(false);
  });

  it("derives the Privy public key format from a PKCS8 private key", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    const privateKeyBase64 = privateKey
      .export({ format: "der", type: "pkcs8" })
      .toString("base64");
    const publicKeyBase64 = publicKey
      .export({ format: "der", type: "spki" })
      .toString("base64");

    expect(deriveAuthorizationPublicKey(privateKeyBase64)).toBe(
      publicKeyBase64,
    );
    expect(normalizeBase64Der(` ${publicKeyBase64}\n`)).toBe(publicKeyBase64);
    expect(normalizeAuthorizationPrivateKey(`label:${privateKeyBase64}`)).toBe(
      privateKeyBase64,
    );
    expect(
      normalizeAuthorizationPrivateKey(
        `-----BEGIN PRIVATE KEY-----\\n${privateKeyBase64}\\n-----END PRIVATE KEY-----`,
      ),
    ).toBe(privateKeyBase64);
  });

  it("rejects malformed authorization key material", () => {
    expect(() => deriveAuthorizationPublicKey("")).toThrow(/private key/);
    expect(() => deriveAuthorizationPublicKey("not-a-key")).toThrow(
      /private key/,
    );
    expect(() => deriveAuthorizationPublicKey("not a key")).toThrow(
      /private key/,
    );
  });
});
