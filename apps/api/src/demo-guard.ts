import { timingSafeEqual } from "node:crypto";
import type { ApiErrorCode } from "../../../packages/shared/src/index.js";
import type {
  CompanyAuthorityTermsInput,
  NormalizedPermissionSet,
} from "../../../packages/permissions/src/index.js";

export type ApiRole = "operator" | "demo";

export type ExecutionScenario = "ALLOWED" | "FORBIDDEN";

export class DemoGuardError extends Error {
  public constructor(
    message: string,
    public readonly code: ApiErrorCode,
    public readonly status: number,
    public readonly details?: Readonly<Record<string, string>>,
  ) {
    super(message);
    this.name = "DemoGuardError";
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function tokenMatches(
  provided: unknown,
  expected: string | undefined,
): boolean {
  if (typeof provided !== "string" || !expected) {
    return false;
  }
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");
  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

export function resolveRole(
  headers: Readonly<Record<string, unknown>>,
  tokens: {
    readonly companyToken: string;
    readonly demoToken?: string;
  },
): ApiRole | undefined {
  if (tokenMatches(headers["x-kanon-company-token"], tokens.companyToken)) {
    return "operator";
  }
  if (tokenMatches(headers["x-kanon-demo-token"], tokens.demoToken)) {
    return "demo";
  }
  return undefined;
}

const DEMO_READ_PATHS = [
  /^\/healthz$/,
  /^\/v1\/status$/,
  /^\/v1\/proof\/latest$/,
  /^\/v1\/proof\/runs\/[^/]+$/,
  /^\/v1\/organizations\/[^/]+$/,
  /^\/v1\/organizations\/[^/]+\/wallet$/,
  /^\/v1\/organizations\/[^/]+\/agents\/[^/]+$/,
  /^\/v1\/organizations\/[^/]+\/installations$/,
  /^\/v1\/organizations\/[^/]+\/installations\/[^/]+$/,
  /^\/v1\/organizations\/[^/]+\/installations\/[^/]+\/(?:update-diff|evidence)$/,
];

const DEMO_MUTATION_PATHS = [
  /^\/v1\/organizations\/[^/]+\/agents\/[^/]+\/releases$/,
  /^\/v1\/organizations\/[^/]+\/installations\/[^/]+\/(?:company-terms|approval|executions|revoke|reject-update)$/,
];

export function assertDemoRouteAllowed(method: string, pathname: string): void {
  const normalizedMethod = method.toUpperCase();
  const allowed =
    ((normalizedMethod === "GET" || normalizedMethod === "HEAD") &&
      DEMO_READ_PATHS.some((pattern) => pattern.test(pathname))) ||
    (normalizedMethod === "POST" &&
      DEMO_MUTATION_PATHS.some((pattern) => pattern.test(pathname)));
  if (!allowed) {
    throw new DemoGuardError(
      "the demo role cannot perform this request",
      "FORBIDDEN",
      403,
    );
  }
}

function enforceBounds(field: string, message: string): never {
  throw new DemoGuardError(
    `${field}: ${message}`,
    "DEMO_TERMS_OUT_OF_BOUNDS",
    422,
  );
}

function assertWeiCeiling(value: unknown, field: string): void {
  if (
    (typeof value !== "string" && typeof value !== "bigint") ||
    !/^[0-9]+$/.test(String(value))
  ) {
    enforceBounds(field, "must be an integer wei amount between 1 and 1000");
  }
  const wei = BigInt(String(value));
  if (wei < 1n || wei > 1000n) {
    enforceBounds(
      field,
      "must be between 1 and 1000 wei under the hosted demo ceiling",
    );
  }
}

export function assertDemoTermsWithinEnvelope(
  termsInput: CompanyAuthorityTermsInput,
  options: { readonly controlWallet: string },
): void {
  const terms: Record<string, unknown> = record(termsInput) ? termsInput : {};
  const rules = terms.rules;
  if (!Array.isArray(rules) || rules.length !== 1) {
    enforceBounds(
      "authority.rules",
      "the hosted demo allows exactly one authority rule",
    );
  }
  const rule: unknown = rules[0];
  if (!record(rule)) {
    enforceBounds("authority.rules[0]", "must be an object");
  }
  if (rule.chainId !== 11155111) {
    enforceBounds("authority.rules[0].chainId", "must be 11155111 (Sepolia)");
  }
  if (rule.asset !== "native") {
    enforceBounds("authority.rules[0].asset", "must be 'native'");
  }
  if (
    typeof rule.recipient !== "string" ||
    rule.recipient.toLowerCase() !== options.controlWallet.toLowerCase()
  ) {
    enforceBounds(
      "authority.rules[0].recipient",
      "hosted demo funds can only move to the organization's control wallet",
    );
  }
  assertWeiCeiling(rule.maxValueWei, "authority.rules[0].maxValueWei");
  const rollingSpend = rule.rollingSpend;
  if (!record(rollingSpend)) {
    enforceBounds(
      "authority.rules[0].rollingSpend",
      "a rolling spend limit is required under the hosted demo ceiling",
    );
  }
  assertWeiCeiling(
    rollingSpend.maxValueWei,
    "authority.rules[0].rollingSpend.maxValueWei",
  );
  if (
    typeof rollingSpend.windowSeconds !== "number" ||
    !Number.isInteger(rollingSpend.windowSeconds) ||
    rollingSpend.windowSeconds < 60 ||
    rollingSpend.windowSeconds > 86400
  ) {
    enforceBounds(
      "authority.rules[0].rollingSpend.windowSeconds",
      "must be an integer between 60 and 86400 seconds",
    );
  }
  if (rule.calldata !== undefined) {
    enforceBounds(
      "authority.rules[0].calldata",
      "calldata constraints are not available in the hosted demo",
    );
  }
  if (rule.validityWindow !== undefined) {
    enforceBounds(
      "authority.rules[0].validityWindow",
      "validity windows are not available in the hosted demo",
    );
  }
}

export interface DemoRateLimiter {
  readonly assertMutationAllowed: (clientKey: string) => void;
  readonly assertExecutionAllowed: (installationId: string) => void;
}

export function createDemoRateLimiter(options?: {
  readonly now?: () => number;
  readonly mutationWindowMs?: number;
  readonly mutationPerClient?: number;
  readonly mutationGlobal?: number;
  readonly executionWindowMs?: number;
  readonly executionPerInstallation?: number;
  readonly executionGlobalWindowMs?: number;
  readonly executionGlobal?: number;
}): DemoRateLimiter {
  const now = options?.now ?? (() => Date.now());
  const mutationWindowMs = options?.mutationWindowMs ?? 10 * 60 * 1000;
  const mutationPerClient = options?.mutationPerClient ?? 30;
  const mutationGlobal = options?.mutationGlobal ?? 150;
  const executionWindowMs = options?.executionWindowMs ?? 10 * 60 * 1000;
  const executionPerInstallation = options?.executionPerInstallation ?? 6;
  const executionGlobalWindowMs =
    options?.executionGlobalWindowMs ?? 60 * 60 * 1000;
  const executionGlobal = options?.executionGlobal ?? 40;

  const mutationHits = new Map<string, number[]>();
  const globalMutationHits: number[] = [];
  const executionHits = new Map<string, number[]>();
  const globalExecutionHits: number[] = [];

  const prune = (hits: number[], windowMs: number, at: number): void => {
    while (hits.length > 0 && hits[0] <= at - windowMs) {
      hits.shift();
    }
  };

  const limited = (message: string): DemoGuardError =>
    new DemoGuardError(message, "RATE_LIMITED", 429);

  return {
    assertMutationAllowed(clientKey) {
      const at = now();
      prune(globalMutationHits, mutationWindowMs, at);
      if (globalMutationHits.length >= mutationGlobal) {
        throw limited("the hosted demo is busy; retry shortly");
      }
      const hits = mutationHits.get(clientKey) ?? [];
      prune(hits, mutationWindowMs, at);
      if (hits.length >= mutationPerClient) {
        throw limited(
          "too many demo mutations from this client; retry shortly",
        );
      }
      hits.push(at);
      mutationHits.set(clientKey, hits);
      globalMutationHits.push(at);
    },
    assertExecutionAllowed(installationId) {
      const at = now();
      prune(globalExecutionHits, executionGlobalWindowMs, at);
      if (globalExecutionHits.length >= executionGlobal) {
        throw limited(
          "the hosted demo reached its hourly execution limit; retry later",
        );
      }
      const hits = executionHits.get(installationId) ?? [];
      prune(hits, executionWindowMs, at);
      if (hits.length >= executionPerInstallation) {
        throw limited("this demo session reached its execution limit");
      }
      hits.push(at);
      executionHits.set(installationId, hits);
      globalExecutionHits.push(at);
    },
  };
}

export function executionRequestForScenario(
  permissionSet: NormalizedPermissionSet,
  scenario: ExecutionScenario,
  forbiddenRecipient: string,
): { readonly to: string; readonly valueWei: string } {
  const rule = permissionSet.companyTerms.authority.rules[0];
  if (scenario === "ALLOWED") {
    if (!rule) {
      throw new DemoGuardError(
        "the approved authority has no execution rule",
        "CONFLICT",
        409,
      );
    }
    return { to: rule.recipient, valueWei: "1" };
  }
  if (
    rule &&
    rule.recipient.toLowerCase() === forbiddenRecipient.toLowerCase()
  ) {
    throw new DemoGuardError(
      "the forbidden probe target overlaps the approved recipient",
      "INTERNAL_ERROR",
      500,
    );
  }
  return { to: forbiddenRecipient, valueWei: "1" };
}
