export type InstallationStatus =
  | "VALIDATED"
  | "AWAITING_APPROVAL"
  | "CONFIGURING_AUTHORITY"
  | "ACTIVE"
  | "UPDATE_AVAILABLE"
  | "AWAITING_REAUTHORIZATION"
  | "REVOKING"
  | "REVOKED";

export interface AgentResource {
  readonly schema: "kanon.api.agent-capability";
  readonly version: 1;
  readonly agentId: string;
  readonly releaseId: string;
  readonly releaseVersion: string;
  readonly packageHash: string;
  readonly manifestHash: string;
  readonly manifest: {
    readonly schema: "kanon.agent";
    readonly agent: {
      readonly id: string;
      readonly releaseId: string;
      readonly version: string;
    };
    readonly runtime: { readonly entry: string };
    readonly capabilities: Record<string, unknown>;
    readonly packageHash: string;
    readonly manifestHash: string;
  };
}

export interface OrganizationResource {
  readonly schema: "kanon.api.organization";
  readonly version: 1;
  readonly id: string;
  readonly name: string;
  readonly controlWallet: string;
  readonly ensNamespace: string;
}

export interface WalletResource {
  readonly schema: "kanon.api.wallet";
  readonly version: 1;
  readonly walletId: string;
  readonly address: string;
  readonly chainId: number;
  readonly asset: "native";
  readonly status: "UNCONFIGURED" | "CONFIGURED" | "REVOKED";
}

export interface CompanyRule {
  readonly chainId: number;
  readonly asset: "native";
  readonly recipient: string;
  readonly maxValueWei: string;
  readonly calldata?: {
    readonly function: {
      readonly name: string;
      readonly inputs: readonly {
        readonly name: string;
        readonly type: string;
      }[];
    };
    readonly exactArguments: Readonly<Record<string, string>>;
  };
  readonly validityWindow?: {
    readonly notBeforeUnix?: number;
    readonly notAfterUnix?: number;
  };
  readonly rollingSpend?: {
    readonly maxValueWei: string;
    readonly windowSeconds: number;
  };
}

export interface CompanyTermsResource {
  readonly schema: "kanon.api.company-terms";
  readonly version: 1;
  readonly agentId: string;
  readonly releaseId: string;
  readonly manifestHash: string;
  readonly companyTerms: {
    readonly schema: "kanon.company-authority-terms";
    readonly version: 2;
    readonly authority: { readonly rules: readonly CompanyRule[] };
  };
  readonly permissionHash: string;
}

export interface ApprovalResource {
  readonly schema: "kanon.api.approval";
  readonly version: 1;
  readonly decision: {
    readonly id: string;
    readonly action: "APPROVE" | "REJECT" | "REAUTHORIZE" | "REVOKE";
    readonly outcome: "APPROVED" | "REJECTED";
    readonly decidedBy: string;
    readonly decidedAt: string;
    readonly agentId: string;
    readonly releaseId: string;
    readonly packageHash: string;
    readonly manifestHash: string;
    readonly permissionHash: string;
  };
}

export interface AuthorityResource {
  readonly schema: "kanon.api.active-authority";
  readonly version: 1;
  readonly installationId: string;
  readonly generation: number;
  readonly permissionHash: string;
  readonly privy: {
    readonly walletId: string;
    readonly delegatedSignerId: string;
    readonly policyId: string;
    readonly executionMethod: "eth_signTransaction" | "eth_sendTransaction";
    readonly aggregationId?: string;
    readonly permissionHash: string;
    readonly generation: number;
    readonly status: "ACTIVE" | "REVOKED";
  };
  readonly ens: {
    readonly binding: {
      readonly chainId: number;
      readonly organizationName: string;
      readonly namespaceName: string;
      readonly agentName: string;
      readonly agentNode: string;
      readonly resolver: string;
      readonly controlWallet: string;
    };
    readonly resolver: string;
    readonly records: Record<string, string>;
    readonly verified: boolean;
    readonly observedAt: string;
  };
}

export interface InstallationResource {
  readonly schema: "kanon.api.installation";
  readonly version: 1;
  readonly id: string;
  readonly organizationId: string;
  readonly status: InstallationStatus;
  readonly generation: number;
  readonly agent: AgentResource;
  readonly companyTerms: CompanyTermsResource;
  readonly approval?: ApprovalResource;
  readonly activeAuthority?: AuthorityResource;
  readonly updateDiff?: UpdateDiffResource;
  readonly evidence: readonly EvidenceResource[];
  readonly revoke?: {
    readonly status: "REVOKING" | "REVOKED";
    readonly privyAuthorityRevoked: boolean;
    readonly ensStatus: "approved" | "active" | "revoked";
    readonly postRevokeExecutionFailed: boolean;
  };
}

export interface UpdateDiffResource {
  readonly schema: "kanon.api.update-diff";
  readonly version: 1;
  readonly installationId: string;
  readonly proposal: {
    readonly release: AgentResource["manifest"] & {
      readonly packageHash: string;
    };
    readonly permissionSet: {
      readonly permissionHash: string;
      readonly companyTerms: CompanyTermsResource["companyTerms"];
    };
    readonly classification:
      | "NO_CHANGE"
      | "NARROWER"
      | "EXPANDED"
      | "SUBSTITUTED"
      | "UNKNOWN";
    readonly requiresHumanReview: boolean;
  };
  readonly diff: {
    readonly classification:
      | "NO_CHANGE"
      | "NARROWER"
      | "EXPANDED"
      | "SUBSTITUTED"
      | "UNKNOWN";
    readonly requiresHumanReview: boolean;
    readonly previousPermissionHash: string;
    readonly nextPermissionHash: string;
    readonly changedPaths: readonly string[];
    readonly reason?: string;
  };
}

export interface EvidenceResource {
  readonly schema:
    | "kanon.api.execution-evidence"
    | "kanon.api.revocation-evidence";
  readonly version: 1;
  readonly evidence: Record<string, unknown>;
}

export interface ProofResponse {
  readonly schema: "kanon.api.proof";
  readonly version: 1;
  readonly proof?: Record<string, unknown>;
  readonly requestId: string;
}

export interface ApiErrorPayload {
  readonly schema?: "kanon.api.error";
  readonly version?: 1;
  readonly code: string;
  readonly message?: string;
  readonly requestId?: string;
  readonly details?: Record<string, string>;
}

export class KanonApiError extends Error {
  public readonly code: string;
  public readonly status: number;

  public constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message ?? payload.code ?? "Kanon request failed");
    this.name = "KanonApiError";
    this.code = payload.code;
    this.status = status;
  }
}

type ApiSuccess<T> = {
  readonly schema: "kanon.api.success";
  readonly version: 1;
  readonly data: T;
};

function unwrap<T>(payload: unknown): T {
  if (
    payload &&
    typeof payload === "object" &&
    "schema" in payload &&
    payload.schema === "kanon.api.success" &&
    "data" in payload
  ) {
    return (payload as ApiSuccess<T>).data;
  }
  return payload as T;
}

export class KanonApi {
  private readonly baseUrl: string;

  public constructor(
    baseUrl = import.meta.env.VITE_KANON_API_BASE_URL || "/api",
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        ...(init.body === undefined
          ? {}
          : { "content-type": "application/json" }),
        ...init.headers,
      },
    });
    const payload = (await response.json().catch(() => ({}))) as unknown;
    if (!response.ok) {
      const errorPayload =
        payload && typeof payload === "object"
          ? (payload as ApiErrorPayload)
          : { code: "REQUEST_FAILED" };
      throw new KanonApiError(response.status, errorPayload);
    }
    return unwrap<T>(payload);
  }

  public health(): Promise<Record<string, unknown>> {
    return this.request("/healthz");
  }

  public organization(organizationId: string): Promise<OrganizationResource> {
    return this.request(
      `/v1/organizations/${encodeURIComponent(organizationId)}`,
    );
  }

  public wallet(organizationId: string): Promise<WalletResource> {
    return this.request(
      `/v1/organizations/${encodeURIComponent(organizationId)}/wallet`,
    );
  }

  public agent(
    organizationId: string,
    agentId: string,
  ): Promise<AgentResource> {
    return this.request(
      `/v1/organizations/${encodeURIComponent(organizationId)}/agents/${encodeURIComponent(agentId)}`,
    );
  }

  public installation(
    organizationId: string,
    installationId: string,
  ): Promise<InstallationResource> {
    return this.request(
      `/v1/organizations/${encodeURIComponent(organizationId)}/installations/${encodeURIComponent(installationId)}`,
    );
  }

  public async waitForInstallation(
    organizationId: string,
    installationId: string,
    initial: InstallationResource,
  ): Promise<InstallationResource> {
    let current = initial;
    for (let attempt = 0; attempt < 90; attempt += 1) {
      if (
        current.status !== "CONFIGURING_AUTHORITY" &&
        current.status !== "AWAITING_REAUTHORIZATION"
      ) {
        return current;
      }
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      current = await this.installation(organizationId, installationId);
    }
    return current;
  }

  public publishRelease(
    organizationId: string,
    agentId: string,
    release: Record<string, unknown>,
  ): Promise<AgentResource> {
    return this.request(
      `/v1/organizations/${encodeURIComponent(organizationId)}/agents/${encodeURIComponent(agentId)}/releases`,
      {
        method: "POST",
        body: JSON.stringify({
          schema: "kanon.api.publish-release",
          version: 1,
          organizationId,
          release,
        }),
      },
    );
  }

  public defineTerms(
    organizationId: string,
    installationId: string,
    companyTerms: { rules: readonly CompanyRule[] },
  ): Promise<InstallationResource> {
    return this.request(
      `/v1/organizations/${encodeURIComponent(organizationId)}/installations/${encodeURIComponent(installationId)}/company-terms`,
      {
        method: "POST",
        body: JSON.stringify({
          schema: "kanon.api.define-company-terms",
          version: 1,
          installationId,
          companyTerms,
        }),
      },
    );
  }

  public approval(
    organizationId: string,
    installationId: string,
    decision: Record<string, unknown>,
  ): Promise<InstallationResource> {
    return this.request(
      `/v1/organizations/${encodeURIComponent(organizationId)}/installations/${encodeURIComponent(installationId)}/approval`,
      {
        method: "POST",
        body: JSON.stringify({
          schema: "kanon.api.record-approval",
          version: 1,
          installationId,
          decision,
        }),
      },
    );
  }

  public updateDiff(
    organizationId: string,
    installationId: string,
  ): Promise<UpdateDiffResource> {
    return this.request(
      `/v1/organizations/${encodeURIComponent(organizationId)}/installations/${encodeURIComponent(installationId)}/update-diff`,
    );
  }

  public evidence(
    organizationId: string,
    installationId: string,
  ): Promise<readonly EvidenceResource[]> {
    return this.request(
      `/v1/organizations/${encodeURIComponent(organizationId)}/installations/${encodeURIComponent(installationId)}/evidence`,
    );
  }

  public revoke(
    organizationId: string,
    installationId: string,
    decision: Record<string, unknown>,
  ): Promise<InstallationResource> {
    return this.request(
      `/v1/organizations/${encodeURIComponent(organizationId)}/installations/${encodeURIComponent(installationId)}/revoke`,
      {
        method: "POST",
        body: JSON.stringify({
          schema: "kanon.api.revoke-request",
          version: 1,
          installationId,
          decision,
        }),
      },
    );
  }

  public proofLatest(): Promise<ProofResponse> {
    return this.request("/v1/proof/latest");
  }

  public startProof(): Promise<{
    readonly runId: string;
    readonly status: "running";
  }> {
    return this.request("/v1/proof/run", { method: "POST", body: "{}" });
  }

  public proof(runId: string): Promise<ProofResponse> {
    return this.request(`/v1/proof/runs/${encodeURIComponent(runId)}`);
  }
}
