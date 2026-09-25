import { describe, expect, it } from "vitest";
import {
  buildUpstreamHeaders,
  isAllowedProxyRequest,
} from "../api/kanon-proxy.js";

describe("isAllowedProxyRequest", () => {
  it("allows public demo reads", () => {
    for (const path of [
      "/healthz",
      "/v1/status",
      "/v1/proof/latest",
      "/v1/proof/runs/run-1",
      "/v1/organizations/organization-kanon",
      "/v1/organizations/organization-kanon/wallet",
      "/v1/organizations/organization-kanon/agents/com.example.treasury",
      "/v1/organizations/organization-kanon/installations",
      "/v1/organizations/organization-kanon/installations/installation-1",
      "/v1/organizations/organization-kanon/installations/installation-1/update-diff",
      "/v1/organizations/organization-kanon/installations/installation-1/evidence",
    ]) {
      expect(isAllowedProxyRequest("GET", path)).toBe(true);
      expect(isAllowedProxyRequest("HEAD", path)).toBe(true);
    }
  });

  it("allows only the demo mutation routes", () => {
    for (const path of [
      "/v1/organizations/organization-kanon/agents/com.example.treasury/releases",
      "/v1/organizations/organization-kanon/installations/installation-1/company-terms",
      "/v1/organizations/organization-kanon/installations/installation-1/approval",
      "/v1/organizations/organization-kanon/installations/installation-1/executions",
      "/v1/organizations/organization-kanon/installations/installation-1/revoke",
      "/v1/organizations/organization-kanon/installations/installation-1/reject-update",
    ]) {
      expect(isAllowedProxyRequest("POST", path)).toBe(true);
    }
  });

  it("denies proof runs, unknown mutations, and non-read methods", () => {
    expect(isAllowedProxyRequest("POST", "/v1/proof/run")).toBe(false);
    expect(
      isAllowedProxyRequest(
        "POST",
        "/v1/organizations/organization-kanon/installations/installation-1/admin",
      ),
    ).toBe(false);
    expect(isAllowedProxyRequest("DELETE", "/v1/status")).toBe(false);
    expect(
      isAllowedProxyRequest("PUT", "/v1/organizations/organization-kanon"),
    ).toBe(false);
    expect(isAllowedProxyRequest("POST", "/internal/execute")).toBe(false);
    expect(isAllowedProxyRequest("GET", "/internal/execute")).toBe(false);
    expect(isAllowedProxyRequest("POST", "/v1/organizations")).toBe(false);
  });
});

describe("buildUpstreamHeaders", () => {
  it("never forwards the company token and strips visitor credentials", () => {
    const incoming = new Headers({
      "content-type": "application/json",
      "x-kanon-company-token": "visitor-supplied-company-token",
      "x-kanon-demo-token": "visitor-supplied-demo-token",
      "x-kanon-client-ip": "203.0.113.10",
      "x-runner-shared-secret": "visitor-supplied-runner-secret",
      "x-request-id": "request-1",
    });
    const upstream = buildUpstreamHeaders(incoming, {
      demoToken: "server-demo-token",
      clientIp: "198.51.100.7",
    });
    expect(upstream.get("x-kanon-company-token")).toBeNull();
    expect(upstream.get("x-runner-shared-secret")).toBeNull();
    expect(upstream.get("x-kanon-demo-token")).toBe("server-demo-token");
    expect(upstream.get("x-kanon-client-ip")).toBe("198.51.100.7");
    expect(upstream.get("x-request-id")).toBe("request-1");
    expect(upstream.get("content-type")).toBe("application/json");
  });

  it("does not leak the demo token value of the visitor", () => {
    const incoming = new Headers({
      "x-kanon-demo-token": "attacker-token",
    });
    const upstream = buildUpstreamHeaders(incoming, {
      demoToken: "server-demo-token",
      clientIp: "unknown",
    });
    expect(upstream.get("x-kanon-demo-token")).toBe("server-demo-token");
  });
});
