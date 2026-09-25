import { describe, expect, it } from "vitest";
import { leaseDecision } from "../apps/api/src/demo-lease.js";
import type { Installation } from "../packages/shared/src/index.js";

const TTL_MS = 20 * 60 * 1000;
const NOW = 1_800_000_000_000;

function liveEntry(
  id: string,
  ageMs: number,
  status = "ACTIVE",
): {
  readonly installation: Installation;
  readonly updatedAt: Date;
} {
  return {
    installation: {
      id,
      status,
    } as unknown as Installation,
    updatedAt: new Date(NOW - ageMs),
  };
}

describe("leaseDecision", () => {
  it("proceeds when no session exists", () => {
    const decision = leaseDecision({
      requestingInstallationId: "installation-new",
      live: [],
      now: NOW,
      ttlMs: TTL_MS,
      inFlightIds: new Set(),
    });
    expect(decision).toEqual({ kind: "proceed" });
  });

  it("returns busy with a retry hint when a fresh session exists", () => {
    const decision = leaseDecision({
      requestingInstallationId: "installation-new",
      live: [liveEntry("installation-live", 5 * 60 * 1000)],
      now: NOW,
      ttlMs: TTL_MS,
      inFlightIds: new Set(),
    });
    expect(decision.kind).toBe("busy");
    if (decision.kind !== "busy") return;
    expect(decision.installationId).toBe("installation-live");
    expect(decision.retryAfterSeconds).toBe(15 * 60);
  });

  it("reports the longest remaining time when several sessions are fresh", () => {
    const decision = leaseDecision({
      requestingInstallationId: "installation-new",
      live: [
        liveEntry("installation-older", 5 * 60 * 1000),
        liveEntry("installation-newer", 60 * 1000),
      ],
      now: NOW,
      ttlMs: TTL_MS,
      inFlightIds: new Set(),
    });
    expect(decision.kind).toBe("busy");
    if (decision.kind !== "busy") return;
    expect(decision.retryAfterSeconds).toBe(19 * 60);
    expect(decision.installationId).toBe("installation-newer");
  });

  it("expires a stale session", () => {
    const stale = liveEntry("installation-stale", TTL_MS + 60_000);
    const decision = leaseDecision({
      requestingInstallationId: "installation-new",
      live: [stale],
      now: NOW,
      ttlMs: TTL_MS,
      inFlightIds: new Set(),
    });
    expect(decision.kind).toBe("expire");
    if (decision.kind !== "expire") return;
    expect(decision.installations.map((entry) => entry.id)).toEqual([
      "installation-stale",
    ]);
  });

  it("counts an in-flight session as fresh regardless of age", () => {
    const decision = leaseDecision({
      requestingInstallationId: "installation-new",
      live: [
        liveEntry(
          "installation-configuring",
          TTL_MS + 60_000,
          "CONFIGURING_AUTHORITY",
        ),
      ],
      now: NOW,
      ttlMs: TTL_MS,
      inFlightIds: new Set(["installation-configuring"]),
    });
    expect(decision.kind).toBe("busy");
    if (decision.kind !== "busy") return;
    expect(decision.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("excludes the requester from its own busy check", () => {
    const decision = leaseDecision({
      requestingInstallationId: "installation-live",
      live: [liveEntry("installation-live", 60_000)],
      now: NOW,
      ttlMs: TTL_MS,
      inFlightIds: new Set(),
    });
    expect(decision).toEqual({ kind: "proceed" });
  });
});
