import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KanonApi,
  type AgentResource,
  type CompanyRule,
  type InstallationResource,
  type OrganizationResource,
  type ProofResponse,
  type StatusResource,
  type WalletResource,
} from "./api.js";
import {
  activationSubsteps,
  describeApiError,
  isTransientError,
  nextStepFor,
  postRevokeAttempted,
  seededDraftTerms,
  type DescribedError,
  type NextStep,
} from "./logic.js";

type Screen =
  | "landing"
  | "agents"
  | "add"
  | "authority"
  | "review"
  | "detail"
  | "update";

const ORGANIZATION_ID = "organization-kanon";
const REPRESENTATIVE_AGENT_ID = "com.example.treasury";
const INSTALLATION_ID = "installation-t11-live";
const SESSION_STORAGE_KEY = "kanon.session.installationId";
const DEFAULT_RECIPIENT = "0x8b88e1e1174edc65b08de75a5439f130da8a3dfd";
const DEFAULT_TERMS: CompanyRule[] = [
  {
    chainId: 11155111,
    asset: "native",
    recipient: DEFAULT_RECIPIENT,
    maxValueWei: "1",
    rollingSpend: { maxValueWei: "1", windowSeconds: 3600 },
  },
];

const FALLBACK_AGENT: AgentResource = {
  schema: "kanon.api.agent-capability",
  version: 1,
  agentId: REPRESENTATIVE_AGENT_ID,
  releaseId: "release-b-3rd-web-hack-2026",
  releaseVersion: "2.0.0",
  packageHash:
    "sha256:8c434023dbc035910b8d3a052b558eb4bc347dbead8087072c54227ee4bba34d",
  manifestHash:
    "sha256:c0abd1fd16081cb090dce81b095c44b900b7bbb3f30e75420af199ad5ec93016",
  manifest: {
    schema: "kanon.agent",
    agent: {
      id: REPRESENTATIVE_AGENT_ID,
      releaseId: "release-b-3rd-web-hack-2026",
      version: "2.0.0",
    },
    runtime: { entry: "worker" },
    capabilities: { chains: [11155111], assets: ["native"] },
    packageHash:
      "sha256:8c434023dbc035910b8d3a052b558eb4bc347dbead8087072c54227ee4bba34d",
    manifestHash:
      "sha256:c0abd1fd16081cb090dce81b095c44b900b7bbb3f30e75420af199ad5ec93016",
  },
};

const FALLBACK_ORGANIZATION: OrganizationResource = {
  schema: "kanon.api.organization",
  version: 1,
  id: ORGANIZATION_ID,
  name: "Kanon",
  controlWallet: DEFAULT_RECIPIENT,
  ensNamespace: "agents.kanon-ethonline-2026.eth",
};

const FALLBACK_WALLET: WalletResource = {
  schema: "kanon.api.wallet",
  version: 1,
  walletId: "kanon-t3-sepolia",
  address: DEFAULT_RECIPIENT,
  chainId: 11155111,
  asset: "native",
  status: "CONFIGURED",
};

interface Workspace {
  readonly organization: OrganizationResource;
  readonly wallet: WalletResource;
  readonly agent: AgentResource;
  readonly installation?: InstallationResource;
  readonly proof?: ProofResponse;
  readonly connected: boolean;
  readonly source: "api" | "proof" | "fixture";
  readonly installationSource: "session" | "observe" | "none";
}

type ConnectionState = {
  readonly state: "connecting" | "connected" | "unavailable";
  readonly attempts: number;
};

interface DraftRelease {
  readonly agentId: string;
  readonly releaseId: string;
  readonly version: string;
  readonly packageContent: string;
  readonly capabilities: Record<string, unknown>;
  readonly runtime: { readonly entry: string };
}

function displayAddress(address: string): string {
  return address.length > 14
    ? `${address.slice(0, 7)}...${address.slice(-5)}`
    : address;
}

function displayHash(value: string | undefined): string {
  return value ? `${value.slice(0, 16)}...${value.slice(-8)}` : "Not available";
}

function decisionId(prefix: string): string {
  const suffix =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Date.now().toString(36);
  return `${prefix}-${suffix}`;
}

function generateReleaseId(): string {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const random = Math.random().toString(36).slice(2, 8);
  return `release-3wh-${day}-${random}`;
}

function nextReleaseId(releaseId: string): string {
  const match = releaseId.match(/-v(\d+)$/);
  if (match) {
    return `${releaseId.slice(0, -match[0].length)}-v${Number(match[1]) + 1}`;
  }
  return `${releaseId}-v2`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatStatus(status: string | undefined): string {
  return status ? status.toLowerCase().replaceAll("_", " ") : "not connected";
}

function getErrorMessage(error: unknown): DescribedError {
  return describeApiError(error);
}

function Logo({ compact = false }: { readonly compact?: boolean }) {
  return (
    <span className={compact ? "brand brand-compact" : "brand"}>
      <img src="/kanon-approved-logo.svg" alt="Kanon" />
      {!compact && <span className="brand-name">Kanon</span>}
    </span>
  );
}

function Button({
  children,
  kind = "primary",
  type = "button",
  disabled = false,
  onClick,
}: {
  readonly children: React.ReactNode;
  readonly kind?: "primary" | "secondary" | "ghost" | "danger";
  readonly type?: "button" | "submit";
  readonly disabled?: boolean;
  readonly onClick?: () => void;
}) {
  return (
    <button
      className={`button button-${kind}`}
      type={type}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function MetaLabel({ children }: { readonly children: React.ReactNode }) {
  return <span className="meta-label">{children}</span>;
}

function judgeSteps(installation?: InstallationResource): {
  readonly label: string;
  readonly done: boolean;
  readonly screen?: Screen;
}[] {
  const evidence = installation?.evidence ?? [];
  const revocationIndex = evidence.findIndex(
    (entry) => entry.schema === "kanon.api.revocation-evidence",
  );
  const executions = evidence
    .filter((entry) => entry.schema === "kanon.api.execution-evidence")
    .map((entry) => entry.evidence);
  const executionsBeforeRevoke =
    revocationIndex < 0
      ? executions
      : evidence
          .slice(0, revocationIndex)
          .filter((entry) => entry.schema === "kanon.api.execution-evidence")
          .map((entry) => entry.evidence);
  const executionsAfterRevoke =
    revocationIndex < 0
      ? []
      : evidence
          .slice(revocationIndex + 1)
          .filter((entry) => entry.schema === "kanon.api.execution-evidence")
          .map((entry) => entry.evidence);
  const status = installation?.status;
  const generation = installation?.generation ?? 0;
  const expandedDetected =
    installation?.updateDiff?.proposal.classification === "EXPANDED" ||
    (status === "ACTIVE" && generation >= 1) ||
    (status === "REVOKED" && generation >= 2);
  const reauthorized =
    (status === "ACTIVE" && generation >= 1) ||
    (status === "REVOKED" && generation >= 2);
  const reachedRevocation = status === "REVOKED" || status === "REVOKING";
  return [
    { label: "Register release", done: installation !== undefined },
    {
      label: "Review requested capabilities",
      done: installation !== undefined,
    },
    { label: "Define company authority", done: installation !== undefined },
    {
      label: "Approve exact boundary",
      done: installation?.approval !== undefined,
      screen: "review",
    },
    {
      label: "Privy authority active",
      done: installation?.activeAuthority !== undefined || reachedRevocation,
      screen: "detail",
    },
    {
      label: "Inspect ENS identity + permissionHash",
      done:
        installation?.activeAuthority?.ens.verified === true ||
        reachedRevocation,
      screen: "detail",
    },
    {
      label: "Allowed action succeeded",
      done: executions.some((entry) => entry.outcome === "SUCCEEDED"),
      screen: "detail",
    },
    {
      label: "Forbidden action rejected",
      done: executionsBeforeRevoke.some(
        (entry) => entry.outcome === "REJECTED",
      ),
      screen: "detail",
    },
    {
      label: "Broader release detected (EXPANDED)",
      done: expandedDetected,
      screen: "update",
    },
    {
      label: "Fresh human reauthorization (generation +1)",
      done: reauthorized,
      screen: "review",
    },
    {
      label: "Authority revoked",
      done: status === "REVOKED",
      screen: "detail",
    },
    {
      label: "Post-revoke execution failed",
      done:
        installation?.revoke?.postRevokeExecutionFailed === true ||
        executionsAfterRevoke.some((entry) => entry.outcome === "REJECTED"),
      screen: "detail",
    },
  ];
}

function JudgeRail({
  installation,
  onNavigate,
}: {
  readonly installation?: InstallationResource;
  readonly onNavigate?: (screen: Screen) => void;
}) {
  const steps = judgeSteps(installation);
  const nextIndex = steps.findIndex((step) => !step.done);
  return (
    <div className="judge-rail">
      <MetaLabel>Judge path</MetaLabel>
      <ol className="judge-steps">
        {steps.map((step, index) => {
          const isNext = index === nextIndex;
          const className = step.done
            ? "judge-step is-done"
            : isNext
              ? "judge-step is-next"
              : "judge-step";
          const inner = (
            <>
              <span className="judge-step-index">
                {step.done ? "✓" : String(index + 1).padStart(2, "0")}
              </span>
              <span>{step.label}</span>
            </>
          );
          return (
            <li key={step.label} className={className}>
              {step.screen && onNavigate ? (
                <button
                  type="button"
                  className="judge-step-link"
                  onClick={() => onNavigate(step.screen!)}
                >
                  {inner}
                </button>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

type NextStepCommand = NonNullable<NonNullable<NextStep["action"]>["command"]>;

function NextStepPanel({
  step,
  readOnly,
  onNavigate,
  onCommand,
  busy = false,
}: {
  readonly step: NextStep;
  readonly readOnly: boolean;
  readonly onNavigate: (screen: Screen) => void;
  readonly onCommand?: (command: NextStepCommand) => boolean;
  readonly busy?: boolean;
}) {
  const act = () => {
    const action = step.action!;
    if (action.command && onCommand?.(action.command)) return;
    onNavigate(action.screen);
  };
  return (
    <section className="next-step" aria-live="polite">
      <div className="next-step-body">
        <MetaLabel>Next step</MetaLabel>
        <strong>{step.title}</strong>
        <p>{step.detail}</p>
      </div>
      {step.action && !readOnly && (
        <Button onClick={act} disabled={busy}>
          {step.action.label}
        </Button>
      )}
      {step.action && readOnly && (
        <Button
          kind="secondary"
          onClick={() => onNavigate(step.action!.screen)}
        >
          {step.action.label}
        </Button>
      )}
      {step.inProgress && <span className="status-mark is-live" />}
    </section>
  );
}

export interface PendingWatch {
  readonly kind: "activation" | "reauthorization" | "revocation" | "execution";
  readonly installationId: string;
  readonly attempt: number;
  readonly elapsedSeconds: number;
}

function watchKindLabel(kind: PendingWatch["kind"]): string {
  switch (kind) {
    case "activation":
      return "activation";
    case "reauthorization":
      return "reauthorization";
    case "revocation":
      return "revocation";
    case "execution":
      return "execution";
  }
}

function WatchPanel({ pending }: { readonly pending: PendingWatch }) {
  return (
    <div className="watch-panel" role="status" aria-live="polite">
      <span className="status-mark is-live" />
      <div>
        <strong>Checking the {watchKindLabel(pending.kind)} result…</strong>
        <span>
          The browser request ended, but the server keeps working. Poll{" "}
          {pending.attempt} · {pending.elapsedSeconds}s elapsed.
        </span>
      </div>
    </div>
  );
}

function CopyButton({ value }: { readonly value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="text-link"
      type="button"
      onClick={() => {
        void navigator.clipboard
          ?.writeText(value)
          .then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1_500);
          })
          .catch(() => undefined);
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Rule({ children }: { readonly children?: React.ReactNode }) {
  return <div className="rule-row">{children}</div>;
}

function LandingPage({ onEnter }: { readonly onEnter: () => void }) {
  return (
    <main className="landing-page">
      <header className="landing-header page-grid">
        <Logo />
        <nav className="landing-nav" aria-label="Primary">
          <a href="#thesis">Why Kanon</a>
          <a href="#control">Control surface</a>
          <a href="/docs">Docs</a>
          <button className="text-link" onClick={onEnter}>
            Open workspace
          </button>
        </nav>
      </header>

      <section
        className="landing-hero page-grid"
        aria-labelledby="landing-title"
      >
        <div className="hero-edge hero-edge-top">
          3RD-WEB-HACK RELEASE / SEPOLIA TESTNET
        </div>
        <div className="hero-copy">
          <MetaLabel>Financial control for deployed agents</MetaLabel>
          <h1 id="landing-title">The company decides. The agent operates.</h1>
          <p className="hero-lede">
            Kanon binds a human-approved authority to an agent release, a Privy
            policy, and a company-controlled ENS identity.
          </p>
          <div className="hero-actions">
            <Button onClick={onEnter}>Start a live authority run</Button>
            <a className="text-link text-link-large" href="#control">
              See the control surface <span aria-hidden="true">↘</span>
            </a>
          </div>
          <div className="hero-next">
            <MetaLabel>What happens next</MetaLabel>
            <ol className="hero-next-steps">
              <li>Register a release</li>
              <li>Approve exact authority</li>
              <li>Run allowed and forbidden actions</li>
              <li>Update, reauthorize, revoke</li>
            </ol>
            <p className="hero-facts">
              Sepolia testnet · no wallet or sign-up needed · about 5 minutes ·
              one run at a time
            </p>
          </div>
        </div>
        <div
          className="hero-art"
          aria-label="A structured diagram showing a company authority flowing to an agent release"
        >
          <div className="hero-art-index">K / 01</div>
          <div className="authority-diagram">
            <div className="diagram-node diagram-company">
              <span>Company</span>
              <strong>defines terms</strong>
            </div>
            <div className="diagram-line" />
            <div className="diagram-node diagram-agent">
              <span>Agent release</span>
              <strong>requests capability</strong>
            </div>
            <div className="diagram-line diagram-line-short" />
            <div className="diagram-node diagram-identity">
              <span>ENS identity</span>
              <strong>records approved state</strong>
            </div>
          </div>
          <div className="hero-art-note">
            authority remains visible at every handoff
          </div>
        </div>
        <div className="hero-edge hero-edge-bottom">
          PRIVY / ENSV2 / HUMAN APPROVAL
        </div>
      </section>

      <section className="landing-section page-grid" id="thesis">
        <div className="section-title-block">
          <MetaLabel>Why Kanon</MetaLabel>
          <h2>Software changes. Authority should not change by accident.</h2>
        </div>
        <div className="section-body">
          <p>
            Kanon keeps requested capability, company authority, and active
            control as separate records. A wider release stops at a human
            decision instead of inheriting the old wallet policy silently.
          </p>
          <div className="thesis-rows">
            <Rule>
              <span>01</span>
              <strong>Declared</strong>
              <span>An agent describes what it needs.</span>
            </Rule>
            <Rule>
              <span>02</span>
              <strong>Granted</strong>
              <span>The company defines the exact boundary.</span>
            </Rule>
            <Rule>
              <span>03</span>
              <strong>Recorded</strong>
              <span>Privy enforces. ENSv2 identifies.</span>
            </Rule>
          </div>
        </div>
      </section>

      <section
        className="landing-section landing-section-dark page-grid"
        id="control"
      >
        <div className="section-title-block">
          <MetaLabel>Control surface</MetaLabel>
          <h2>One calm place to see what an agent can do.</h2>
        </div>
        <div className="control-statement">
          <span className="control-number">06</span>
          <p>Registry. Authority. Approval. Active state. Redline. Revoke.</p>
          <Button kind="secondary" onClick={onEnter}>
            Open Kanon
          </Button>
        </div>
      </section>

      <footer className="landing-footer page-grid">
        <Logo compact />
        <span>
          Kanon gives companies a visible control boundary for financial agents.
        </span>
        <span className="mono">
          3RD-WEB-HACK RELEASE / SEPOLIA TESTNET / 11155111
        </span>
      </footer>
    </main>
  );
}

function AppShell({
  screen,
  workspace,
  connection,
  statusInfo,
  announce,
  onRetry,
  onNavigate,
  onHome,
  children,
}: {
  readonly screen: Screen;
  readonly workspace: Workspace;
  readonly connection: ConnectionState;
  readonly statusInfo?: StatusResource;
  readonly announce: string;
  readonly onRetry: () => void;
  readonly onNavigate: (screen: Screen) => void;
  readonly onHome: () => void;
  readonly children: React.ReactNode;
}) {
  const liveSession = statusInfo?.demo.liveSession ?? null;
  const sessionIsOurs =
    liveSession !== null &&
    liveSession.installationId === workspace.installation?.id;
  return (
    <div className="app-shell">
      <header className="app-header page-grid">
        <button
          className="brand-button"
          onClick={onHome}
          aria-label="Back to Kanon landing page"
        >
          <Logo />
        </button>
        <nav className="app-nav" aria-label="Workspace">
          <button
            className={screen === "agents" ? "nav-link active" : "nav-link"}
            onClick={() => onNavigate("agents")}
          >
            Agents
          </button>
          <button
            className={screen === "detail" ? "nav-link active" : "nav-link"}
            onClick={() => onNavigate("detail")}
            disabled={!workspace.installation}
          >
            Live authority
          </button>
          <a className="nav-link" href="/docs">
            Docs
          </a>
        </nav>
        <div className="app-status">
          <span
            className={
              connection.state === "connected"
                ? "status-mark is-live"
                : "status-mark"
            }
          />
          <span role="status" aria-live="polite">
            {connection.state === "connected"
              ? "API connected"
              : connection.state === "unavailable"
                ? "API unavailable"
                : `Waking hosted backend… attempt ${connection.attempts}`}
          </span>
          {connection.state === "connecting" && (
            <span className="status-note">
              free-tier services sleep when idle — the first request can take up
              to a minute
            </span>
          )}
          {connection.state === "unavailable" && (
            <button className="text-link" onClick={onRetry}>
              Retry
            </button>
          )}
          <span className="mono">3RD-WEB-HACK / SEPOLIA TESTNET</span>
        </div>
      </header>
      <div className="workspace-ribbon page-grid">
        <span>
          <strong>{workspace.organization.name}</strong> /{" "}
          {workspace.organization.ensNamespace}
        </span>
        <span className="mono">
          {displayAddress(workspace.wallet.address)} / CHAIN{" "}
          {workspace.wallet.chainId}
        </span>
      </div>
      {connection.state === "connected" && (
        <div className="session-banner page-grid" aria-live="polite">
          {liveSession === null ? (
            <span>Fixture free — you can start a run</span>
          ) : sessionIsOurs ? (
            <span>
              Your session is live — it expires in{" "}
              {Math.max(1, Math.ceil(liveSession.expiresInSeconds / 60))} min
            </span>
          ) : (
            <span>
              Another session is live — it expires in{" "}
              {Math.max(1, Math.ceil(liveSession.expiresInSeconds / 60))} min
            </span>
          )}
          {workspace.installationSource === "session" &&
            workspace.installation && (
              <span className="mono">YOUR RUN — SAVED IN THIS BROWSER</span>
            )}
          {workspace.installationSource === "observe" &&
            workspace.installation && (
              <span className="mono">
                LATEST RUN — SOMEONE ELSE'S (READ ONLY)
              </span>
            )}
        </div>
      )}
      <div className="visually-hidden" role="status" aria-live="polite">
        {announce}
      </div>
      <main className="app-main page-grid">{children}</main>
    </div>
  );
}

function Registry({
  workspace,
  step,
  liveSessionBusy,
  loadFailed,
  onAdd,
  onOpen,
  onNavigate,
  onRetryLoad,
}: {
  readonly workspace: Workspace;
  readonly step: NextStep;
  readonly liveSessionBusy: boolean;
  readonly loadFailed: boolean;
  readonly onAdd: () => void;
  readonly onOpen: () => void;
  readonly onNavigate: (screen: Screen) => void;
  readonly onRetryLoad: () => void;
}) {
  const agent = workspace.installation?.agent ?? workspace.agent;
  const status = workspace.installation?.status ?? "VALIDATED";
  return (
    <div className="screen screen-registry" data-reveal>
      <div className="screen-heading">
        <div>
          <MetaLabel>Organization registry</MetaLabel>
          <h1>Agents</h1>
          <p>
            Deployed financial agents, their release identity, and the authority
            that requires attention.
          </p>
        </div>
        <Button onClick={onAdd} disabled={liveSessionBusy}>
          {liveSessionBusy ? "Fixture in use" : "Start a run"}
          <span aria-hidden="true"> ↗</span>
        </Button>
      </div>
      <NextStepPanel
        step={step}
        readOnly={workspace.installationSource === "observe"}
        onNavigate={onNavigate}
      />
      <div className="registry-layout">
        <section className="registry-panel" aria-labelledby="registry-title">
          <div className="panel-caption">
            <span id="registry-title">Agent registry</span>
            <span className="mono">
              {workspace.source === "api" ? "LIVE API" : "PROOF READBACK"}
            </span>
          </div>
          <div className="registry-head">
            <span>Identity</span>
            <span>Release</span>
            <span>Authority</span>
            <span>Attention</span>
          </div>
          <button className="registry-row" onClick={onOpen}>
            <span className="registry-identity">
              <strong>{agent.agentId}</strong>
              <span className="mono">
                {workspace.organization.ensNamespace}
              </span>
            </span>
            <span>
              <strong>{agent.releaseVersion}</strong>
              <span className="mono">{agent.releaseId}</span>
            </span>
            <span>
              <strong>
                {formatStatus(status)}
                {workspace.installationSource === "observe" &&
                workspace.installation
                  ? " · observing"
                  : ""}
              </strong>
              <span className="mono">
                {displayHash(
                  workspace.installation?.companyTerms.permissionHash,
                )}
              </span>
            </span>
            <span className="registry-attention">
              {status === "ACTIVE"
                ? "Within approved scope"
                : status === "REVOKED"
                  ? "Authority withdrawn"
                  : "Review required"}
              <span aria-hidden="true">↗</span>
            </span>
          </button>
          <div className="registry-empty-row">
            <span>Representative agent</span>
            <span className="mono">
              {loadFailed ? (
                <span>
                  Couldn't load runs —{" "}
                  <button
                    className="text-link"
                    type="button"
                    onClick={onRetryLoad}
                  >
                    Retry
                  </button>
                </span>
              ) : workspace.proof?.proof ? (
                "T11-T13 evidence available"
              ) : (
                "Awaiting first read"
              )}
            </span>
          </div>
        </section>
        <aside className="registry-aside">
          <MetaLabel>Control context</MetaLabel>
          <div className="aside-block">
            <span>ENS namespace</span>
            <strong>{workspace.organization.ensNamespace}</strong>
          </div>
          <div className="aside-block">
            <span>Control wallet</span>
            <strong className="mono">
              {displayAddress(workspace.wallet.address)}
            </strong>
          </div>
          <div className="aside-block">
            <span>Authority model</span>
            <strong>Human approval, Privy enforcement</strong>
          </div>
          <div className="aside-note">
            Kanon keeps agent requests separate from company-granted authority.
            The registry shows the boundary before the detail view shows the
            proof.
          </div>
          <JudgeRail
            installation={workspace.installation}
            onNavigate={onNavigate}
          />
        </aside>
      </div>
      <div className="screen-footnote">
        <span className="mono">
          {workspace.connected
            ? "NORMAL RESOLUTION AVAILABLE"
            : "CONNECTING TO API"}
        </span>
        <span>
          Sepolia testnet demo — technical identifiers stay secondary to the
          decision state.
        </span>
      </div>
    </div>
  );
}

function AddAgent({
  onSubmit,
  onBack,
  loading,
  error,
}: {
  readonly onSubmit: (draft: DraftRelease) => void;
  readonly onBack: () => void;
  readonly loading: boolean;
  readonly error?: DescribedError;
}) {
  const [agentId, setAgentId] = useState(REPRESENTATIVE_AGENT_ID);
  const [releaseId, setReleaseId] = useState(generateReleaseId);
  const [version, setVersion] = useState("1.0.0");
  const [packageContent, setPackageContent] = useState("kanon-agent-release");
  const [entry, setEntry] = useState("worker");
  return (
    <div className="screen form-screen" data-reveal>
      <ScreenBack label="Back to agents" onClick={onBack} />
      <div className="form-layout">
        <div className="form-intro">
          <MetaLabel>Agent identity</MetaLabel>
          <h1>Add an agent</h1>
          <p>
            Register a release and make its requested capability legible before
            any company authority is granted.
          </p>
          <div className="form-callout">
            <span className="mono">DECLARED BY AGENT</span>
            <strong>Requested capability is not approved authority.</strong>
          </div>
        </div>
        <form
          className="control-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({
              agentId,
              releaseId,
              version,
              packageContent,
              runtime: { entry },
              capabilities: { chains: [11155111], assets: ["native"] },
            });
          }}
        >
          <Field label="Agent identifier" hint="Stable identity">
            <input
              value={agentId}
              onChange={(event) => setAgentId(event.target.value)}
              required
            />
          </Field>
          <Field label="Release identifier" hint="Stable release record">
            <input
              value={releaseId}
              onChange={(event) => setReleaseId(event.target.value)}
              required
            />
          </Field>
          <Field label="Version" hint="Human-readable release version">
            <input
              value={version}
              onChange={(event) => setVersion(event.target.value)}
              required
            />
          </Field>
          <Field label="Runtime entry" hint="Declared runtime entry point">
            <input
              value={entry}
              onChange={(event) => setEntry(event.target.value)}
              required
            />
          </Field>
          <Field
            label="Package content reference"
            hint="Used to derive packageHash"
          >
            <input
              value={packageContent}
              onChange={(event) => setPackageContent(event.target.value)}
              required
            />
          </Field>
          <div className="capability-box">
            <div>
              <MetaLabel>Declared capabilities</MetaLabel>
              <strong>Ethereum Sepolia / native ETH</strong>
            </div>
            <span className="mono">CHAIN 11155111</span>
          </div>
          {error && <InlineError message={error} />}
          <div className="form-actions">
            <Button kind="secondary" onClick={onBack}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Publishing..." : "Continue to authority"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Authority({
  agent,
  controlWallet,
  initialTerms,
  onSubmit,
  onBack,
  loading,
  error,
}: {
  readonly agent: AgentResource;
  readonly controlWallet: string;
  readonly initialTerms: CompanyRule[];
  readonly onSubmit: (terms: CompanyRule[]) => void;
  readonly onBack: () => void;
  readonly loading: boolean;
  readonly error?: DescribedError;
}) {
  const recipient = initialTerms[0]?.recipient ?? controlWallet;
  const [maxValueWei, setMaxValueWei] = useState(
    initialTerms[0]?.maxValueWei ?? "1",
  );
  const [rollingMaxValueWei, setRollingMaxValueWei] = useState(
    initialTerms[0]?.rollingSpend?.maxValueWei ?? "1",
  );
  const [windowSeconds, setWindowSeconds] = useState(
    String(initialTerms[0]?.rollingSpend?.windowSeconds ?? 3600),
  );
  const terms: CompanyRule[] = [
    {
      chainId: 11155111,
      asset: "native",
      recipient,
      maxValueWei,
      rollingSpend: {
        maxValueWei: rollingMaxValueWei,
        windowSeconds: Number(windowSeconds),
      },
    },
  ];
  return (
    <div className="screen form-screen" data-reveal>
      <ScreenBack label="Back to agent identity" onClick={onBack} />
      <div className="form-layout authority-layout">
        <div className="form-intro">
          <MetaLabel>Company authority</MetaLabel>
          <h1>Define authority</h1>
          <p>
            Set the exact boundary the company is willing to grant to{" "}
            <strong>{agent.agentId}</strong>. Unsupported conditions stay
            visible and fail closed.
          </p>
          <div className="request-sheet">
            <span className="mono">AGENT REQUESTED</span>
            <div>
              <strong>
                {agent.manifest.capabilities.chains
                  ? "Sepolia"
                  : "Declared network"}
              </strong>
              <span>Native asset access</span>
            </div>
            <div>
              <strong>{agent.manifest.runtime.entry}</strong>
              <span>Runtime entry</span>
            </div>
          </div>
        </div>
        <form
          className="control-form authority-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(terms);
          }}
        >
          <div className="form-section-heading">
            <MetaLabel>Company grants</MetaLabel>
            <strong>Native ETH transaction rule</strong>
            <span>
              One exact recipient, one per-action ceiling, one rolling ceiling.
            </span>
          </div>
          <Field label="Chain" hint="Verified authority grammar">
            <select value="11155111" disabled>
              <option value="11155111">Ethereum Sepolia / 11155111</option>
            </select>
          </Field>
          <Field
            label="Recipient"
            hint="Hosted demo funds can only move to the organization control wallet"
          >
            <input value={recipient} readOnly aria-readonly="true" />
          </Field>
          <div className="field-grid">
            <Field label="Per-action ceiling" hint="Wei">
              <input
                value={maxValueWei}
                onChange={(event) => setMaxValueWei(event.target.value)}
                required
                inputMode="numeric"
              />
            </Field>
            <Field label="Rolling ceiling" hint="Wei per window">
              <input
                value={rollingMaxValueWei}
                onChange={(event) => setRollingMaxValueWei(event.target.value)}
                required
                inputMode="numeric"
              />
            </Field>
          </div>
          <Field label="Window" hint="Seconds">
            <input
              value={windowSeconds}
              onChange={(event) => setWindowSeconds(event.target.value)}
              required
              inputMode="numeric"
            />
          </Field>
          <div className="authority-note">
            <span className="note-mark">!</span>
            <span>
              Rolling limits use the verified <code>eth_signTransaction</code>{" "}
              path. The signed transaction is broadcast separately.
            </span>
          </div>
          <div className="authority-note">
            <span className="note-mark">!</span>
            <span>
              Hosted demo ceiling: the recipient is fixed to the organization
              control wallet, ceilings are capped at 1000 wei, and a rolling
              window is required.
            </span>
          </div>
          {error && <InlineError message={error} />}
          <div className="form-actions">
            <Button kind="secondary" onClick={onBack}>
              Back
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving terms..." : "Review authority"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ApprovalReview({
  agent,
  terms,
  permissionHash,
  action,
  installation,
  pending,
  onApprove,
  onRejectUpdate,
  onBack,
  loading,
  error,
}: {
  readonly agent: AgentResource;
  readonly terms: readonly CompanyRule[];
  readonly permissionHash?: string;
  readonly action: "APPROVE" | "REAUTHORIZE";
  readonly installation?: InstallationResource;
  readonly pending?: PendingWatch;
  readonly onApprove: () => void;
  readonly onRejectUpdate?: () => void;
  readonly onBack: () => void;
  readonly loading: boolean;
  readonly error?: DescribedError;
}) {
  const rule = terms[0];
  return (
    <div className="screen review-screen" data-reveal>
      <ScreenBack
        label={
          action === "REAUTHORIZE" ? "Back to update" : "Back to authority"
        }
        onClick={onBack}
      />
      <div className="review-header">
        <div>
          <MetaLabel>
            {action === "REAUTHORIZE"
              ? "Human reauthorization"
              : "Human approval"}
          </MetaLabel>
          <h1>
            {action === "REAUTHORIZE"
              ? "Approve the new authority"
              : "Review the mandate"}
          </h1>
          <p>
            {action === "REAUTHORIZE"
              ? "This release asks for a changed financial boundary. The current authority remains in force until you approve this exact version."
              : "Read the authority in company terms, then approve the exact normalized record."}
          </p>
        </div>
        <div className="review-decision">
          <span className="mono">DECISION REQUIRED</span>
          <strong>{agent.agentId}</strong>
          <span>
            {agent.releaseId} / {agent.releaseVersion}
          </span>
        </div>
      </div>
      <div className="mandate-sheet">
        <div className="mandate-heading">
          <span>Authority term</span>
          <span>Approved value</span>
        </div>
        <Rule>
          <span>Network</span>
          <strong>Ethereum Sepolia</strong>
          <span className="mono">11155111</span>
        </Rule>
        <Rule>
          <span>Asset</span>
          <strong>Native ETH</strong>
          <span className="mono">NATIVE</span>
        </Rule>
        <Rule>
          <span>Recipient</span>
          <strong className="mono">
            {displayAddress(rule?.recipient ?? "")}
          </strong>
          <span className="mono">EXACT</span>
        </Rule>
        <Rule>
          <span>Per-action ceiling</span>
          <strong className="mono">{rule?.maxValueWei ?? "Not set"} wei</strong>
          <span className="mono">MAX</span>
        </Rule>
        <Rule>
          <span>Rolling ceiling</span>
          <strong className="mono">
            {rule?.rollingSpend?.maxValueWei ?? "Not set"} wei /{" "}
            {rule?.rollingSpend?.windowSeconds ?? "-"}s
          </strong>
          <span className="mono">SUM</span>
        </Rule>
      </div>
      <div className="review-lower">
        <div className="review-warning">
          <span className="note-mark">!</span>
          <div>
            <strong>Human decision binds this release.</strong>
            <p>
              Approving records the agent, release, package, manifest, and
              permission hash together. Privy authority and ENS state must match
              before activation.
            </p>
          </div>
        </div>
        <div className="metadata-rail">
          <MetaLabel>Technical record</MetaLabel>
          <div>
            <span>permissionHash</span>
            <strong className="mono">{displayHash(permissionHash)}</strong>
          </div>
          <div>
            <span>manifestHash</span>
            <strong className="mono">{displayHash(agent.manifestHash)}</strong>
          </div>
          <div>
            <span>packageHash</span>
            <strong className="mono">{displayHash(agent.packageHash)}</strong>
          </div>
        </div>
      </div>
      {loading && (
        <div className="authority-summary">
          <div className="panel-caption">
            <span>Activating authority</span>
            <span className="mono">
              {pending
                ? `POLL ${pending.attempt} · ${pending.elapsedSeconds}S`
                : "USUALLY 30–60 S"}
            </span>
          </div>
          {activationSubsteps(true, installation).map((sub) => (
            <Rule key={sub.label}>
              <span aria-hidden="true">
                {sub.done ? "✓" : sub.active ? "…" : "·"}
              </span>
              <strong>{sub.label}</strong>
            </Rule>
          ))}
        </div>
      )}
      {error && <InlineError message={error} />}
      <div className="review-actions">
        <Button kind="secondary" onClick={onBack}>
          Keep editing
        </Button>
        {action === "REAUTHORIZE" && onRejectUpdate && (
          <Button kind="secondary" onClick={onRejectUpdate} disabled={loading}>
            Reject update (keep current authority)
          </Button>
        )}
        <Button onClick={onApprove} disabled={loading}>
          {loading
            ? pending
              ? "Recording decision, then activating…"
              : "Recording decision…"
            : action === "REAUTHORIZE"
              ? "Approve new authority"
              : "Approve exact authority"}
        </Button>
      </div>
    </div>
  );
}

function AgentDetail({
  workspace,
  executing,
  step,
  pending,
  readOnly,
  onExecute,
  onUpdate,
  onRevoke,
  onBack,
  onNavigate,
  onStartNewRun,
  loading,
  error,
}: {
  readonly workspace: Workspace;
  readonly executing?: "ALLOWED" | "FORBIDDEN";
  readonly step: NextStep;
  readonly pending?: PendingWatch;
  readonly readOnly: boolean;
  readonly onExecute: (scenario: "ALLOWED" | "FORBIDDEN") => void;
  readonly onUpdate: () => void;
  readonly onRevoke: () => void;
  readonly onBack: () => void;
  readonly onNavigate: (screen: Screen) => void;
  readonly onStartNewRun: () => void;
  readonly loading: boolean;
  readonly error?: DescribedError;
}) {
  const installation = workspace.installation;
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (confirmingRevoke) {
      confirmRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [confirmingRevoke]);
  const agent = installation?.agent ?? workspace.agent;
  const terms = installation?.companyTerms.companyTerms.authority.rules[0];
  const status = installation?.status ?? "VALIDATED";
  const ens = installation?.activeAuthority?.ens;
  const executions = (installation?.evidence ?? [])
    .filter((entry) => entry.schema === "kanon.api.execution-evidence")
    .map(
      (entry) =>
        entry.evidence as {
          readonly outcome?: string;
          readonly transactionHash?: string;
          readonly rejectionCode?: string;
          readonly generation?: number;
        },
    );
  const revoke = installation?.revoke;
  const retirement = installation?.retirement;
  const recorded = installation?.recordedAuthority;
  const ensName = ens?.binding.agentName ?? recorded?.ens?.agentName;
  const ensPendingLabel =
    status === "AWAITING_APPROVAL" || status === "CONFIGURING_AUTHORITY"
      ? "Assigned on activation"
      : "Identity pending";
  return (
    <div className="screen detail-screen" data-reveal>
      <ScreenBack label="Back to agents" onClick={onBack} />
      <div className="detail-header">
        <div>
          <MetaLabel>Agent detail</MetaLabel>
          <h1>{agent.agentId}</h1>
          <p>
            {agent.releaseId} / version {agent.releaseVersion}
          </p>
        </div>
        <StatusText status={status} />
      </div>
      <NextStepPanel
        step={step}
        readOnly={readOnly}
        onNavigate={onNavigate}
        busy={executing !== undefined || loading}
        onCommand={(command) => {
          if (command === "execute-allowed" || command === "post-revoke") {
            onExecute("ALLOWED");
            return true;
          }
          if (command === "execute-forbidden") {
            onExecute("FORBIDDEN");
            return true;
          }
          if (command === "revoke") {
            setConfirmingRevoke(true);
            return true;
          }
          return false;
        }}
      />
      {pending && <WatchPanel pending={pending} />}
      {(status === "CONFIGURING_AUTHORITY" ||
        status === "AWAITING_REAUTHORIZATION" ||
        status === "REVOKING") &&
        !pending && (
          <div className="authority-summary">
            <div className="panel-caption">
              <span>
                {status === "REVOKING"
                  ? "Revoking authority"
                  : "Applying authority"}
              </span>
              <span className="mono">IN PROGRESS</span>
            </div>
            {activationSubsteps(true, installation).map((sub) => (
              <Rule key={sub.label}>
                <span aria-hidden="true">
                  {sub.done ? "✓" : sub.active ? "…" : "·"}
                </span>
                <strong>{sub.label}</strong>
              </Rule>
            ))}
          </div>
        )}
      <div className="detail-layout">
        <section className="detail-main">
          <div className="detail-identity">
            <div>
              <MetaLabel>ENS identity</MetaLabel>
              <strong>{ensName ?? ensPendingLabel}</strong>
            </div>
            <div>
              <MetaLabel>Current release</MetaLabel>
              <strong>{agent.releaseVersion}</strong>
              <span className="mono">{displayHash(agent.packageHash)}</span>
            </div>
          </div>
          <div className="authority-summary">
            <div className="panel-caption">
              <span>Approved authority</span>
              <span className="mono">
                GENERATION {installation?.generation ?? 0}
              </span>
            </div>
            <Rule>
              <span>Network / asset</span>
              <strong>Ethereum Sepolia / native ETH</strong>
            </Rule>
            <Rule>
              <span>Recipient</span>
              <strong className="mono">
                {displayAddress(terms?.recipient ?? DEFAULT_RECIPIENT)}
              </strong>
            </Rule>
            <Rule>
              <span>Per-action ceiling</span>
              <strong className="mono">
                {terms?.maxValueWei ?? "Pending"} wei
              </strong>
            </Rule>
            <Rule>
              <span>Rolling ceiling</span>
              <strong className="mono">
                {terms?.rollingSpend
                  ? `${terms.rollingSpend.maxValueWei} wei / ${terms.rollingSpend.windowSeconds}s`
                  : "Pending"}
              </strong>
            </Rule>
          </div>
          {ens && (
            <div className="authority-summary">
              <div className="panel-caption">
                <span>ENS identity records</span>
                <span className="mono">
                  {ens.verified ? "VERIFIED" : "UNVERIFIED"}
                </span>
              </div>
              <Rule>
                <span>Agent name</span>
                <strong className="mono">{ens.binding.agentName}</strong>
              </Rule>
              <Rule>
                <span>Resolver</span>
                <a
                  className="mono"
                  href={`https://sepolia.etherscan.io/address/${ens.resolver}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {displayAddress(ens.resolver)}
                </a>
              </Rule>
              <Rule>
                <span>kanon.agentId</span>
                <strong className="mono">
                  {ens.records["kanon.agentId"] ?? "—"}
                </strong>
              </Rule>
              <Rule>
                <span>kanon.release</span>
                <strong className="mono">
                  {ens.records["kanon.release"] ?? "—"}
                </strong>
              </Rule>
              <Rule>
                <span>kanon.permissionHash</span>
                <strong className="mono hash-full">
                  {ens.records["kanon.permissionHash"] ?? "—"}
                </strong>
                {ens.records["kanon.permissionHash"] && (
                  <CopyButton value={ens.records["kanon.permissionHash"]} />
                )}
              </Rule>
              <Rule>
                <span>kanon.status</span>
                <strong className="mono">
                  {ens.records["kanon.status"] ?? "—"}
                </strong>
              </Rule>
            </div>
          )}
          {!ens && recorded?.ens && (
            <div className="authority-summary">
              <div className="panel-caption">
                <span>
                  {recorded.ens.source === "live"
                    ? "Current on-chain records"
                    : "Last recorded records"}
                </span>
                <span className="mono">
                  {recorded.ens.source === "live" ? "LIVE READ" : "RECORDED"}
                </span>
              </div>
              <Rule>
                <span>Agent name</span>
                <strong className="mono">{recorded.ens.agentName}</strong>
              </Rule>
              <Rule>
                <span>Resolver</span>
                <a
                  className="mono"
                  href={`https://sepolia.etherscan.io/address/${recorded.ens.resolver}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {displayAddress(recorded.ens.resolver)}
                </a>
              </Rule>
              <Rule>
                <span>kanon.agentId</span>
                <strong className="mono">
                  {recorded.ens.records["kanon.agentId"] ?? "—"}
                </strong>
              </Rule>
              <Rule>
                <span>kanon.release</span>
                <strong className="mono">
                  {recorded.ens.records["kanon.release"] ?? "—"}
                </strong>
              </Rule>
              <Rule>
                <span>kanon.permissionHash</span>
                <strong className="mono hash-full">
                  {recorded.ens.records["kanon.permissionHash"] ?? "—"}
                </strong>
              </Rule>
              <Rule>
                <span>kanon.status</span>
                <strong className="mono">
                  {recorded.ens.records["kanon.status"] ?? "—"}
                </strong>
              </Rule>
              {recorded.ens.records["kanon.release"] &&
                recorded.ens.records["kanon.release"] !== agent.releaseId && (
                  <p className="aside-note">
                    A later session has since used this identity — the on-chain
                    record above shows the most recent release bound to it.
                  </p>
                )}
            </div>
          )}
          {revoke && (
            <div className="authority-summary">
              <div className="panel-caption">
                <span>Revocation evidence</span>
                <span className="mono">{revoke.status}</span>
              </div>
              <Rule>
                <span>Privy authority revoked</span>
                <strong>
                  {revoke.privyAuthorityRevoked ? "Yes" : "Pending"}
                </strong>
              </Rule>
              <Rule>
                <span>ENS status</span>
                <strong className="mono">{revoke.ensStatus}</strong>
              </Rule>
              <Rule>
                <span>Post-revoke execution failed</span>
                <strong>
                  {revoke.postRevokeExecutionFailed ? "Yes" : "Not yet proven"}
                </strong>
              </Rule>
            </div>
          )}
          {!revoke && retirement && (
            <div className="authority-summary">
              <div className="panel-caption">
                <span>Authority retired</span>
                <span className="mono">{status}</span>
              </div>
              <Rule>
                <span>Reason</span>
                <strong>Retired by session expiry</strong>
              </Rule>
              <Rule>
                <span>Delegated signers remaining</span>
                <strong className="mono">
                  {retirement.privySignerCountAfter}
                </strong>
              </Rule>
              <Rule>
                <span>ENS revoked status written</span>
                <strong>
                  {retirement.ensRevokedWritten ? "Yes" : "Not required"}
                </strong>
              </Rule>
            </div>
          )}
          {status === "REVOKED" &&
            installation &&
            postRevokeAttempted(installation) && (
              <div className="authority-summary">
                <div className="panel-caption">
                  <span>Run complete — the proof</span>
                  <span className="mono">
                    GENERATION {installation.generation} · REVOKED
                  </span>
                </div>
                <Rule>
                  <span>Installation</span>
                  <strong className="mono">{installation.id}</strong>
                </Rule>
                <Rule>
                  <span>Approved permission hash</span>
                  <strong className="mono hash-full">
                    {installation.companyTerms.permissionHash}
                  </strong>
                  {installation.companyTerms.permissionHash && (
                    <CopyButton
                      value={installation.companyTerms.permissionHash}
                    />
                  )}
                </Rule>
                {executions.map((entry, index) => (
                  <Rule key={`proof-${index}`}>
                    <span>
                      {entry.outcome === "SUCCEEDED"
                        ? "Allowed action"
                        : "Rejected action"}
                      {entry.generation !== undefined
                        ? ` · gen ${entry.generation}`
                        : ""}
                    </span>
                    <strong className="mono">
                      {entry.transactionHash ? (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${entry.transactionHash}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {displayHash(entry.transactionHash)}
                        </a>
                      ) : (
                        (entry.rejectionCode ?? "REJECTED")
                      )}
                    </strong>
                  </Rule>
                ))}
                <Rule>
                  <span>ENS identity</span>
                  <strong className="mono">
                    {ens?.binding.agentName ?? recorded?.ens?.agentName ?? "—"}
                  </strong>
                </Rule>
                {(ens?.resolver ?? recorded?.ens?.resolver) && (
                  <Rule>
                    <span>Resolver</span>
                    <a
                      className="mono"
                      href={`https://sepolia.etherscan.io/address/${ens?.resolver ?? recorded?.ens?.resolver}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {displayAddress(
                        ens?.resolver ?? recorded?.ens?.resolver ?? "",
                      )}
                    </a>
                  </Rule>
                )}
                {!readOnly && (
                  <div className="form-actions">
                    <Button onClick={onStartNewRun}>Start another run</Button>
                  </div>
                )}
              </div>
            )}
          <div className="detail-actions">
            {!readOnly && status === "ACTIVE" && (
              <>
                <Button
                  onClick={() => onExecute("ALLOWED")}
                  disabled={!installation || executing !== undefined || loading}
                >
                  {executing === "ALLOWED"
                    ? "Waiting for Sepolia confirmation — usually under a minute"
                    : "Run allowed action"}
                </Button>
                <Button
                  kind="secondary"
                  onClick={() => onExecute("FORBIDDEN")}
                  disabled={!installation || executing !== undefined || loading}
                >
                  {executing === "FORBIDDEN"
                    ? "Waiting for Sepolia confirmation…"
                    : "Try forbidden action"}
                </Button>
              </>
            )}
            {!readOnly && status === "ACTIVE" && (
              <Button
                kind="secondary"
                onClick={onUpdate}
                disabled={!installation || loading}
              >
                Request a broader release
              </Button>
            )}
            {!readOnly &&
              status === "ACTIVE" &&
              (confirmingRevoke ? (
                <div className="confirm-block" ref={confirmRef}>
                  <p>
                    <strong>Revoke is irreversible.</strong> The delegated
                    signer is removed from the Privy wallet, the ENS status
                    becomes revoked, and any later action by this agent fails. A
                    new run would need a fresh approval.
                  </p>
                  <div className="confirm-actions">
                    <Button
                      kind="secondary"
                      onClick={() => setConfirmingRevoke(false)}
                      disabled={loading}
                    >
                      Keep authority
                    </Button>
                    <Button
                      kind="danger"
                      onClick={() => {
                        setConfirmingRevoke(false);
                        onRevoke();
                      }}
                      disabled={loading}
                    >
                      {loading
                        ? "Removing signer and writing ENS revocation — usually 30–90 s"
                        : "Yes, revoke authority"}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  kind="danger"
                  onClick={() => setConfirmingRevoke(true)}
                  disabled={!installation || loading}
                >
                  {loading
                    ? "Removing signer and writing ENS revocation — usually 30–90 s"
                    : "Revoke authority"}
                </Button>
              ))}
            {!readOnly && status === "REVOKED" && (
              <Button
                onClick={() => onExecute("ALLOWED")}
                disabled={!installation || executing !== undefined || loading}
              >
                {executing === "ALLOWED"
                  ? "Waiting for runner refusal…"
                  : "Attempt allowed action after revoke"}
              </Button>
            )}
            {readOnly && (
              <span className="observe-note">
                Read-only view — this run belongs to another session.
              </span>
            )}
          </div>
          {executions.length > 0 && (
            <div className="authority-summary">
              <div className="panel-caption">
                <span>Execution evidence</span>
                <span className="mono">{executions.length} RECORDED</span>
              </div>
              {executions.map((entry, index) => (
                <Rule key={index}>
                  <span>
                    {entry.outcome === "SUCCEEDED"
                      ? "Allowed action"
                      : "Rejected action"}
                    {entry.generation !== undefined
                      ? ` / generation ${entry.generation}`
                      : ""}
                  </span>
                  <strong className="mono">
                    {entry.transactionHash ? (
                      <a
                        href={`https://sepolia.etherscan.io/tx/${entry.transactionHash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {displayHash(entry.transactionHash)}
                      </a>
                    ) : (
                      (entry.rejectionCode ?? "REJECTED")
                    )}
                  </strong>
                </Rule>
              ))}
            </div>
          )}
          {error && <InlineError message={error} />}
        </section>
        <aside className="detail-rail">
          <MetaLabel>Evidence</MetaLabel>
          <div className="evidence-item">
            <span>Privy method</span>
            <strong className="mono">
              {installation?.activeAuthority?.privy.executionMethod ??
                recorded?.privy?.executionMethod ??
                "Pending"}
            </strong>
          </div>
          <div className="evidence-item">
            <span>Policy</span>
            <strong className="mono">
              {displayHash(
                installation?.activeAuthority?.privy.policyId ??
                  recorded?.privy?.policyId,
              )}
            </strong>
          </div>
          <div className="evidence-item">
            <span>Privy status</span>
            <strong className="mono">
              {installation?.activeAuthority?.privy.status ??
                recorded?.privy?.status ??
                (status === "REVOKED" ? "REVOKED" : "Pending")}
            </strong>
          </div>
          <div className="evidence-item">
            <span>ENS resolver</span>
            <strong className="mono">
              {displayAddress(ens?.resolver ?? recorded?.ens?.resolver ?? "")}
            </strong>
          </div>
          <div className="evidence-item">
            <span>Permission hash</span>
            <strong className="mono">
              {displayHash(installation?.companyTerms.permissionHash)}
            </strong>
          </div>
          <div className="evidence-note">
            Evidence is secondary to the decision. It remains available for the
            company record.
          </div>
          <JudgeRail installation={installation} onNavigate={onNavigate} />
        </aside>
      </div>
    </div>
  );
}

function UpdateReview({
  agent,
  currentTerms,
  diff,
  onRequest,
  onRejectUpdate,
  onApprove,
  onBack,
  loading,
  error,
}: {
  readonly agent: AgentResource;
  readonly currentTerms: readonly CompanyRule[];
  readonly diff?: InstallationResource["updateDiff"];
  readonly onRequest: (draft: DraftRelease, terms: CompanyRule[]) => void;
  readonly onRejectUpdate: () => void;
  readonly onApprove: () => void;
  readonly onBack: () => void;
  readonly loading: boolean;
  readonly error?: DescribedError;
}) {
  const [version, setVersion] = useState(
    `${Number.parseFloat(agent.releaseVersion) + 1 || "2.0.0"}`,
  );
  const [releaseId, setReleaseId] = useState(nextReleaseId(agent.releaseId));
  const [maxValueWei, setMaxValueWei] = useState(() => {
    const current = currentTerms[0]?.maxValueWei ?? "1";
    try {
      return (BigInt(current) + 1n).toString();
    } catch {
      return "2";
    }
  });
  const [packageContent, setPackageContent] = useState(
    "kanon-agent-expanded-release",
  );
  const nextTerms: CompanyRule[] = [
    {
      ...(currentTerms[0] ?? DEFAULT_TERMS[0]),
      maxValueWei,
      rollingSpend: {
        ...(currentTerms[0]?.rollingSpend ?? DEFAULT_TERMS[0].rollingSpend!),
        maxValueWei,
      },
    },
  ];
  return (
    <div className="screen update-screen" data-reveal>
      <ScreenBack label="Back to agent detail" onClick={onBack} />
      <div className="update-heading">
        <div>
          <MetaLabel>Permission-aware update</MetaLabel>
          <h1>Review the change</h1>
          <p>
            A new release does not inherit broader authority silently. Compare
            the requested terms, then decide.
          </p>
        </div>
        <span className="change-mark">
          {diff?.diff.classification ?? "DRAFT CHANGE"}
        </span>
      </div>
      {diff && (
        <div className="update-classification">
          <Rule>
            <span>Classification</span>
            <strong className="mono">{diff.proposal.classification}</strong>
          </Rule>
          <Rule>
            <span>Requires human review</span>
            <strong>{diff.proposal.requiresHumanReview ? "Yes" : "No"}</strong>
          </Rule>
          {diff.diff.changedPaths.length > 0 && (
            <Rule>
              <span>Changed paths</span>
              <strong className="mono">
                {diff.diff.changedPaths.join(", ")}
              </strong>
            </Rule>
          )}
        </div>
      )}
      <div className="redline-sheet">
        <div className="redline-head">
          <span>Authority field</span>
          <span>Current</span>
          <span>Requested</span>
        </div>
        <RedlineRow
          label="Release"
          current={agent.releaseVersion}
          requested={version}
          changed={version !== agent.releaseVersion}
        />
        <RedlineRow
          label="Per-action ceiling"
          current={`${currentTerms[0]?.maxValueWei ?? "-"} wei`}
          requested={`${maxValueWei} wei`}
          changed={maxValueWei !== currentTerms[0]?.maxValueWei}
        />
        <RedlineRow
          label="Rolling ceiling"
          current={`${currentTerms[0]?.rollingSpend?.maxValueWei ?? "-"} wei`}
          requested={`${maxValueWei} wei`}
          changed={maxValueWei !== currentTerms[0]?.rollingSpend?.maxValueWei}
        />
        <RedlineRow
          label="Recipient"
          current={displayAddress(
            currentTerms[0]?.recipient ?? DEFAULT_RECIPIENT,
          )}
          requested={displayAddress(
            currentTerms[0]?.recipient ?? DEFAULT_RECIPIENT,
          )}
          changed={false}
        />
        {diff?.diff.changedPaths.map((path) => (
          <RedlineRow
            key={path}
            label={path}
            current="Current record"
            requested="Changed"
            changed
          />
        ))}
      </div>
      <div className="update-controls">
        <div>
          <MetaLabel>Requested release</MetaLabel>
          <Field label="Release identifier" hint="New release record">
            <input
              value={releaseId}
              onChange={(event) => setReleaseId(event.target.value)}
            />
          </Field>
          <Field label="Version" hint="New version">
            <input
              value={version}
              onChange={(event) => setVersion(event.target.value)}
            />
          </Field>
          <Field
            label="Package content reference"
            hint="Derives the new package hash"
          >
            <input
              value={packageContent}
              onChange={(event) => setPackageContent(event.target.value)}
            />
          </Field>
          <Field label="Requested per-action ceiling" hint="Wei">
            <input
              value={maxValueWei}
              onChange={(event) => setMaxValueWei(event.target.value)}
              inputMode="numeric"
            />
          </Field>
        </div>
        <div className="update-decision">
          <div className="update-warning">
            <span className="note-mark">!</span>
            <div>
              <strong>
                {diff?.diff.requiresHumanReview === false
                  ? "No human review required"
                  : "Human reauthorization required"}
              </strong>
              <p>
                {diff?.diff.reason ??
                  "The requested authority is broader than the current approved record."}
              </p>
            </div>
          </div>
          {!diff && (
            <Button
              onClick={() =>
                onRequest(
                  {
                    agentId: agent.agentId,
                    releaseId,
                    version,
                    packageContent,
                    runtime: { entry: agent.manifest.runtime.entry },
                    capabilities: agent.manifest.capabilities,
                  },
                  nextTerms,
                )
              }
              disabled={loading}
            >
              {loading ? "Preparing review..." : "Prepare reauthorization"}
            </Button>
          )}
          {diff && (
            <>
              <Button onClick={onApprove} disabled={loading}>
                {loading ? "Loading…" : "Continue to reauthorization"}
              </Button>
              <Button
                kind="secondary"
                onClick={onRejectUpdate}
                disabled={loading}
              >
                {loading
                  ? "Withdrawing..."
                  : "Reject update (keep current authority)"}
              </Button>
            </>
          )}
          <Button kind="secondary" onClick={onBack}>
            Keep current authority
          </Button>
        </div>
      </div>
      {error && <InlineError message={error} />}
    </div>
  );
}

function RedlineRow({
  label,
  current,
  requested,
  changed,
}: {
  readonly label: string;
  readonly current: string;
  readonly requested: string;
  readonly changed: boolean;
}) {
  return (
    <div className={changed ? "redline-row is-changed" : "redline-row"}>
      <span>{label}</span>
      <span className="old-value">{current}</span>
      <strong className={changed ? "new-value" : "new-value quiet"}>
        {requested}
      </strong>
      {changed && <span className="delta-label">CHANGED</span>}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  readonly label: string;
  readonly hint: string;
  readonly children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      <span className="field-hint">{hint}</span>
    </label>
  );
}

function ScreenBack({
  label,
  onClick,
}: {
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button className="back-link" onClick={onClick}>
      <span aria-hidden="true">↖</span>
      {label}
    </button>
  );
}

function StatusText({ status }: { readonly status: string }) {
  const label = formatStatus(status);
  return (
    <div className={`status-text status-${status.toLowerCase()}`}>
      <span className="status-mark" />
      <span>{label}</span>
    </div>
  );
}

function InlineError({
  message,
  onRetry,
}: {
  readonly message: DescribedError;
  readonly onRetry?: () => void;
}) {
  return (
    <div className="inline-error" role="alert">
      <span className="note-mark">!</span>
      <div className="inline-error-body">
        <strong>{message.title}</strong>
        <span>{message.detail}</span>
        <span className="inline-error-recovery">{message.recovery}</span>
      </div>
      {onRetry && (
        <button className="text-link" type="button" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export default function App() {
  const api = useMemo(() => new KanonApi(), []);
  const [screen, setScreen] = useState<Screen>("landing");
  const [workspace, setWorkspace] = useState<Workspace>({
    organization: FALLBACK_ORGANIZATION,
    wallet: FALLBACK_WALLET,
    agent: FALLBACK_AGENT,
    connected: false,
    source: "fixture",
    installationSource: "none",
  });
  const [connection, setConnection] = useState<ConnectionState>({
    state: "connecting",
    attempts: 0,
  });
  const [statusInfo, setStatusInfo] = useState<StatusResource>();
  const [announce, setAnnounce] = useState("");
  const [executing, setExecuting] = useState<"ALLOWED" | "FORBIDDEN">();
  const [draftRelease, setDraftRelease] = useState<DraftRelease>();
  const [draftAgent, setDraftAgent] = useState<AgentResource>(FALLBACK_AGENT);
  const [terms, setTerms] = useState<CompanyRule[]>(DEFAULT_TERMS);
  const [permissionHash, setPermissionHash] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<DescribedError>();
  const [pending, setPending] = useState<PendingWatch>();
  const [loadFailed, setLoadFailed] = useState(false);
  const watchingRef = useRef<string | undefined>(undefined);

  const safeStateNote = useCallback(
    (kind: PendingWatch["kind"], installation?: InstallationResource) => {
      if (kind === "activation" || kind === "reauthorization") {
        return installation?.status === "AWAITING_APPROVAL" ||
          installation?.status === "UPDATE_AVAILABLE"
          ? "No new authority was granted — the previous boundary remains in force. You can retry the approval."
          : "The previous authority remains in force until the new one activates. Check the run state, then retry.";
      }
      if (kind === "revocation") {
        return "The run is not revoked yet; the existing authority stays unchanged until revocation completes.";
      }
      return "No new evidence was recorded. Check the run state and retry the action.";
    },
    [],
  );

  const watchForOutcome = useCallback(
    async (
      kind: PendingWatch["kind"],
      installationId: string,
      until: (installation: InstallationResource) => boolean,
      seed: InstallationResource | undefined,
      onDone?: (next: InstallationResource) => void,
    ) => {
      watchingRef.current = `${kind}:${installationId}`;
      setPending({
        kind,
        installationId,
        attempt: 0,
        elapsedSeconds: 0,
      });
      setAnnounce(`Checking the ${kind} result…`);
      try {
        const next = await api.waitForInstallation(
          ORGANIZATION_ID,
          installationId,
          seed,
          {
            until,
            onProgress: (progress) =>
              setPending((current) =>
                current
                  ? {
                      ...current,
                      attempt: progress.attempt,
                      elapsedSeconds: progress.elapsedSeconds,
                    }
                  : current,
              ),
          },
        );
        setWorkspace((current) =>
          current.installation?.id === next.id ||
          current.installation === undefined
            ? {
                ...current,
                agent: next.agent,
                installation: next,
                source: "api",
              }
            : current,
        );
        if (until(next)) {
          setAnnounce(`The ${kind} finished.`);
          onDone?.(next);
        } else {
          setError({
            title: "Still waiting",
            detail: `The ${kind} did not reach its final state within five minutes.`,
            recovery: safeStateNote(kind, next),
            retryable: true,
          });
          setAnnounce(`The ${kind} is still in progress.`);
        }
      } catch (caught) {
        setError(getErrorMessage(caught));
      } finally {
        setPending(undefined);
        watchingRef.current = undefined;
      }
    },
    [api, safeStateNote],
  );

  const loadWorkspace = useCallback(async () => {
    const [organization, wallet, proof] = await Promise.all([
      api.organization(ORGANIZATION_ID).catch(() => FALLBACK_ORGANIZATION),
      api.wallet(ORGANIZATION_ID).catch(() => FALLBACK_WALLET),
      api.proofLatest().catch(() => undefined),
    ]);
    let installation: InstallationResource | undefined;
    let installationSource: Workspace["installationSource"] = "none";
    let installationLoadFailed = false;
    const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      installation = await api
        .installation(ORGANIZATION_ID, stored)
        .catch(() => {
          installationLoadFailed = true;
          return undefined;
        });
      if (installation) installationSource = "session";
    }
    if (!installation) {
      const list = await api.installations(ORGANIZATION_ID, 5).catch(() => {
        installationLoadFailed = true;
        return undefined;
      });
      const latest = list?.[0];
      if (latest) {
        installation =
          (await api
            .installation(ORGANIZATION_ID, latest.id)
            .catch(() => undefined)) ?? latest;
        installationSource = "observe";
      }
    }
    if (!installation) {
      installation = await api
        .installation(ORGANIZATION_ID, INSTALLATION_ID)
        .catch(() => {
          installationLoadFailed = true;
          return undefined;
        });
      if (installation) installationSource = "observe";
    }
    setLoadFailed(installationLoadFailed && installation === undefined);
    const agent =
      installation?.agent ??
      (await api
        .agent(ORGANIZATION_ID, REPRESENTATIVE_AGENT_ID)
        .catch(() => FALLBACK_AGENT));
    setWorkspace({
      organization,
      wallet,
      agent,
      installation,
      proof,
      connected: true,
      source: installation ? "api" : proof ? "proof" : "fixture",
      installationSource,
    });
    // Only our own session's terms seed the draft form — an observed run's
    // (possibly already-updated) terms must not leak into a new run, or the
    // update step would ask for the boundary that is already in force.
    const seeded = seededDraftTerms(installationSource, installation);
    if (seeded) {
      setTerms([...seeded.rules]);
      setPermissionHash(seeded.permissionHash);
    } else {
      setTerms(DEFAULT_TERMS);
      setPermissionHash(undefined);
    }
    // A stored session can return mid-operation — resume watching instead
    // of leaving the user on a frozen intermediate state.
    if (installation && watchingRef.current === undefined) {
      const id = installation.id;
      if (installation.status === "CONFIGURING_AUTHORITY") {
        void watchForOutcome(
          "activation",
          id,
          (next) => next.status === "ACTIVE",
          installation,
        );
      } else if (installation.status === "AWAITING_REAUTHORIZATION") {
        void watchForOutcome(
          "reauthorization",
          id,
          (next) => next.status === "ACTIVE",
          installation,
        );
      } else if (installation.status === "REVOKING") {
        void watchForOutcome(
          "revocation",
          id,
          (next) => next.status === "REVOKED",
          installation,
        );
      }
    }
  }, [api, watchForOutcome]);

  const connect = useCallback(async () => {
    const deadline = Date.now() + 240_000;
    let attempt = 0;
    while (Date.now() < deadline) {
      attempt += 1;
      setConnection({ state: "connecting", attempts: attempt });
      try {
        const info = await api.status();
        setStatusInfo(info);
        setConnection({ state: "connected", attempts: attempt });
        await loadWorkspace();
        return;
      } catch {
        await sleep(attempt <= 1 ? 3_000 : attempt === 2 ? 5_000 : 8_000);
      }
    }
    setConnection((current) => ({
      state: "unavailable",
      attempts: current.attempts,
    }));
  }, [api, loadWorkspace]);

  useEffect(() => {
    void connect();
  }, [connect]);

  useEffect(() => {
    if (connection.state !== "connected") return;
    const interval = window.setInterval(() => {
      api
        .status()
        .then(setStatusInfo)
        .catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [connection.state, api]);

  const handlePublish = async (draft: DraftRelease) => {
    setLoading(true);
    setError(undefined);
    setDraftRelease(draft);
    try {
      const agent = await api.publishRelease(
        ORGANIZATION_ID,
        draft.agentId,
        draft as unknown as Record<string, unknown>,
        `installation-${draft.releaseId}`,
      );
      setDraftAgent(agent);
      setScreen("authority");
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  const handleTerms = async (nextTerms: CompanyRule[]) => {
    setLoading(true);
    setError(undefined);
    setTerms(nextTerms);
    const installationId = draftRelease
      ? `installation-${draftRelease.releaseId}`
      : INSTALLATION_ID;
    try {
      const installation = await api.defineTerms(
        ORGANIZATION_ID,
        installationId,
        { rules: nextTerms },
      );
      window.localStorage.setItem(SESSION_STORAGE_KEY, installation.id);
      setWorkspace((current) => ({
        ...current,
        agent: installation.agent,
        installation,
        source: "api",
        installationSource: "session",
      }));
      setPermissionHash(installation.companyTerms.permissionHash);
      setScreen("review");
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (action: "APPROVE" | "REAUTHORIZE") => {
    setLoading(true);
    setError(undefined);
    const installation = workspace.installation;
    const agent =
      action === "REAUTHORIZE"
        ? draftAgent
        : (installation?.agent ?? draftAgent);
    const nextInstallationId =
      installation?.id ??
      (draftRelease
        ? `installation-${draftRelease.releaseId}`
        : INSTALLATION_ID);
    const decision = {
      schema: "kanon.human-decision",
      version: 1,
      id: decisionId(
        action === "APPROVE" ? "decision-approve" : "decision-reauthorize",
      ),
      action,
      outcome: "APPROVED",
      decidedBy: "company-operator",
      decidedAt: new Date().toISOString(),
      agentId: agent.agentId,
      releaseId: agent.releaseId,
      packageHash: agent.packageHash,
      manifestHash: agent.manifestHash,
      permissionHash:
        action === "REAUTHORIZE"
          ? (installation?.updateDiff?.proposal.permissionSet.permissionHash ??
            permissionHash ??
            "")
          : (permissionHash ?? ""),
    };
    try {
      const submitted = await api.approval(
        ORGANIZATION_ID,
        nextInstallationId,
        decision,
      );
      window.localStorage.setItem(SESSION_STORAGE_KEY, submitted.id);
      setWorkspace((current) => ({
        ...current,
        agent: submitted.agent,
        installation: submitted,
        source: "api",
        installationSource: "session",
      }));
      const isActive = (next: InstallationResource) => next.status === "ACTIVE";
      if (isActive(submitted)) {
        setScreen("detail");
        return;
      }
      const next = await api.waitForInstallation(
        ORGANIZATION_ID,
        nextInstallationId,
        submitted,
        {
          until: isActive,
          onProgress: (progress) =>
            setPending({
              kind: action === "REAUTHORIZE" ? "reauthorization" : "activation",
              installationId: nextInstallationId,
              attempt: progress.attempt,
              elapsedSeconds: progress.elapsedSeconds,
            }),
        },
      );
      setPending(undefined);
      setWorkspace((current) => ({
        ...current,
        agent: next.agent,
        installation: next,
        source: "api",
        installationSource: "session",
      }));
      if (next.companyTerms.permissionHash)
        setPermissionHash(next.companyTerms.permissionHash);
      if (next.status !== "ACTIVE") {
        setError({
          title: "Activation did not finish",
          detail: `The installation is ${formatStatus(next.status)} instead of active.`,
          recovery:
            "No new authority was granted — the run remains fail-closed. You can retry the approval.",
          retryable: true,
        });
        return;
      }
      setScreen("detail");
    } catch (caught) {
      setPending(undefined);
      if (isTransientError(caught)) {
        // The server keeps working after the browser gives up — switch to
        // watching the installation instead of presenting a dead end.
        setScreen("detail");
        void watchForOutcome(
          action === "REAUTHORIZE" ? "reauthorization" : "activation",
          nextInstallationId,
          (next) => next.status === "ACTIVE",
          workspace.installation,
        );
      } else {
        setError(getErrorMessage(caught));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async (scenario: "ALLOWED" | "FORBIDDEN") => {
    const installation = workspace.installation;
    if (!installation) return;
    setExecuting(scenario);
    setError(undefined);
    setAnnounce("Waiting for Sepolia confirmation…");
    const evidenceCount = installation.evidence.length;
    try {
      const next = await api.execute(
        ORGANIZATION_ID,
        installation.id,
        scenario,
      );
      setWorkspace((current) => ({
        ...current,
        installation: next,
        source: "api",
      }));
      const latest = next.evidence.at(-1)?.evidence;
      const outcome = String(latest?.outcome ?? "recorded").toLowerCase();
      setAnnounce(
        `Execution ${outcome}${latest?.rejectionCode ? `: ${String(latest.rejectionCode)}` : ""}`,
      );
    } catch (caught) {
      if (isTransientError(caught)) {
        void watchForOutcome(
          "execution",
          installation.id,
          (next) => next.evidence.length > evidenceCount,
          installation,
          (next) => {
            const latest = next.evidence.at(-1)?.evidence;
            const outcome = String(latest?.outcome ?? "recorded").toLowerCase();
            setAnnounce(
              `Execution ${outcome}${latest?.rejectionCode ? `: ${String(latest.rejectionCode)}` : ""}`,
            );
          },
        );
        setAnnounce(
          "The request timed out — checking whether the server recorded the execution…",
        );
      } else {
        setError(getErrorMessage(caught));
        setAnnounce("Execution request failed");
      }
    } finally {
      setExecuting(undefined);
    }
  };

  const handleRejectUpdate = async () => {
    const installation = workspace.installation;
    if (!installation) return;
    setLoading(true);
    setError(undefined);
    try {
      const next = await api.rejectUpdate(ORGANIZATION_ID, installation.id);
      setWorkspace((current) => ({
        ...current,
        installation: next,
        source: "api",
      }));
      setScreen("detail");
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  const handlePrepareUpdate = async (
    draft: DraftRelease,
    nextTerms: CompanyRule[],
  ) => {
    setLoading(true);
    setError(undefined);
    setDraftRelease(draft);
    setTerms(nextTerms);
    try {
      const installation = workspace.installation;
      const agent = await api.publishRelease(
        ORGANIZATION_ID,
        draft.agentId,
        draft as unknown as Record<string, unknown>,
        installation?.id,
      );
      setDraftAgent(agent);
      if (installation) {
        const updated = await api.defineTerms(
          ORGANIZATION_ID,
          installation.id,
          { rules: nextTerms },
        );
        setWorkspace((current) => ({
          ...current,
          agent: updated.agent,
          installation: updated,
          source: "api",
        }));
        setPermissionHash(updated.companyTerms.permissionHash);
      }
      // Stay on the update screen: the installation now carries updateDiff,
      // which surfaces the EXPANDED classification and changed paths before
      // the user continues to reauthorization.
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    const installation = workspace.installation;
    if (!installation) return;
    setLoading(true);
    setError(undefined);
    const agent = installation.agent;
    const decision = {
      schema: "kanon.human-decision",
      version: 1,
      id: decisionId("decision-revoke"),
      action: "REVOKE",
      outcome: "APPROVED",
      decidedBy: "company-operator",
      decidedAt: new Date().toISOString(),
      agentId: agent.agentId,
      releaseId: agent.releaseId,
      packageHash: agent.packageHash,
      manifestHash: agent.manifestHash,
      permissionHash: installation.companyTerms.permissionHash,
    };
    try {
      const next = await api.revoke(ORGANIZATION_ID, installation.id, decision);
      setWorkspace((current) => ({
        ...current,
        installation: next,
        source: "api",
      }));
      if (next.status === "REVOKING") {
        void watchForOutcome(
          "revocation",
          next.id,
          (later) => later.status === "REVOKED",
          next,
        );
      } else if (next.status === "REVOKED") {
        setAnnounce("Authority revoked — the delegated signer is removed.");
      }
    } catch (caught) {
      if (isTransientError(caught)) {
        void watchForOutcome(
          "revocation",
          installation.id,
          (next) => next.status === "REVOKED",
          installation,
        );
      } else {
        setError(getErrorMessage(caught));
      }
    } finally {
      setLoading(false);
    }
  };

  if (screen === "landing")
    return <LandingPage onEnter={() => setScreen("agents")} />;
  const installation = workspace.installation;
  const liveSession = statusInfo?.demo.liveSession ?? null;
  const liveSessionBusy =
    liveSession !== null && liveSession.installationId !== installation?.id;
  const readOnly = workspace.installationSource === "observe";
  const step = nextStepFor({
    installation,
    installationSource: workspace.installationSource,
    liveSession,
    connected: connection.state === "connected",
  });
  const startNewRun = () => {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setError(undefined);
    setDraftRelease(undefined);
    void loadWorkspace();
    setScreen("add");
  };
  const currentAgent = installation?.agent ?? draftAgent ?? workspace.agent;
  const reauthorizationPending =
    installation?.status === "AWAITING_REAUTHORIZATION" ||
    installation?.status === "UPDATE_AVAILABLE";
  const reviewAgent = reauthorizationPending ? draftAgent : currentAgent;
  const reviewTerms = reauthorizationPending
    ? (installation?.updateDiff?.proposal.permissionSet.companyTerms.authority
        .rules ?? terms)
    : terms;
  const reviewPermissionHash = reauthorizationPending
    ? (installation?.updateDiff?.proposal.permissionSet.permissionHash ??
      permissionHash)
    : permissionHash;
  return (
    <AppShell
      screen={screen}
      workspace={workspace}
      connection={connection}
      statusInfo={statusInfo}
      announce={announce}
      onRetry={() => void connect()}
      onNavigate={(next) => {
        setError(undefined);
        setScreen(next);
      }}
      onHome={() => setScreen("landing")}
    >
      {screen === "agents" && (
        <Registry
          workspace={workspace}
          step={step}
          liveSessionBusy={liveSessionBusy}
          loadFailed={loadFailed}
          onAdd={() => {
            setError(undefined);
            setScreen("add");
          }}
          onOpen={() => {
            setError(undefined);
            setScreen("detail");
          }}
          onNavigate={(next) => {
            setError(undefined);
            setScreen(next);
          }}
          onRetryLoad={() => void loadWorkspace()}
        />
      )}
      {screen === "add" && (
        <AddAgent
          onSubmit={handlePublish}
          onBack={() => setScreen("agents")}
          loading={loading}
          error={error}
        />
      )}
      {screen === "authority" && (
        <Authority
          agent={draftAgent}
          controlWallet={workspace.organization.controlWallet}
          initialTerms={terms}
          onSubmit={handleTerms}
          onBack={() => setScreen("add")}
          loading={loading}
          error={error}
        />
      )}
      {screen === "review" && (
        <ApprovalReview
          agent={reviewAgent}
          terms={reviewTerms}
          permissionHash={reviewPermissionHash}
          action={reauthorizationPending ? "REAUTHORIZE" : "APPROVE"}
          installation={installation}
          pending={pending}
          onApprove={() =>
            void handleApproval(
              reauthorizationPending ? "REAUTHORIZE" : "APPROVE",
            )
          }
          onRejectUpdate={
            reauthorizationPending ? () => void handleRejectUpdate() : undefined
          }
          onBack={() =>
            setScreen(
              workspace.installation?.status === "UPDATE_AVAILABLE"
                ? "update"
                : "authority",
            )
          }
          loading={loading}
          error={error}
        />
      )}
      {screen === "detail" && (
        <AgentDetail
          workspace={workspace}
          executing={executing}
          step={step}
          pending={pending}
          readOnly={readOnly}
          onExecute={(scenario) => void handleExecute(scenario)}
          onUpdate={() => setScreen("update")}
          onRevoke={() => void handleRevoke()}
          onBack={() => setScreen("agents")}
          onNavigate={(next) => {
            setError(undefined);
            setScreen(next);
          }}
          onStartNewRun={startNewRun}
          loading={loading}
          error={error}
        />
      )}
      {screen === "update" && (
        <UpdateReview
          agent={currentAgent}
          currentTerms={
            installation?.companyTerms.companyTerms.authority.rules ?? terms
          }
          diff={installation?.updateDiff}
          onRequest={handlePrepareUpdate}
          onRejectUpdate={() => void handleRejectUpdate()}
          onApprove={() => {
            setError(undefined);
            setScreen("review");
          }}
          onBack={() => setScreen("detail")}
          loading={loading}
          error={error}
        />
      )}
    </AppShell>
  );
}
