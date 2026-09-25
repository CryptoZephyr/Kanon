import type { Installation } from "../../../packages/shared/src/index.js";

export interface LiveInstallationEntry {
  readonly installation: Installation;
  readonly updatedAt: Date | string | number;
}

export type LeaseDecision =
  | { readonly kind: "proceed" }
  | {
      readonly kind: "busy";
      readonly retryAfterSeconds: number;
      readonly installationId: string;
    }
  | {
      readonly kind: "expire";
      readonly installations: readonly Installation[];
    };

export const DEFAULT_LEASE_TTL_MS = 20 * 60 * 1000;

const IN_FLIGHT_RETRY_HINT_MS = 60 * 1000;

export function leaseTtlMs(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const raw = environment.KANON_DEMO_LEASE_TTL_SECONDS;
  if (!raw) {
    return DEFAULT_LEASE_TTL_MS;
  }
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return DEFAULT_LEASE_TTL_MS;
  }
  return seconds * 1000;
}

function updatedAtMs(entry: LiveInstallationEntry): number {
  return entry.updatedAt instanceof Date
    ? entry.updatedAt.getTime()
    : new Date(entry.updatedAt).getTime();
}

export function leaseDecision(input: {
  readonly requestingInstallationId: string;
  readonly live: readonly LiveInstallationEntry[];
  readonly now: number;
  readonly ttlMs: number;
  readonly inFlightIds: ReadonlySet<string>;
}): LeaseDecision {
  const others = input.live.filter(
    (entry) => entry.installation.id !== input.requestingInstallationId,
  );
  if (others.length === 0) {
    return { kind: "proceed" };
  }

  const fresh: Array<{ entry: LiveInstallationEntry; remainingMs: number }> =
    [];
  const stale: LiveInstallationEntry[] = [];
  for (const entry of others) {
    const ageMs = input.now - updatedAtMs(entry);
    const inFlight = input.inFlightIds.has(entry.installation.id);
    if (!inFlight && ageMs >= input.ttlMs) {
      stale.push(entry);
      continue;
    }
    fresh.push({
      entry,
      remainingMs: inFlight
        ? Math.min(Math.max(input.ttlMs - ageMs, 0), IN_FLIGHT_RETRY_HINT_MS)
        : Math.max(input.ttlMs - ageMs, 0),
    });
  }

  if (fresh.length > 0) {
    const longest = fresh.reduce((a, b) =>
      a.remainingMs >= b.remainingMs ? a : b,
    );
    const freshest = fresh.reduce((a, b) =>
      updatedAtMs(a.entry) >= updatedAtMs(b.entry) ? a : b,
    );
    return {
      kind: "busy",
      retryAfterSeconds: Math.max(1, Math.ceil(longest.remainingMs / 1000)),
      installationId: freshest.entry.installation.id,
    };
  }

  if (stale.length > 0) {
    return {
      kind: "expire",
      installations: stale.map((entry) => entry.installation),
    };
  }

  return { kind: "proceed" };
}
