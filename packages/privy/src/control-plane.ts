import {
  createAuthorizationContext,
  createPrivyRestAuthorizationHeaders,
  type Aggregation,
  type AggregationInput,
  type OwnerCredentials,
  type Policy,
  type PrivyControlEnvironment,
  type PrivySdkClient,
} from "./t3-runtime.js";
import type { PolicyCreateParams } from "@privy-io/node/resources";

export class PrivyControlPlaneError extends Error {
  public constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "PrivyControlPlaneError";
  }
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
  if (!response.ok) {
    throw new PrivyControlPlaneError(
      `Privy control request failed with HTTP ${response.status}`,
      response.status,
    );
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new PrivyControlPlaneError(
      "Privy control response was not a JSON object",
    );
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
    throw new PrivyControlPlaneError(
      "Privy aggregation response did not include an ID",
    );
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

export async function attachAgentPolicy(
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
    throw new PrivyControlPlaneError(
      "Privy did not attach the expected delegated policy",
    );
  }
}

export async function removeAgentSigner(
  client: PrivySdkClient,
  walletId: string,
  owner: OwnerCredentials,
): Promise<void> {
  const wallet = await client.wallets().update(walletId, {
    additional_signers: [],
    authorization_context: createAuthorizationContext(owner.privateKey),
  });
  if (wallet.additional_signers.length !== 0) {
    throw new PrivyControlPlaneError(
      "Privy did not remove the delegated signer",
    );
  }
}

export async function deletePolicy(
  client: PrivySdkClient,
  policy: Policy,
  owner: OwnerCredentials,
): Promise<void> {
  await client.policies().delete(policy.id, {
    authorization_context: createAuthorizationContext(owner.privateKey),
  });
}

export function policyCreateParams(
  plan: { readonly policy: PolicyCreateParams },
  idempotencyKey: string,
): PolicyCreateParams & { readonly idempotency_key: string } {
  return { ...plan.policy, idempotency_key: idempotencyKey };
}
