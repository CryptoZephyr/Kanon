import type { DocPageContent } from "../../types.js";

const startRun: DocPageContent = {
  id: "start-a-run",
  title: "Start a run",
  description: "Begin a live authority session on the shared demo fixture.",
  blocks: [
    {
      t: "p",
      text: [
        "A run is one pass through the authority lifecycle on the shared hosted demo fixture. The workspace opens at ",
        {
          a: {
            href: "https://kanon-agents.vercel.app",
            label: "kanon-agents.vercel.app",
          },
        },
        " — choose ",
        { code: "Start a live authority run" },
        ".",
      ],
    },
    {
      t: "h2",
      text: "Before you start",
      id: "before",
    },
    {
      t: "list",
      items: [
        [
          "The demo fixture is shared: one session at a time holds the wallet signer and ENS name. If the workspace says a fixture is in use, it shows the remaining wait — usually under 20 minutes.",
        ],
        [
          "Your run is saved in this browser's localStorage. Returning to the site resumes the same run; a different browser sees it as a read-only latest run.",
        ],
        [
          "Cold start: free-tier services sleep when idle. The workspace shows a wake-up banner and retries automatically.",
        ],
      ],
    },
    {
      t: "h2",
      text: "Your run vs. the latest run",
      id: "your-vs-latest",
    },
    {
      t: "p",
      text: [
        "The session banner labels which one you are looking at: ",
        { code: "YOUR RUN — SAVED IN THIS BROWSER" },
        " means the stored session is yours and action buttons work. ",
        { code: "LATEST RUN — SOMEONE ELSE'S (READ ONLY)" },
        " means you are observing another session; action buttons are hidden because they would fail.",
      ],
    },
  ],
};

const registerRelease: DocPageContent = {
  id: "register-release",
  title: "Register a release",
  description: "Publish an agent release — a declaration, not a grant.",
  blocks: [
    {
      t: "p",
      text: [
        "Registering a release publishes the agent's declared capabilities to the lifecycle API. It computes a ",
        { code: "packageHash" },
        " from the package content and a ",
        { code: "manifestHash" },
        " from the canonical manifest. Neither hash grants authority.",
      ],
    },
    {
      t: "h2",
      text: "Fields",
      id: "fields",
    },
    {
      t: "list",
      items: [
        [
          { code: "Agent identifier" },
          " — stable identity, e.g. ",
          { code: "com.example.treasury" },
          ".",
        ],
        [
          { code: "Release identifier" },
          " — stable release record; the UI generates a unique ",
          { code: "release-3wh-YYYYMMDD-xxxxxx" },
          " value.",
        ],
        [
          { code: "Version" },
          " — human-readable version such as ",
          { code: "1.0.0" },
          ".",
        ],
        [{ code: "Runtime entry" }, " — declared runtime entry point."],
        [
          { code: "Package content reference" },
          " — the content the packageHash is derived from.",
        ],
      ],
    },
    {
      t: "callout",
      kind: "note",
      title: "Declaration only",
      text: [
        "The release is a claim of what the agent wants. Nothing is enforceable until company terms are defined and a human approves the normalized record.",
      ],
    },
  ],
};

const defineAuthority: DocPageContent = {
  id: "define-authority",
  title: "Define authority",
  description: "Company terms: the exact boundary granted to the release.",
  blocks: [
    {
      t: "p",
      text: [
        "Company terms are the boundary the company is willing to grant. In the hosted demo there is one native-ETH rule: an exact recipient, a per-action ceiling in wei, and a rolling ceiling with a window in seconds.",
      ],
    },
    {
      t: "h2",
      text: "Hosted demo ceiling",
      id: "demo-ceiling",
    },
    {
      t: "list",
      items: [
        [
          "Recipient is fixed to the organization control wallet ",
          { code: "0x8b88E1E1174eDC65B08de75A5439f130da8A3DFd" },
          ".",
        ],
        ["Per-action and rolling ceilings must be between 1 and 1000 wei."],
        ["A rolling window between 60 and 86400 seconds is required."],
        [
          "No calldata constraints or validity windows are accepted in the demo role.",
        ],
      ],
    },
    {
      t: "callout",
      kind: "warning",
      title: "Fails closed",
      text: [
        "Terms outside this envelope are refused with ",
        { code: "DEMO_TERMS_OUT_OF_BOUNDS" },
        " and the failing field is named in the error message.",
      ],
    },
    {
      t: "p",
      text: [
        "After the terms are accepted, the API normalizes them into a deterministic ",
        { code: "permissionHash" },
        " — the value the human approval binds to.",
      ],
    },
  ],
};

const approveAuthority: DocPageContent = {
  id: "approve-authority",
  title: "Approve authority",
  description:
    "The human decision binds release, hashes and permissionHash; activation configures Privy and ENS.",
  blocks: [
    {
      t: "p",
      text: [
        "The review screen shows the authority in company terms before any approval is recorded. Approving binds the decision to the agent id, release id, package hash, manifest hash and ",
        { code: "permissionHash" },
        ".",
      ],
    },
    {
      t: "h2",
      text: "What activation does",
      id: "activation",
    },
    {
      t: "list",
      ordered: true,
      items: [
        ["The human decision is recorded."],
        [
          "The Privy aggregation and signer-specific policy are created and the delegated signer is attached.",
        ],
        ["The four ENS records are written and read back."],
        [{ code: "ACTIVE" }, " is stored only after both succeed."],
      ],
    },
    {
      t: "callout",
      kind: "note",
      title: "Usually 30–60 seconds",
      text: [
        "Activation talks to Privy and Sepolia. If the browser request ends early, the server keeps working — the workspace switches to watching the installation and reports the real outcome.",
      ],
    },
    {
      t: "h2",
      text: "If a stale session is in the way",
      id: "stale-session",
    },
    {
      t: "p",
      text: [
        "Only one session can hold the shared fixture. If an abandoned session still holds it, approval first expires it through the normal revocation path, which can take up to a couple of minutes. The UI keeps polling through it.",
      ],
    },
  ],
};

const runActions: DocPageContent = {
  id: "run-actions",
  title: "Run actions",
  description: "Allowed and forbidden executions through the isolated runner.",
  blocks: [
    {
      t: "p",
      text: [
        "Once the installation is ",
        { code: "ACTIVE" },
        ", the detail screen offers the two fixed execution scenarios. The API chooses the targets — callers cannot pick them:",
      ],
    },
    {
      t: "table",
      columns: ["Scenario", "What it does", "Expected result"],
      rows: [
        [
          [{ code: "ALLOWED" }],
          ["Sends 1 wei to the approved recipient."],
          ["A confirmed Sepolia transaction with an Etherscan link."],
        ],
        [
          [{ code: "FORBIDDEN" }],
          ["Sends 1 wei to a fixed address outside the policy."],
          [
            "Rejected by the Privy policy (",
            { code: "PRIVY_POLICY_REJECTED_400" },
            "), recorded as evidence.",
          ],
        ],
      ],
    },
    {
      t: "callout",
      kind: "note",
      title: "Rejected by Privy, not the UI",
      text: [
        "The forbidden action is sent to the isolated runner and refused at the signing layer. The rejection is the product working — the policy boundary enforced, not a UI block.",
      ],
    },
    {
      t: "h2",
      text: "Rolling limit",
      id: "rolling-limit",
    },
    {
      t: "p",
      text: [
        "The demo terms cap spending at 1 wei per action and 1 wei per rolling window (default 3600 s). A second allowed action inside the same window is rejected by the rolling aggregation — expected behavior, not a bug.",
      ],
    },
  ],
};

const updateReauthorize: DocPageContent = {
  id: "update-and-reauthorize",
  title: "Update and reauthorize",
  description:
    "A broader release is classified EXPANDED and waits for a fresh human decision.",
  blocks: [
    {
      t: "p",
      text: [
        "Choosing ",
        { code: "Request a broader release" },
        " publishes a new release with a raised ceiling and defines new company terms. Kanon diffs the proposed permission set against the approved record.",
      ],
    },
    {
      t: "h2",
      text: "Classifications",
      id: "classifications",
    },
    {
      t: "table",
      columns: ["Classification", "Meaning", "Human review"],
      rows: [
        [[{ code: "NO_CHANGE" }], ["Identical normalized terms."], ["No"]],
        [[{ code: "NARROWER" }], ["Every bound tighter or equal."], ["No"]],
        [[{ code: "EXPANDED" }], ["Any bound loosened."], ["Yes"]],
        [
          [{ code: "SUBSTITUTED" }],
          ["Recipient, chain or asset changed."],
          ["Yes"],
        ],
        [[{ code: "UNKNOWN" }], ["Cannot be proven either way."], ["Yes"]],
      ],
    },
    {
      t: "p",
      text: [
        "An ",
        { code: "EXPANDED" },
        " update lists the changed paths and requires human review. Approving it binds a new decision to the new permissionHash and moves the installation to generation +1 — Privy is updated first, ENS after Privy confirms.",
      ],
    },
    {
      t: "callout",
      kind: "boundary",
      title: "No silent widening",
      text: [
        "Rejecting the update returns the installation to ",
        { code: "ACTIVE" },
        " with the original authority untouched — generation does not advance.",
      ],
    },
  ],
};

const revoke: DocPageContent = {
  id: "revoke",
  title: "Revoke",
  description:
    "Remove the delegated signer, write ENS revoked, prove later actions fail.",
  blocks: [
    {
      t: "callout",
      kind: "warning",
      title: "Irreversible",
      text: [
        "Revocation removes the agent's delegated signer from the Privy wallet, sets the ENS status record to ",
        { code: "revoked" },
        ", and makes every later action fail. The workspace asks for an explicit confirmation first.",
      ],
    },
    {
      t: "h2",
      text: "Order matters",
      id: "order",
    },
    {
      t: "list",
      ordered: true,
      items: [
        [
          "The owner removes the delegated signer and the API confirms zero signers on the wallet.",
        ],
        ["A post-revoke delegated request is attempted and must fail."],
        [
          "Only then is the ENS ",
          { code: "kanon.status" },
          " record set to ",
          { code: "revoked" },
          ".",
        ],
      ],
    },
    {
      t: "p",
      text: [
        "Writing ENS last keeps the evidence honest: the revoked status is published after authority is actually gone, never before. The operation typically takes 30–90 seconds because it waits for a Sepolia transaction receipt.",
      ],
    },
    {
      t: "h2",
      text: "Session expiry uses the same path",
      id: "expiry",
    },
    {
      t: "p",
      text: [
        "An idle demo session (20 minutes) is expired through the normal revocation path and recorded with ",
        { code: "decidedBy: demo-operator-session-expiry-policy" },
        ". A stale record that can no longer be revoked normally is retired only after Privy reports zero delegated signers — never claimed as revoked.",
      ],
    },
  ],
};

const reviewEvidence: DocPageContent = {
  id: "review-evidence",
  title: "Review evidence",
  description: "Where the proof of each lifecycle step lives.",
  blocks: [
    {
      t: "p",
      text: [
        "Every step of a run leaves records you can re-check: the installation state machine, execution evidence entries, and on-chain ENS records.",
      ],
    },
    {
      t: "table",
      columns: ["Evidence", "Where", "What it proves"],
      rows: [
        [
          ["Allowed transaction"],
          ["Sepolia, linked from the detail view"],
          ["The approved action executed inside the policy."],
        ],
        [
          [{ code: "PRIVY_POLICY_REJECTED_400" }],
          ["Execution evidence"],
          ["The out-of-policy action was refused at the signing layer."],
        ],
        [
          ["Generation 0 → 1 → 2"],
          ["Installation resource"],
          [
            "Initial grant, reauthorization, and revocation each advanced the generation.",
          ],
        ],
        [
          [{ code: "kanon.status" }, " = ", { code: "revoked" }],
          ["ENS record on the Permissioned Resolver"],
          [
            "Approved state was publicly updated only after authority was removed.",
          ],
        ],
        [
          [{ code: "RUNNER_REFUSED_STALE_OR_REVOKED" }],
          ["Post-revoke execution evidence"],
          [
            "The runner refuses stale or revoked authority before it would sign.",
          ],
        ],
      ],
    },
    {
      t: "p",
      text: [
        "The ",
        { code: "Run complete" },
        " panel collects every reference: installation id, permission hashes, the transaction link, the ENS name and resolver, rejection codes and generations.",
      ],
    },
  ],
};

const recovery: DocPageContent = {
  id: "recovery",
  title: "Recovery",
  description:
    "What happens when the browser or the backend drops mid-operation.",
  blocks: [
    {
      t: "p",
      text: [
        "Operations in Kanon are safe to abandon. The server keeps working after the browser gives up, and the UI is built to rejoin the real state rather than guess.",
      ],
    },
    {
      t: "h2",
      text: "Browser timeout during a long operation",
      id: "browser-timeout",
    },
    {
      t: "p",
      text: [
        "Approval, revocation and execution can outlive a browser request — especially on a cold-started backend. When that happens the workspace switches to watching the installation and shows poll progress until a terminal state or new evidence appears. Nothing is claimed that the API did not record.",
      ],
    },
    {
      t: "h2",
      text: "Closing the tab mid-run",
      id: "close-tab",
    },
    {
      t: "p",
      text: [
        "Your installation id is stored in this browser. Reopening the site reloads the same run; if it was mid-activation, mid-reauthorization or mid-revocation, polling resumes automatically. If you wait longer than the 20-minute lease, the session expires through real revocation.",
      ],
    },
    {
      t: "h2",
      text: "Stale or inconsistent state",
      id: "stale",
    },
    {
      t: "p",
      text: [
        "Rows whose delegated authority was already removed off-band are retired only after the API verifies the wallet has zero signers — reported as ",
        { code: "Retired by session expiry" },
        ", never presented as a completed revocation.",
      ],
    },
    {
      t: "callout",
      kind: "boundary",
      title: "Fail closed",
      text: [
        "Ambiguous, stale, unsupported or unverifiable authority never produces a usable state. If the workspace cannot confirm a step, it says so and offers a retry.",
      ],
    },
  ],
};

export const usingKanonPages: readonly DocPageContent[] = [
  startRun,
  registerRelease,
  defineAuthority,
  approveAuthority,
  runActions,
  updateReauthorize,
  revoke,
  reviewEvidence,
  recovery,
];
