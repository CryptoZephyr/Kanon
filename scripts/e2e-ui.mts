/**
 * Real-browser E2E for the hosted demo, driven through the actual UI.
 *
 *   pnpm e2e:ui
 *
 * Target via KANON_E2E_BASE_URL (default https://kanon-agents.vercel.app).
 * Uses the locally installed Chrome via playwright-core (no bundled
 * browsers). Records per-step durations and the wall-clock timing of the
 * approval POST, activation polling GETs, revoke POST and executions so the
 * 20s-timeout hypothesis can be confirmed or refuted. Writes a non-secret
 * JSON report to evidence/3rd-web-hack/ui-e2e-latest.json and screenshots
 * under %TEMP%\kanon-shots\ux-*.png.
 */
import { chromium, type Page, type Request } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = (
  process.env.KANON_E2E_BASE_URL ?? "https://kanon-agents.vercel.app"
).replace(/\/$/, "");
const SHOTS = process.env.KANON_E2E_SHOTS ?? join(tmpdir(), "kanon-shots");
const EVIDENCE = join(
  process.cwd(),
  "evidence",
  "3rd-web-hack",
  "ui-e2e-latest.json",
);
const GENEROUS = 300_000;

interface TimedRequest {
  kind: string;
  method: string;
  path: string;
  status?: number;
  durationMs?: number;
  failed?: string;
}

const requests = new Map<Request, number>();
const statuses = new Map<Request, number>();
const timings: TimedRequest[] = [];

function classify(request: Request): string | undefined {
  const url = new URL(request.url());
  const path = url.pathname;
  if (!path.startsWith("/api/")) return undefined;
  if (request.method() === "POST" && path.endsWith("/approval"))
    return "approval-post";
  if (request.method() === "POST" && path.endsWith("/revoke"))
    return "revoke-post";
  if (request.method() === "POST" && path.endsWith("/executions"))
    return "execution-post";
  if (request.method() === "POST" && path.endsWith("/company-terms"))
    return "terms-post";
  if (request.method() === "POST" && path.endsWith("/releases"))
    return "release-post";
  if (request.method() === "POST" && path.endsWith("/reject-update"))
    return "reject-update-post";
  if (request.method() === "GET" && /installations\/[^/]+$/.test(path))
    return "installation-get";
  if (request.method() === "GET" && path.endsWith("/v1/status"))
    return "status-get";
  return undefined;
}

function instrument(page: Page) {
  page.on("request", (request) => {
    if (classify(request)) requests.set(request, Date.now());
  });
  page.on("response", (response) => {
    if (requests.has(response.request())) {
      statuses.set(response.request(), response.status());
    }
  });
  const finish = (request: Request, failed?: string) => {
    const started = requests.get(request);
    if (started === undefined) return;
    requests.delete(request);
    timings.push({
      kind: classify(request)!,
      method: request.method(),
      path: new URL(request.url()).pathname,
      status: statuses.get(request),
      durationMs: Date.now() - started,
      failed,
    });
  };
  page.on("requestfinished", (request) => finish(request));
  page.on("requestfailed", (request) =>
    finish(request, request.failure()?.errorText ?? "failed"),
  );
}

const consoleErrors: string[] = [];
const pageErrors: string[] = [];

function watchErrors(page: Page) {
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(String(error)));
}

interface StepResult {
  step: string;
  ok: boolean;
  durationMs: number;
  detail?: string;
}

const results: StepResult[] = [];
let shotIndex = 0;

async function shot(page: Page, name: string) {
  shotIndex += 1;
  const file = join(
    SHOTS,
    `ux-${String(shotIndex).padStart(2, "0")}-${name}.png`,
  );
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function step(name: string, run: () => Promise<string | void>) {
  const started = Date.now();
  try {
    const detail = await run();
    const durationMs = Date.now() - started;
    results.push({ step: name, ok: true, durationMs, detail });
    console.log(
      `ok   ${name} (${(durationMs / 1000).toFixed(1)}s)${detail ? ` — ${detail}` : ""}`,
    );
  } catch (error) {
    const durationMs = Date.now() - started;
    const detail = error instanceof Error ? error.message : String(error);
    results.push({ step: name, ok: false, durationMs, detail });
    console.log(
      `FAIL ${name} (${(durationMs / 1000).toFixed(1)}s) — ${detail}`,
    );
    throw error;
  }
}

async function clickButton(page: Page, name: RegExp | string) {
  const button = page.getByRole("button", { name }).first();
  await button.waitFor({ state: "visible", timeout: GENEROUS });
  await button.click();
}

async function waitForText(page: Page, text: RegExp | string) {
  await page
    .getByText(text)
    .first()
    .waitFor({ state: "visible", timeout: GENEROUS });
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });

  // ---- context 1: the operator's browser ----
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  instrument(page);
  watchErrors(page);

  await step("landing loads, CTA names the outcome", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page
      .getByRole("button", { name: "Start a live authority run" })
      .first()
      .waitFor({ state: "visible", timeout: GENEROUS });
    await shot(page, "landing");
    await clickButton(page, "Start a live authority run");
  });

  await step("workspace connects (cold start tolerated)", async () => {
    await page
      .getByText("API connected")
      .waitFor({ state: "visible", timeout: GENEROUS });
    await shot(page, "agents");
    return "API connected";
  });

  await step("register a release", async () => {
    await clickButton(page, /Start a run|Start a live authority run/);
    await page
      .getByRole("button", { name: "Continue to authority" })
      .first()
      .waitFor({ state: "visible", timeout: GENEROUS });
    await shot(page, "add-release");
    await clickButton(page, "Continue to authority");
  });

  await step("define company authority terms", async () => {
    await page
      .getByRole("button", { name: "Review authority" })
      .first()
      .waitFor({ state: "visible", timeout: GENEROUS });
    await shot(page, "authority-terms");
    await clickButton(page, "Review authority");
  });

  await step("approve exact authority and wait for ACTIVE", async () => {
    await page
      .getByRole("button", { name: "Approve exact authority" })
      .first()
      .waitFor({ state: "visible", timeout: GENEROUS });
    await shot(page, "review-approve");
    await clickButton(page, "Approve exact authority");
    // Activation: Privy policy + signer, then ENS — usually 30–60 s.
    await page
      .getByRole("button", { name: "Run allowed action" })
      .first()
      .waitFor({ state: "visible", timeout: GENEROUS });
    await shot(page, "active-detail");
    return "status ACTIVE";
  });

  await step("run the allowed action", async () => {
    await clickButton(page, "Run allowed action");
    await page
      .getByRole("link", { name: /0x[0-9a-f]{4}/ })
      .first()
      .first()
      .waitFor({ state: "visible", timeout: GENEROUS });
    await shot(page, "allowed-executed");
    return "transaction link visible";
  });

  await step("try the forbidden action", async () => {
    await clickButton(page, "Try forbidden action");
    await waitForText(page, /PRIVY_POLICY_REJECTED|Rejected action/);
    await shot(page, "forbidden-rejected");
    return "policy rejection recorded";
  });

  await step("request a broader release and see EXPANDED", async () => {
    await clickButton(page, "Request a broader release");
    await clickButton(page, "Prepare reauthorization");
    await waitForText(page, "EXPANDED");
    await shot(page, "expanded-diff");
    await clickButton(page, "Continue to reauthorization");
  });

  await step("reauthorize and reach generation 1", async () => {
    await page
      .getByRole("button", { name: "Approve new authority" })
      .first()
      .waitFor({ state: "visible", timeout: GENEROUS });
    await shot(page, "reauthorize-review");
    await clickButton(page, "Approve new authority");
    await page
      .getByRole("button", { name: "Revoke authority" })
      .first()
      .waitFor({ state: "visible", timeout: GENEROUS });
    await shot(page, "reauthorized");
    return "ACTIVE generation 1";
  });

  await step("revoke with explicit confirmation", async () => {
    await clickButton(page, "Revoke authority");
    await waitForText(page, /Revoke is irreversible/);
    await shot(page, "revoke-confirm");
    await clickButton(page, "Yes, revoke authority");
    await page
      .getByRole("button", { name: "Attempt allowed action after revoke" })
      .first()
      .waitFor({ state: "visible", timeout: GENEROUS });
    await shot(page, "revoked");
    return "status REVOKED";
  });

  await step("post-revoke attempt is refused", async () => {
    await clickButton(page, "Attempt allowed action after revoke");
    await waitForText(page, /RUNNER_REFUSED_STALE_OR_REVOKED/);
    return "runner refusal recorded";
  });

  await step("run-complete proof summary", async () => {
    await waitForText(page, /Run complete — the proof/);
    await shot(page, "run-complete");
    return "proof summary visible";
  });

  await step("reload keeps the same run (session persistence)", async () => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForText(page, "YOUR RUN — SAVED IN THIS BROWSER");
    await shot(page, "reloaded-session");
    return "session label restored";
  });

  const context1Storage = await context.storageState();
  await context.close();

  // ---- context 2: a second visitor observes read-only ----
  const context2 = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page2 = await context2.newPage();
  instrument(page2);
  watchErrors(page2);

  await step("second context observes latest run read-only", async () => {
    await page2.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page2
      .getByRole("button", { name: "Start a live authority run" })
      .first()
      .waitFor({ state: "visible", timeout: GENEROUS });
    await clickButton(page2, "Start a live authority run");
    await page2
      .getByText("API connected")
      .waitFor({ state: "visible", timeout: GENEROUS });
    await waitForText(page2, /LATEST RUN — SOMEONE ELSE'S \(READ ONLY\)/);
    await clickButton(page2, /Live authority/);
    await waitForText(page2, /Read-only view/);
    const actions = await page2
      .getByRole("button", { name: /Run allowed action|Revoke authority/ })
      .count();
    if (actions > 0) throw new Error("read-only view exposes action buttons");
    await shot(page2, "observe-readonly");
    return "no action buttons in observe mode";
  });
  await context2.close();

  // ---- docs site ----
  const context3 = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page3 = await context3.newPage();
  watchErrors(page3);

  const docsChecks: [string, RegExp][] = [
    ["/docs", /Kanon documentation/],
    ["/docs/start/how-it-works", /How it works/],
    ["/docs/security/trust-model", /Trust model/],
    ["/docs/help/troubleshooting", /Troubleshooting/],
    ["/docs/proof/complete-run-example", /Complete run example/],
    ["/docs/reference/installation-states", /Installation states/],
  ];
  for (const [route, expected] of docsChecks) {
    await step(`docs deep link ${route}`, async () => {
      await page3.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
      await waitForText(page3, expected);
      return "loads directly";
    });
  }
  await shot(page3, "docs-page");

  const context4 = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page4 = await context4.newPage();
  watchErrors(page4);
  await step("docs mobile nav at 390px", async () => {
    await page4.goto(`${BASE}/docs/start/introduction`, {
      waitUntil: "domcontentloaded",
    });
    await clickButton(page4, "Docs menu");
    await waitForText(page4, "Using Kanon");
    await shot(page4, "docs-mobile");
    return "mobile nav opens";
  });
  await step("app mobile at 390px", async () => {
    await page4.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page4
      .getByRole("button", { name: "Start a live authority run" })
      .first()
      .waitFor({ state: "visible", timeout: GENEROUS });
    await shot(page4, "landing-mobile");
    return "landing stacks at 390px";
  });
  await context4.close();
  await context3.close();
  await browser.close();

  const report = {
    schema: "kanon.ui-e2e",
    version: 1,
    baseUrl: BASE,
    startedAt: new Date().toISOString(),
    status: results.every((r) => r.ok) ? "passed" : "failed",
    steps: results,
    timings,
    sessionStorageKeys: Object.keys(context1Storage),
    consoleErrors,
    pageErrors,
  };
  writeFileSync(EVIDENCE, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nwrote ${EVIDENCE}`);
  console.log(
    `console errors: ${consoleErrors.length}, page errors: ${pageErrors.length}`,
  );
  if (consoleErrors.length || pageErrors.length) {
    console.log(consoleErrors.slice(0, 10));
    console.log(pageErrors.slice(0, 10));
    process.exitCode = 1;
  }
  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

main().catch((error) => {
  console.error("E2E aborted:", error);
  process.exitCode = 1;
});
