import type { DocPageContent } from "../../types.js";

const trustModel: DocPageContent = {
  id: "trust-model",
  title: "Trust model",
  description: "Who holds which credential, and what each compromise exposes.",
  blocks: [
    {
      t: "p",
      text: [
        "Kanon's core promise is enforced with three separate credentials, each held by a different component.",
      ],
    },
    {
      t: "h2",
      text: "Credentials",
      id: "credentials",
    },
    {
      t: "table",
      columns: ["Credential", "Held by", "Controls"],
      rows: [
        [
          ["Privy owner credentials"],
          ["Company operator / API environment"],
          ["Wallet ownership and quorum."],
        ],
        [
          ["Delegated signer key"],
          ["Runner environment"],
          ["Agent execution inside the approved policy."],
        ],
        [
          ["ENS writer key"],
          ["API environment"],
          ["Namespace writes and permissioned resolver records."],
        ],
        [
          ["Demo token"],
          ["Vercel proxy (sends it) and API (verifies it)"],
          ["Hosted-demo role; injected server-side."],
        ],
        [
          ["Privy app secret"],
          ["API and runner"],
          ["Authenticates calls to Privy's API."],
        ],
      ],
    },
    {
      t: "callout",
      kind: "boundary",
      title: "Separation",
      text: [
        "The runner never holds owner credentials, the ENS writer key or the company token, and never falls back to owner signing. The browser never holds any credential.",
      ],
    },
    {
      t: "h2",
      text: "Where secrets live",
      id: "secrets",
    },
    {
      t: "p",
      text: [
        "Provider credentials exist only in Render environment variables (API, runner) and Vercel environment variables (proxy). They are never committed to the repository and never included in evidence files — ",
        { code: "evidence/**" },
        " records ids, hashes and statuses only.",
      ],
    },
  ],
};

const boundaries: DocPageContent = {
  id: "authorization-boundaries",
  title: "Authorization boundaries",
  description:
    "The exact separation between declaring, granting and recording.",
  blocks: [
    {
      t: "p",
      text: [
        "The strongest guarantee in the system is that a release declaration can never become authority on its own. Three boundaries are enforced:",
      ],
    },
    {
      t: "list",
      ordered: true,
      items: [
        [
          { code: "Declared ≠ granted" },
          " — a release only asks; the human decision binds an exact release, package hash, manifest hash and permissionHash.",
        ],
        [
          { code: "Approved ≠ inherited" },
          " — a wider update stops at a fresh human decision (EXPANDED/SUBSTITUTED/UNKNOWN all require review).",
        ],
        [
          { code: "Published ≠ enforced" },
          " — ENS records the approved state; Privy enforces it. ENS writes follow the matching Privy change.",
        ],
      ],
    },
    {
      t: "callout",
      kind: "boundary",
      title: "Fail closed",
      text: [
        "Ambiguous, stale, unsupported or unverifiable authority produces a refusal, not a guess. Requests asking for anything outside the supported grammar are rejected before any policy exists.",
      ],
    },
  ],
};

const replayProtection: DocPageContent = {
  id: "replay-protection",
  title: "Replay protection",
  description:
    "The mechanisms that prevent old approvals and stale authority from being replayed.",
  blocks: [
    {
      t: "p",
      text: [
        "Several mechanisms work together — each is real code behavior, not a design claim:",
      ],
    },
    {
      t: "list",
      items: [
        [
          { code: "Decision binding" },
          " — an approval binds agentId, releaseId, packageHash, manifestHash and permissionHash. A different combination needs a different human decision.",
        ],
        [
          { code: "Generations" },
          " — each grant advances the generation (grant 0, reauthorization 1, revocation 2). The runner refuses stale generations before executing.",
        ],
        [
          { code: "Provider idempotency" },
          " — Privy policy creation and delegated signing requests are sent with a fresh idempotency key (packages/privy control-plane, runner), so a retried provider call is not applied twice.",
        ],
        [
          { code: "Status checks" },
          " — approval and revoke decisions are rejected with 409 CONFLICT when the installation is not in the expected status, so replaying an old decision against a later state fails.",
        ],
        [
          { code: "Runner staleness checks" },
          " — non-ACTIVE status, missing/revoked signer, changed wallet/signer/policy identity, changed permissionHash or execution method, or unverified ENS state all return ",
          { code: "RUNNER_REFUSED_STALE_OR_REVOKED" },
          ".",
        ],
      ],
    },
  ],
};

const recovery: DocPageContent = {
  id: "recovery",
  title: "Recovery",
  description:
    "Rollback on failed configuration, session expiry and retirement.",
  blocks: [
    {
      t: "h2",
      text: "Failed activation rolls back",
      id: "rollback",
    },
    {
      t: "p",
      text: [
        "If Privy configuration or the ENS write fails during activation, the API restores the previous Privy policy state and previous ENS records, then reports the failure. The installation does not stay in a half-configured state presented as live.",
      ],
    },
    {
      t: "h2",
      text: "Session expiry",
      id: "session-expiry",
    },
    {
      t: "p",
      text: [
        "Demo sessions expire after 20 minutes of inactivity, through the real revocation path — signer removal, post-revoke attempt, ENS ",
        { code: "revoked" },
        " write. The evidence record marks the decision with ",
        { code: "demo-operator-session-expiry-policy" },
        " so an expiry is never misread as a judge revocation.",
      ],
    },
    {
      t: "h2",
      text: "Retirement",
      id: "retirement",
    },
    {
      t: "p",
      text: [
        "A row that can no longer go through normal revocation — for example, a session stuck mid-configuration, or one whose normal revocation fails because on-chain state no longer matches the record — is retired only after the API verifies the wallet has zero delegated signers. It is then recorded as retired, not as a revoked installation with proof it never produced.",
      ],
    },
  ],
};

const demoControls: DocPageContent = {
  id: "public-demo-controls",
  title: "Public demo controls",
  description: "Every limit that keeps the open demo safe.",
  blocks: [
    {
      t: "p",
      text: [
        "The hosted demo is public — anyone can visit it. These controls keep it safe without weakening the real lifecycle:",
      ],
    },
    {
      t: "list",
      items: [
        [
          "Proxy allowlist — the Vercel proxy forwards only reads (including the read-only proof records), release publishing, company terms, approval and reauthorization, reject-update, executions and revoke; everything else returns 403 before reaching the API.",
        ],
        [
          "Secret-header stripping — visitor-supplied company tokens, demo tokens and runner secrets are removed before forwarding.",
        ],
        [
          "Demo role — the proxy injects the demo credential; operator tokens never cross the public boundary.",
        ],
        [
          "Bounded terms — recipient fixed to the control wallet, ceilings capped at 1–1000 wei, window 60–86400 s, calldata/validity constraints refused.",
        ],
        [
          "Session lease — one shared fixture, 20-minute TTL, expired through real revocation.",
        ],
        [
          "Rate limits — in-memory limits per client IP and globally on mutations and executions; they reset when the API restarts.",
        ],
        [
          "Shared state — the database stores installation records and evidence only — no provider credentials.",
        ],
      ],
    },
    {
      t: "callout",
      kind: "warning",
      title: "One operator credential, one boundary",
      text: [
        "The operator token exists only in the API service's Render environment. It is not configured on Vercel, and the proxy strips any visitor-supplied copy.",
      ],
    },
  ],
};

const privacy: DocPageContent = {
  id: "privacy",
  title: "Privacy",
  description: "What is public on ENS/Sepolia versus what stays private.",
  blocks: [
    {
      t: "h2",
      text: "Public",
      id: "public",
    },
    {
      t: "list",
      items: [
        [
          "The ENS names: ",
          { code: "kanon-ethonline-2026.eth" },
          ", ",
          { code: "agents.kanon-ethonline-2026.eth" },
          ", ",
          { code: "representative-agent.agents.kanon-ethonline-2026.eth" },
          ".",
        ],
        [
          "The four records: ",
          { code: "kanon.agentId" },
          ", ",
          { code: "kanon.release" },
          ", ",
          { code: "kanon.permissionHash" },
          ", ",
          { code: "kanon.status" },
          ".",
        ],
        ["Every Sepolia transaction and the two wallet addresses."],
        [
          "The permission hashes in evidence files — deterministic and non-secret.",
        ],
      ],
    },
    {
      t: "h2",
      text: "Private",
      id: "private",
    },
    {
      t: "list",
      items: [
        [
          "All provider credentials (Privy owner/secret, ENS writer key, runner signer key, API tokens, database URL).",
        ],
        ["The delegated signer private key — held by the runner only."],
        ["Local .env files (untracked and ignored)."],
      ],
    },
    {
      t: "callout",
      kind: "note",
      title: "Evidence is non-secret",
      text: [
        "The ",
        { code: "evidence/3rd-web-hack/" },
        " records contain only ids, public addresses, transaction hashes and statuses — enough to re-verify on-chain, nothing usable as a credential.",
      ],
    },
  ],
};

export const securityPages: readonly DocPageContent[] = [
  trustModel,
  boundaries,
  replayProtection,
  recovery,
  demoControls,
  privacy,
];
