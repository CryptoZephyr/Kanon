import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KanonApi,
  KanonApiError,
  type AgentResource,
  type CompanyRule,
  type InstallationResource,
  type OrganizationResource,
  type ProofResponse,
  type WalletResource,
} from "./api.js";

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
  releaseId: "release-t12-expanded-ethonline-2026",
  releaseVersion: "2.0.0",
  packageHash:
    "sha256:8c434023dbc035910b8d3a052b558eb4bc347dbead8087072c54227ee4bba34d",
  manifestHash:
    "sha256:c0abd1fd16081cb090dce81b095c44b900b7bbb3f30e75420af199ad5ec93016",
  manifest: {
    schema: "kanon.agent",
    agent: {
      id: REPRESENTATIVE_AGENT_ID,
      releaseId: "release-t12-expanded-ethonline-2026",
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
}

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

function formatStatus(status: string | undefined): string {
  return status ? status.toLowerCase().replaceAll("_", " ") : "not connected";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof KanonApiError) {
    if (error.code === "NOT_FOUND")
      return "This resource is not available in the deployed API yet.";
    if (error.code === "UNAUTHORIZED")
      return "The company session is not authorized for this action.";
    return error.message;
  }
  return error instanceof Error
    ? error.message
    : "The request could not be completed.";
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
          COMPANY AUTHORITY / SEPOLIA PROOF
        </div>
        <div className="hero-copy">
          <MetaLabel>Financial control for deployed agents</MetaLabel>
          <h1 id="landing-title">The company decides. The agent operates.</h1>
          <p className="hero-lede">
            Kanon binds a human-approved authority to an agent release, a Privy
            policy, and a company-controlled ENS identity.
          </p>
          <div className="hero-actions">
            <Button onClick={onEnter}>Enter the workspace</Button>
            <a className="text-link text-link-large" href="#control">
              See the control surface <span aria-hidden="true">↘</span>
            </a>
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
        <span className="mono">ETHEREUM SEPOLIA / 11155111</span>
      </footer>
    </main>
  );
}

function AppShell({
  screen,
  workspace,
  onNavigate,
  onHome,
  children,
}: {
  readonly screen: Screen;
  readonly workspace: Workspace;
  readonly onNavigate: (screen: Screen) => void;
  readonly onHome: () => void;
  readonly children: React.ReactNode;
}) {
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
        </nav>
        <div className="app-status">
          <span
            className={
              workspace.connected ? "status-mark is-live" : "status-mark"
            }
          />
          {workspace.connected ? "API connected" : "API pending"}
          <span className="mono">SEPOLIA</span>
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
      <main className="app-main page-grid">{children}</main>
    </div>
  );
}

function Registry({
  workspace,
  onAdd,
  onOpen,
}: {
  readonly workspace: Workspace;
  readonly onAdd: () => void;
  readonly onOpen: () => void;
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
        <Button onClick={onAdd}>
          Add an agent <span aria-hidden="true">↗</span>
        </Button>
      </div>
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
              <strong>{formatStatus(status)}</strong>
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
              {workspace.proof?.proof
                ? "T11-T13 evidence available"
                : "Awaiting first read"}
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
        </aside>
      </div>
      <div className="screen-footnote">
        <span className="mono">
          {workspace.connected
            ? "NORMAL RESOLUTION AVAILABLE"
            : "CONNECTING TO API"}
        </span>
        <span>Technical identifiers stay secondary to the decision state.</span>
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
  readonly error?: string;
}) {
  const [agentId, setAgentId] = useState(REPRESENTATIVE_AGENT_ID);
  const [releaseId, setReleaseId] = useState("release-web-1");
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
  initialTerms,
  onSubmit,
  onBack,
  loading,
  error,
}: {
  readonly agent: AgentResource;
  readonly initialTerms: CompanyRule[];
  readonly onSubmit: (terms: CompanyRule[]) => void;
  readonly onBack: () => void;
  readonly loading: boolean;
  readonly error?: string;
}) {
  const [recipient, setRecipient] = useState(
    initialTerms[0]?.recipient ?? DEFAULT_RECIPIENT,
  );
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
          <Field label="Recipient" hint="Exact EVM recipient">
            <input
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              required
              pattern="0x[0-9a-fA-F]{40}"
            />
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
  onApprove,
  onBack,
  loading,
  error,
}: {
  readonly agent: AgentResource;
  readonly terms: CompanyRule[];
  readonly permissionHash?: string;
  readonly action: "APPROVE" | "REAUTHORIZE";
  readonly onApprove: () => void;
  readonly onBack: () => void;
  readonly loading: boolean;
  readonly error?: string;
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
      {error && <InlineError message={error} />}
      <div className="review-actions">
        <Button kind="secondary" onClick={onBack}>
          Keep editing
        </Button>
        <Button onClick={onApprove} disabled={loading}>
          {loading
            ? "Recording decision..."
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
  onUpdate,
  onRevoke,
  onBack,
  loading,
  error,
}: {
  readonly workspace: Workspace;
  readonly onUpdate: () => void;
  readonly onRevoke: () => void;
  readonly onBack: () => void;
  readonly loading: boolean;
  readonly error?: string;
}) {
  const installation = workspace.installation;
  const agent = installation?.agent ?? workspace.agent;
  const terms = installation?.companyTerms.companyTerms.authority.rules[0];
  const status = installation?.status ?? "VALIDATED";
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
      <div className="detail-layout">
        <section className="detail-main">
          <div className="detail-identity">
            <div>
              <MetaLabel>ENS identity</MetaLabel>
              <strong>
                {installation?.activeAuthority?.ens.binding.agentName ??
                  "Identity pending"}
              </strong>
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
          <div className="detail-actions">
            <Button
              onClick={onUpdate}
              disabled={!installation || status !== "ACTIVE"}
            >
              Review release update
            </Button>
            <Button
              kind="danger"
              onClick={onRevoke}
              disabled={!installation || status !== "ACTIVE" || loading}
            >
              {loading ? "Revoking..." : "Revoke authority"}
            </Button>
          </div>
          {error && <InlineError message={error} />}
        </section>
        <aside className="detail-rail">
          <MetaLabel>Evidence</MetaLabel>
          <div className="evidence-item">
            <span>Privy method</span>
            <strong className="mono">
              {installation?.activeAuthority?.privy.executionMethod ??
                "Pending"}
            </strong>
          </div>
          <div className="evidence-item">
            <span>Policy</span>
            <strong className="mono">
              {displayHash(installation?.activeAuthority?.privy.policyId)}
            </strong>
          </div>
          <div className="evidence-item">
            <span>ENS resolver</span>
            <strong className="mono">
              {displayAddress(
                installation?.activeAuthority?.ens.resolver ?? "",
              )}
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
  onBack,
  loading,
  error,
}: {
  readonly agent: AgentResource;
  readonly currentTerms: CompanyRule[];
  readonly diff?: InstallationResource["updateDiff"];
  readonly onRequest: (draft: DraftRelease, terms: CompanyRule[]) => void;
  readonly onBack: () => void;
  readonly loading: boolean;
  readonly error?: string;
}) {
  const [version, setVersion] = useState(
    `${Number.parseFloat(agent.releaseVersion) + 1 || "2.0.0"}`,
  );
  const [releaseId, setReleaseId] = useState(`${agent.releaseId}-next`);
  const [maxValueWei, setMaxValueWei] = useState("2");
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

function InlineError({ message }: { readonly message: string }) {
  return (
    <div className="inline-error" role="alert">
      <span className="note-mark">!</span>
      <span>{message}</span>
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
  });
  const [draftRelease, setDraftRelease] = useState<DraftRelease>();
  const [draftAgent, setDraftAgent] = useState<AgentResource>(FALLBACK_AGENT);
  const [terms, setTerms] = useState<CompanyRule[]>(DEFAULT_TERMS);
  const [permissionHash, setPermissionHash] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const refreshWorkspace = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [health, proof] = await Promise.all([
        api.health(),
        api.proofLatest().catch(() => undefined),
      ]);
      const [organization, wallet] = await Promise.all([
        api.organization(ORGANIZATION_ID).catch(() => FALLBACK_ORGANIZATION),
        api.wallet(ORGANIZATION_ID).catch(() => FALLBACK_WALLET),
      ]);
      const installation = await api
        .installation(ORGANIZATION_ID, INSTALLATION_ID)
        .catch(() => undefined);
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
        connected: health.status === "ok",
        source: installation ? "api" : proof ? "proof" : "fixture",
      });
      if (installation?.companyTerms.companyTerms.authority.rules.length) {
        setTerms([...installation.companyTerms.companyTerms.authority.rules]);
        setPermissionHash(installation.companyTerms.permissionHash);
      }
    } catch (caught) {
      setWorkspace((current) => ({
        ...current,
        connected: false,
        source: "fixture",
      }));
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void refreshWorkspace();
  }, [refreshWorkspace]);

  const handlePublish = async (draft: DraftRelease) => {
    setLoading(true);
    setError(undefined);
    setDraftRelease(draft);
    try {
      const agent = await api.publishRelease(
        ORGANIZATION_ID,
        draft.agentId,
        draft as unknown as Record<string, unknown>,
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
      setWorkspace((current) => ({
        ...current,
        agent: installation.agent,
        installation,
        source: "api",
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
      const next = await api.approval(
        ORGANIZATION_ID,
        nextInstallationId,
        decision,
      );
      setWorkspace((current) => ({
        ...current,
        agent: next.agent,
        installation: next,
        source: "api",
      }));
      if (next.companyTerms.permissionHash)
        setPermissionHash(next.companyTerms.permissionHash);
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
      const agent = await api.publishRelease(
        ORGANIZATION_ID,
        draft.agentId,
        draft as unknown as Record<string, unknown>,
      );
      setDraftAgent(agent);
      const installation = workspace.installation;
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
      setScreen("review");
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
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  if (screen === "landing")
    return <LandingPage onEnter={() => setScreen("agents")} />;
  const installation = workspace.installation;
  const currentAgent = installation?.agent ?? draftAgent ?? workspace.agent;
  return (
    <AppShell
      screen={screen}
      workspace={workspace}
      onNavigate={(next) => {
        setError(undefined);
        setScreen(next);
      }}
      onHome={() => setScreen("landing")}
    >
      {screen === "agents" && (
        <Registry
          workspace={workspace}
          onAdd={() => {
            setError(undefined);
            setScreen("add");
          }}
          onOpen={() => {
            setError(undefined);
            setScreen("detail");
          }}
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
          initialTerms={terms}
          onSubmit={handleTerms}
          onBack={() => setScreen("add")}
          loading={loading}
          error={error}
        />
      )}
      {screen === "review" && (
        <ApprovalReview
          agent={currentAgent}
          terms={terms}
          permissionHash={permissionHash}
          action={
            workspace.installation?.status === "AWAITING_REAUTHORIZATION" ||
            workspace.installation?.status === "UPDATE_AVAILABLE"
              ? "REAUTHORIZE"
              : "APPROVE"
          }
          onApprove={() =>
            void handleApproval(
              workspace.installation?.status === "AWAITING_REAUTHORIZATION" ||
                workspace.installation?.status === "UPDATE_AVAILABLE"
                ? "REAUTHORIZE"
                : "APPROVE",
            )
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
          onUpdate={() => setScreen("update")}
          onRevoke={() => void handleRevoke()}
          onBack={() => setScreen("agents")}
          loading={loading}
          error={error}
        />
      )}
      {screen === "update" && (
        <UpdateReview
          agent={currentAgent}
          currentTerms={terms}
          diff={installation?.updateDiff}
          onRequest={handlePrepareUpdate}
          onBack={() => setScreen("detail")}
          loading={loading}
          error={error}
        />
      )}
    </AppShell>
  );
}
