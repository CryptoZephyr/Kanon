import {
  ENS_PROTECTED_RECORD_KEYS,
  EnsV2Adapter,
  bindReleaseToEnsIdentity,
  createApprovedStateWritePlan,
  createEnsIdentityBinding,
  createRevokedStatusWritePlan,
  normalizeEnsAddress,
  writeApprovedState,
  writeRevokedStatus,
} from "../packages/ens/src/index.js";
import type { PermissionHash } from "../packages/permissions/src/index.js";
import type {
  AgentId,
  ManifestHash,
  ReleaseId,
} from "../packages/manifest/src/index.js";
import { describe, expect, it } from "vitest";

const CONTROL = "0x8B88E1E1174eDC65B08de75A5439f130da8A3DFd";
const RESOLVER = "0x0D4560DaFEb04Cf022472B5085070A05E0d77e0B";
const AGENT_ID = "com.example.treasury" as AgentId;
const RELEASE_ID = "release-t6-ethonline-2026" as ReleaseId;
const PERMISSION_HASH =
  "sha256:7171a1991636a5923a86991b8b9f284b9a5a5082458645a05d7f69f0f0eed56b" as PermissionHash;

function binding() {
  return createEnsIdentityBinding({
    chainId: 11155111,
    organizationName: "kanon-ethonline-2026.eth",
    namespaceName: "agents.kanon-ethonline-2026.eth",
    agentName: "representative-agent.agents.kanon-ethonline-2026.eth",
    resolver: RESOLVER,
    controlWallet: CONTROL,
  });
}

function state() {
  return {
    agentId: AGENT_ID,
    releaseId: RELEASE_ID,
    permissionHash: PERMISSION_HASH,
    status: "approved" as const,
  };
}

describe("T7 ENS identity adapter", () => {
  it("normalizes the verified hierarchy and binds the node to the agent name", () => {
    const value = binding();
    expect(value.organizationName).toBe("kanon-ethonline-2026.eth");
    expect(value.namespaceName).toBe("agents.kanon-ethonline-2026.eth");
    expect(value.agentName).toBe(
      "representative-agent.agents.kanon-ethonline-2026.eth",
    );
    expect(value.controlWallet).toBe(CONTROL.toLowerCase());
    expect(value.resolver).toBe(RESOLVER.toLowerCase());
    expect(value.agentNode).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("rejects an identity that is outside the company namespace", () => {
    expect(() =>
      createEnsIdentityBinding({
        chainId: 11155111,
        organizationName: "kanon-ethonline-2026.eth",
        namespaceName: "other.example.eth",
        agentName: "agent.other.example.eth",
        resolver: RESOLVER,
        controlWallet: CONTROL,
      }),
    ).toThrow(/subname/);
  });

  it("reads protected records only from the bound resolver", async () => {
    const records = {
      "kanon.agentId": AGENT_ID,
      "kanon.release": RELEASE_ID,
      "kanon.permissionHash": PERMISSION_HASH,
      "kanon.status": "approved",
    };
    const adapter = new EnsV2Adapter(
      {
        findResolver: async () => ({
          resolver: RESOLVER,
          node: binding().agentNode,
        }),
        readText: async (_name, key) => ({
          resolver: RESOLVER,
          value: records[key],
        }),
      },
      { chainId: 11155111, universalResolverV2: normalizeEnsAddress(CONTROL) },
    );
    const result = await adapter.verifyApprovedState(binding(), state());
    expect(result.ok).toBe(true);
    expect(result.mismatches).toEqual([]);
    expect(Object.keys(result.observed.records)).toEqual([
      ...ENS_PROTECTED_RECORD_KEYS,
    ]);
  });

  it("fails closed when a record resolves from another resolver", async () => {
    const adapter = new EnsV2Adapter(
      {
        findResolver: async () => ({
          resolver: RESOLVER,
          node: binding().agentNode,
        }),
        readText: async () => ({
          resolver: CONTROL,
          value: "unexpected",
        }),
      },
      { chainId: 11155111, universalResolverV2: normalizeEnsAddress(CONTROL) },
    );
    await expect(adapter.readApprovedState(binding())).rejects.toThrow(
      /unexpected resolver/,
    );
  });

  it("creates no approved-state write plan before active Privy authority", () => {
    expect(() =>
      createApprovedStateWritePlan({
        binding: binding(),
        state: state(),
        authorization: {
          lifecycle: "APPROVED",
          privyAuthority: "REVOKED",
          agentId: AGENT_ID,
          releaseId: RELEASE_ID,
          permissionHash: PERMISSION_HASH,
        },
      }),
    ).toThrow(/active Privy/);
  });

  it("writes only the four public records after exact authorization", async () => {
    const plan = createApprovedStateWritePlan({
      binding: binding(),
      state: state(),
      authorization: {
        lifecycle: "APPROVED",
        privyAuthority: "ACTIVE",
        agentId: AGENT_ID,
        releaseId: RELEASE_ID,
        permissionHash: PERMISSION_HASH,
      },
    });
    let received: typeof plan | undefined;
    const hashes = await writeApprovedState(
      {
        writeProtectedRecords: async (value) => {
          received = value;
          return ["0xens-write"];
        },
      },
      plan,
    );
    expect(hashes).toEqual(["0xens-write"]);
    expect(received?.records).toEqual({
      "kanon.agentId": AGENT_ID,
      "kanon.release": RELEASE_ID,
      "kanon.permissionHash": PERMISSION_HASH,
      "kanon.status": "approved",
    });
    expect(received).not.toHaveProperty("companyTerms");
  });

  it("binds a release to approved public state without exposing company terms", () => {
    const result = bindReleaseToEnsIdentity({
      binding: binding(),
      release: {
        agentId: AGENT_ID,
        releaseId: RELEASE_ID,
        manifestHash: ("sha256:" + "a".repeat(64)) as ManifestHash,
      },
      permissionHash: PERMISSION_HASH,
    });
    expect(result).toEqual({
      agentId: AGENT_ID,
      releaseId: RELEASE_ID,
      permissionHash: PERMISSION_HASH,
      status: "approved",
    });
    expect(result).not.toHaveProperty("companyTerms");
  });

  it("allows only the control path to prepare a revoked status after Privy loss", async () => {
    expect(() =>
      createRevokedStatusWritePlan({
        binding: binding(),
        current: state(),
        privyAuthority: "ACTIVE",
      }),
    ).toThrow(/loss of delegated Privy/);

    const plan = createRevokedStatusWritePlan({
      binding: binding(),
      current: state(),
      privyAuthority: "REVOKED",
    });
    let received: typeof plan | undefined;
    const hashes = await writeRevokedStatus(
      {
        writeRevokedStatus: async (value) => {
          received = value;
          return ["0xrevoked-write"];
        },
      },
      plan,
    );
    expect(hashes).toEqual(["0xrevoked-write"]);
    expect(received?.record).toEqual({
      key: "kanon.status",
      value: "revoked",
    });
  });
});
