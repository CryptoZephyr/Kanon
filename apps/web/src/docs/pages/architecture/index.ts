import type { DocPageContent } from "../../types.js";

const authorityModel: DocPageContent = {
  id: "authority-model",
  title: "Authority model",
  description:
    "Privy is the enforcement plane; ENSv2 is the identity plane. They are deliberately separate.",
  blocks: [
    {
      t: "p",
      text: [
        "Kanon separates four things that are usually mixed together: wallet ownership, delegated agent authority, application state and autonomous execution. No long-running agent process holds the organization's owner authority.",
      ],
    },
    {
      t: "h2",
      text: "Two planes",
      id: "two-planes",
    },
    {
      t: "table",
      columns: ["Plane", "Component", "Role"],
      rows: [
        [
          ["Enforcement"],
          ["Privy server wallet, signer-specific policy, delegated signer"],
          [
            "Decides whether each transaction is allowed — the financial boundary.",
          ],
        ],
        [
          ["Identity"],
          ["ENSv2 on Sepolia: namespace, user registry, Permissioned Resolver"],
          [
            "Publishes agentId, release, permissionHash and status — evidence, not enforcement.",
          ],
        ],
      ],
    },
    {
      t: "callout",
      kind: "boundary",
      title: "Ordering rule",
      text: [
        "ENS writes happen only after the matching Privy change succeeds and is read back. Identity can never claim authority that enforcement does not already have.",
      ],
    },
    {
      t: "h2",
      text: "Components",
      id: "components",
    },
    {
      t: "table",
      columns: ["Component", "Path", "Responsibility"],
      rows: [
        [
          ["Manifest"],
          [{ code: "packages/manifest" }],
          [
            "Parses a release, canonicalizes it, derives packageHash and manifestHash.",
          ],
        ],
        [
          ["Permissions"],
          [{ code: "packages/permissions" }],
          [
            "Normalizes company terms, computes permissionHash, classifies release changes.",
          ],
        ],
        [
          ["Privy adapter"],
          [{ code: "packages/privy" }],
          [
            "Compiles terms into a Privy policy for one explicit execution method; manages aggregations and the delegated signer.",
          ],
        ],
        [
          ["ENS adapter"],
          [{ code: "packages/ens" }],
          [
            "Binds the agent name, writes and reads the four protected records, refuses writes that would overstate authority.",
          ],
        ],
        [
          ["Shared"],
          [{ code: "packages/shared" }],
          [
            "Installation state machine, human decisions, evidence types, API contracts, database.",
          ],
        ],
        [
          ["API"],
          [{ code: "apps/api" }],
          [
            "HTTP lifecycle, role checks, demo guard, session lease, asynchronous authority configuration.",
          ],
        ],
        [
          ["Runner"],
          [{ code: "apps/runner" }],
          [
            "Delegated execution only; refuses stale, revoked or mismatched authority.",
          ],
        ],
        [
          ["Proxy"],
          [{ code: "api/kanon-proxy.ts" }],
          [
            "Public entry point; injects the restricted demo credential and enforces a route allowlist.",
          ],
        ],
      ],
    },
  ],
};

const authorization: DocPageContent = {
  id: "authorization",
  title: "Authorization",
  description:
    "Human decisions bind exact releases; operator and demo roles are separate.",
  blocks: [
    {
      t: "p",
      text: [
        "Authority begins with a human decision, never with a release declaration. The decision record binds ",
        { code: "agentId" },
        ", ",
        { code: "releaseId" },
        ", ",
        { code: "packageHash" },
        ", ",
        { code: "manifestHash" },
        " and ",
        { code: "permissionHash" },
        " together — approving a different combination is a different decision.",
      ],
    },
    {
      t: "h2",
      text: "Roles",
      id: "roles",
    },
    {
      t: "table",
      columns: ["Role", "Credential", "Can do"],
      rows: [
        [
          ["Operator"],
          [
            { code: "x-kanon-company-token" },
            " (never sent by the public proxy)",
          ],
          ["Full lifecycle including the operator proof run."],
        ],
        [
          ["Demo"],
          [
            { code: "x-kanon-demo-token" },
            " (injected server-side by the Vercel proxy)",
          ],
          [
            "Read, publish releases, define terms, approve, reauthorize, reject updates, revoke, and the two fixed execution scenarios — nothing else.",
          ],
        ],
      ],
    },
    {
      t: "callout",
      kind: "note",
      title: "Header hygiene",
      text: [
        "Visitor-supplied ",
        { code: "x-kanon-company-token" },
        ", demo-token and runner-secret headers are stripped at the proxy, so a caller cannot upgrade their role.",
      ],
    },
  ],
};

const lifecycle: DocPageContent = {
  id: "installation-lifecycle",
  title: "Installation lifecycle",
  description:
    "The state machine every installation moves through, and the rules for each transition.",
  blocks: [
    { t: "h2", text: "States", id: "states" },
    {
      t: "flow",
      steps: [
        "VALIDATED → AWAITING_APPROVAL → CONFIGURING_AUTHORITY → ACTIVE",
        "ACTIVE → UPDATE_AVAILABLE → AWAITING_REAUTHORIZATION → ACTIVE (generation +1)",
        "UPDATE_AVAILABLE → ACTIVE (human rejects the broader release)",
        "ACTIVE → REVOKING → REVOKED",
      ],
    },
    {
      t: "h2",
      text: "Activation",
      id: "activation",
    },
    {
      t: "p",
      text: [
        "After the human approval is recorded, the API creates the Privy aggregation and policy, attaches the delegated signer, then writes the ENS records and reads them back. ",
        { code: "ACTIVE" },
        " is stored only after both succeed. If any step fails, the API rolls back to the previous Privy policy and ENS state.",
      ],
    },
    {
      t: "h2",
      text: "Update",
      id: "update",
    },
    {
      t: "p",
      text: [
        "A new release plus company terms is normalized and diffed against the active record. ",
        { code: "EXPANDED" },
        ", ",
        { code: "SUBSTITUTED" },
        " and ",
        { code: "UNKNOWN" },
        " require a new human decision bound to the new permissionHash. On approval, Privy changes first; ENS changes after Privy confirms.",
      ],
    },
    {
      t: "h2",
      text: "Revocation and retirement",
      id: "revocation",
    },
    {
      t: "p",
      text: [
        "The owner removes the delegated signer, the API confirms zero signers, checks that the runner refuses the old authority, then writes ",
        { code: "kanon.status = revoked" },
        ". The ENS name is kept for history. A row that cannot be revoked normally (for example, authority removed off-band) is retired through ",
        { code: "authority_retired" },
        " — it becomes REVOKED only after Privy reports zero signers, and records a retirement note rather than a fabricated revocation proof.",
      ],
    },
  ],
};

const runner: DocPageContent = {
  id: "runner",
  title: "Runner",
  description:
    "The isolated execution service holds only the delegated signer key.",
  blocks: [
    {
      t: "p",
      text: [
        "The runner is a separate service that holds only the agent's delegated signer key. It never holds the owner credential, the ENS writer key, or the company API token — and it never falls back to owner signing.",
      ],
    },
    {
      t: "h2",
      text: "Pre-execution checks",
      id: "pre-execution",
    },
    {
      t: "p",
      text: [
        "Before invoking the delegated executor, the runner re-reads the installation and refuses:",
      ],
    },
    {
      t: "list",
      items: [
        ["a non-ACTIVE status;"],
        ["a revoked or missing delegated signer;"],
        ["a stale generation;"],
        ["a changed wallet, signer or policy identity;"],
        ["a changed permissionHash;"],
        ["a changed execution method;"],
        ["an unverified ENS state."],
      ],
    },
    {
      t: "callout",
      kind: "note",
      title: "Refusal is evidence",
      text: [
        "A post-revocation attempt returns ",
        { code: "RUNNER_REFUSED_STALE_OR_REVOKED" },
        " and is recorded as evidence — the final proof that revocation actually removed authority.",
      ],
    },
  ],
};

const verification: DocPageContent = {
  id: "verification",
  title: "Verification",
  description: "How Kanon proves each claim instead of asserting it.",
  blocks: [
    {
      t: "p",
      text: [
        "Kanon treats claims as worthless without matching external state. Activation requires a matching Privy policy and a verified ENS readback. Revocation requires zero delegated signers, a failed post-revoke request and the revoked ENS record. Evidence is recorded as non-secret JSON under ",
        { code: "evidence/" },
        ".",
      ],
    },
    {
      t: "h2",
      text: "Live verification",
      id: "live",
    },
    {
      t: "p",
      text: ["The public deployment can be re-verified without credentials:"],
    },
    { t: "code", text: "pnpm smoke:live", label: "Terminal", copy: true },
    {
      t: "p",
      text: [
        "The smoke flow runs all twelve lifecycle steps against production and writes ",
        { code: "evidence/3rd-web-hack/live-judge-flow-latest.json" },
        ".",
      ],
    },
    {
      t: "h2",
      text: "Local verification",
      id: "local",
    },
    {
      t: "code",
      text: "pnpm install --frozen-lockfile\npnpm typecheck\npnpm test\npnpm lint\npnpm format:check\npnpm build:web",
      label: "Terminal",
      copy: true,
    },
    {
      t: "p",
      text: [
        "None of these need provider credentials. The suite covers manifest hashing, permission normalization and diffing, the method-aware policy compiler, ENS identity binding, lifecycle transitions, the isolated runner, API contracts, the demo guard, the session lease and the proxy policy.",
      ],
    },
  ],
};

export const architecturePages: readonly DocPageContent[] = [
  authorityModel,
  authorization,
  lifecycle,
  runner,
  verification,
];
