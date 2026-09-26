import type { DocPageContent } from "../../types.js";

const liveDeployment: DocPageContent = {
  id: "live-deployment",
  title: "Live deployment",
  description: "The public endpoints and what their responses prove.",
  blocks: [
    {
      t: "p",
      text: [
        "The hosted demo is live at ",
        {
          a: {
            href: "https://kanon-agents.vercel.app",
            label: "kanon-agents.vercel.app",
          },
        },
        ". Its status endpoint reports the whole stack:",
      ],
    },
    {
      t: "code",
      label: "GET https://kanon-agents.vercel.app/api/v1/status",
      text: `{
  "schema": "kanon.api.status",
  "version": 1,
  "release": "kanon-3rd-web-hack-2026.09",
  "api": "ok",
  "database": "ok",
  "runner": "ok"
}`,
      copy: true,
    },
    {
      t: "h2",
      text: "What this proves",
      id: "proves",
    },
    {
      t: "list",
      items: [
        [
          "The proxy, lifecycle API, database and runner are reachable and configured.",
        ],
        ["The deployed release label matches this repository."],
      ],
    },
    {
      t: "h2",
      text: "What it cannot prove",
      id: "cannot-prove",
    },
    {
      t: "list",
      items: [
        [
          "That any specific transaction enforced policy — that requires the evidence records and on-chain transactions.",
        ],
        [
          "That authority was revoked for a given session — check the ENS records and the revocation evidence.",
        ],
      ],
    },
    {
      t: "h2",
      text: "Service health",
      id: "health",
    },
    {
      t: "table",
      columns: ["Endpoint", "What it returns"],
      rows: [
        [
          [
            {
              a: {
                href: "https://kanon-api.onrender.com/healthz",
                label: "kanon-api.onrender.com/healthz",
              },
            },
          ],
          ["API release label and database connectivity."],
        ],
        [
          [
            {
              a: {
                href: "https://kanon-runner.onrender.com/healthz",
                label: "kanon-runner.onrender.com/healthz",
              },
            },
          ],
          ["Runner release label and database connectivity."],
        ],
      ],
    },
  ],
};

const verifiedTransactions: DocPageContent = {
  id: "verified-transactions",
  title: "Verified transactions",
  description: "On-chain references from live runs, verifiable on Sepolia.",
  blocks: [
    {
      t: "p",
      text: [
        "The latest recorded run allowed exactly one transaction, sent 1 wei to the approved recipient inside the Privy policy:",
      ],
    },
    {
      t: "kv",
      rows: [
        [
          "Transaction",
          [
            {
              a: {
                href: "https://sepolia.etherscan.io/tx/0xbe5c6790327da30346629ac032c3f2fe3e324f9f91682a9b8a7b519a5f321ca2",
                label:
                  "0xbe5c6790327da30346629ac032c3f2fe3e324f9f91682a9b8a7b519a5f321ca2",
              },
            },
          ],
        ],
        [
          "Permission hash",
          [
            {
              code: "sha256:7171a1991636a5923a86991b8b9f284b9a5a5082458645a05d7f69f0f0eed56b",
            },
          ],
        ],
        [
          "ENS resolver",
          [
            {
              a: {
                href: "https://sepolia.etherscan.io/address/0x0d4560dafeb04cf022472b5085070a05e0d77e0b",
                label: "0x0d4560dafeb04cf022472b5085070a05e0d77e0b",
              },
            },
          ],
        ],
        [
          "Agent name",
          [{ code: "representative-agent.agents.kanon-ethonline-2026.eth" }],
        ],
        ["Namespace", [{ code: "kanon-ethonline-2026.eth" }]],
      ],
    },
    {
      t: "h2",
      text: "How to verify",
      id: "how-to-verify",
    },
    {
      t: "list",
      ordered: true,
      items: [
        [
          "Open the transaction on Sepolia Etherscan — the sender is the Privy demo wallet, the recipient the control wallet, the value 1 wei.",
        ],
        [
          "Read ",
          { code: "kanon.status" },
          " on the agent's ENS name at the resolver — it reads ",
          { code: "revoked" },
          " for the completed run.",
        ],
        [
          "Re-run ",
          { code: "pnpm smoke:live" },
          " to produce a fresh run with new references.",
        ],
      ],
    },
    {
      t: "callout",
      kind: "note",
      title: "What this proves and does not",
      text: [
        "The transaction proves a policy-approved action executed. The rejection codes in the evidence prove the policy boundary held. Neither proves production readiness — this is a testnet prototype.",
      ],
    },
  ],
};

const completeRun: DocPageContent = {
  id: "complete-run-example",
  title: "Complete run example",
  description:
    "The recorded live run of 2026-09-26 — every step and every reference.",
  blocks: [
    {
      t: "p",
      text: [
        "A full judge flow ran against the public deployment on 2026-09-26 (11:28:21–11:30:51 UTC, about 150 seconds end to end). The evidence file is ",
        { code: "evidence/3rd-web-hack/live-judge-flow-latest.json" },
        " and every field below is copied from it.",
      ],
    },
    {
      t: "kv",
      rows: [
        [
          "Installation",
          [{ code: "installation-release-3wh-20260926-d39rn2" }],
        ],
        ["Release v1", [{ code: "release-3wh-20260926-d39rn2" }]],
        [
          "Permission hash",
          [
            {
              code: "sha256:7171a1991636a5923a86991b8b9f284b9a5a5082458645a05d7f69f0f0eed56b",
            },
          ],
        ],
        [
          "Allowed transaction",
          [
            {
              a: {
                href: "https://sepolia.etherscan.io/tx/0xbe5c6790327da30346629ac032c3f2fe3e324f9f91682a9b8a7b519a5f321ca2",
                label: "0xbe5c6790…321ca2",
              },
            },
          ],
        ],
        ["Forbidden rejection", [{ code: "PRIVY_POLICY_REJECTED_400" }]],
        [
          "Update classification",
          [
            { code: "EXPANDED" },
            " — ",
            { code: "maxValueWei" },
            " and ",
            { code: "rollingSpend.maxValueWei" },
          ],
        ],
        [
          "Revocation",
          [
            { code: "privyAuthorityRevoked: true" },
            ", ",
            { code: "ensStatus: revoked" },
            ", ",
            { code: "postRevokeExecutionFailed: true" },
          ],
        ],
        ["Post-revoke attempt", [{ code: "RUNNER_REFUSED_STALE_OR_REVOKED" }]],
      ],
    },
    {
      t: "h2",
      text: "ENS records at approval",
      id: "ens-at-approval",
    },
    {
      t: "kv",
      rows: [
        ["kanon.agentId", [{ code: "com.example.treasury" }]],
        ["kanon.release", [{ code: "release-3wh-20260926-d39rn2" }]],
        [
          "kanon.permissionHash",
          [
            {
              code: "sha256:7171a1991636a5923a86991b8b9f284b9a5a5082458645a05d7f69f0f0eed56b",
            },
          ],
        ],
        [
          "kanon.status",
          [{ code: "approved" }, " (later ", { code: "revoked" }, ")"],
        ],
      ],
    },
    {
      t: "callout",
      kind: "note",
      title: "Later sessions reuse the identity",
      text: [
        "The shared ENS name is reused by each run. Its live ",
        { code: "kanon.release" },
        " may now show a newer release — the API returns the current records and labels them separately from this installation's approved hash.",
      ],
    },
    {
      t: "h2",
      text: "What this proves",
      id: "proves",
    },
    {
      t: "list",
      items: [
        [
          "An exact boundary was approved, enforced, widened only after a fresh human decision, and revoked with the post-revoke failure recorded.",
        ],
        [
          "Generations advanced 0 → 1 → 2 across grant, reauthorization and revocation.",
        ],
      ],
    },
    {
      t: "h2",
      text: "What it cannot prove",
      id: "cannot-prove",
    },
    {
      t: "list",
      items: [
        [
          "Security under real adversarial load — the suite and smoke are correctness checks, not an audit.",
        ],
        ["Mainnet behavior — nothing here runs on mainnet."],
      ],
    },
  ],
};

export const proofPages: readonly DocPageContent[] = [
  liveDeployment,
  verifiedTransactions,
  completeRun,
];
