import type { DocPageContent } from "../../types.js";

const networks: DocPageContent = {
  id: "supported-networks",
  title: "Supported networks",
  description: "Ethereum Sepolia only — chain ID 11155111.",
  blocks: [
    {
      t: "table",
      columns: ["Network", "Chain ID", "Status"],
      rows: [
        [
          ["Ethereum Sepolia"],
          [{ code: "11155111" }],
          ["Live — the only supported chain in this release."],
        ],
      ],
    },
    {
      t: "callout",
      kind: "warning",
      title: "Testnet only",
      text: [
        "There is no mainnet deployment and no real funds move. No mainnet ENS write is authorized by this repository. Other networks are not supported today.",
      ],
    },
  ],
};

const assets: DocPageContent = {
  id: "supported-assets",
  title: "Supported assets",
  description: "Native ETH on Sepolia only.",
  blocks: [
    {
      t: "table",
      columns: ["Asset", "Network", "Status"],
      rows: [
        [["Native ETH"], ["Sepolia (11155111)"], ["Live."]],
        [
          ["ERC-20 tokens"],
          ["—"],
          ["Not supported today — terms requesting them fail closed."],
        ],
      ],
    },
    {
      t: "p",
      text: [
        "The authority grammar intentionally supports only native-asset value rules. Request-count limits are also outside the grammar and fail closed.",
      ],
    },
  ],
};

const authorityTerms: DocPageContent = {
  id: "authority-terms",
  title: "Authority terms",
  description:
    "The kanon.company-authority-terms v2 grammar and the hosted-demo ceiling.",
  blocks: [
    {
      t: "p",
      text: [
        "Company terms (",
        { code: "kanon.company-authority-terms" },
        " v2) are a finite set of rules. Each rule has a chain ID, native asset, one exact recipient, a per-transaction ceiling, and optionally calldata function/argument constraints, a validity window and a rolling native-value limit.",
      ],
    },
    {
      t: "h2",
      text: "Rule shape",
      id: "rule-shape",
    },
    {
      t: "code",
      label: "kanon.company-authority-terms rule",
      text: `{
  "chainId": 11155111,
  "asset": "native",
  "recipient": "0x8b88E1E1174eDC65B08de75A5439f130da8A3DFd",
  "maxValueWei": "1",
  "rollingSpend": { "maxValueWei": "1", "windowSeconds": 3600 }
}`,
      copy: true,
    },
    {
      t: "p",
      text: [
        { code: "permissionHash" },
        " is ",
        { code: "sha256:" },
        " over the canonical JSON of the normalized terms. It excludes release identity and vendor IDs — those are bound separately by the approval record — so an unchanged authority keeps the same hash across releases.",
      ],
    },
    {
      t: "h2",
      text: "Execution methods",
      id: "execution-methods",
    },
    {
      t: "p",
      text: [
        "The Privy compiler emits one execution method per plan. Stateless rules can use ",
        { code: "eth_sendTransaction" },
        ". Rolling limits require an owner-controlled aggregation and the ",
        { code: "eth_signTransaction" },
        " path, with the signed transaction broadcast separately. Unsupported combinations return ",
        { code: "UNSUPPORTED_POLICY_COMBINATION" },
        " and no policy is created.",
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
        ["One rule only."],
        ["Chain 11155111, native ETH."],
        ["Recipient must equal the organization's control wallet."],
        ["Per-action and rolling ceilings between 1 and 1000 wei."],
        ["Rolling window between 60 and 86400 seconds, required."],
        ["No calldata or validity-window constraints."],
      ],
    },
    {
      t: "callout",
      kind: "boundary",
      title: "Demo ceiling vs. enforcement",
      text: [
        "The ceiling is a demo guard enforced by the API — it exists to keep the public fixture safe. Privy policy enforcement is a separate layer and still decides each transaction.",
      ],
    },
  ],
};

const states: DocPageContent = {
  id: "installation-states",
  title: "Installation states",
  description: "Every status an installation can hold, and what each means.",
  blocks: [
    {
      t: "table",
      columns: ["Status", "Meaning", "Terminal?"],
      rows: [
        [[{ code: "VALIDATED" }], ["Release parsed and recorded."], ["No"]],
        [
          [{ code: "AWAITING_APPROVAL" }],
          ["Terms defined; waiting for a human decision. Holds no authority."],
          ["No"],
        ],
        [
          [{ code: "CONFIGURING_AUTHORITY" }],
          ["Privy policy/signer and ENS records are being written."],
          ["No"],
        ],
        [
          [{ code: "ACTIVE" }],
          ["Delegated signer attached, ENS approved records verified."],
          ["No"],
        ],
        [
          [{ code: "UPDATE_AVAILABLE" }],
          ["A new release was diffed and awaits a human review decision."],
          ["No"],
        ],
        [
          [{ code: "AWAITING_REAUTHORIZATION" }],
          [
            "A new decision was recorded; the new authority is being configured.",
          ],
          ["No"],
        ],
        [
          [{ code: "REVOKING" }],
          [
            "Signer removal, post-revoke check and ENS revoke write in progress.",
          ],
          ["No"],
        ],
        [
          [{ code: "REVOKED" }],
          [
            "Delegated authority removed; ENS status revoked. Kept for history.",
          ],
          ["Yes"],
        ],
      ],
    },
    {
      t: "callout",
      kind: "note",
      title: "Fail closed",
      text: [
        "An installation can never be presented as active authority while a transition is unfinished — ",
        { code: "ACTIVE" },
        " requires matching Privy and ENS state.",
      ],
    },
  ],
};

const deployment: DocPageContent = {
  id: "deployment",
  title: "Deployment",
  description: "Where each piece of the hosted demo runs.",
  blocks: [
    {
      t: "table",
      columns: ["Service", "Provider", "Endpoint", "Notes"],
      rows: [
        [
          ["Frontend + proxy"],
          ["Vercel project ", { code: "kanon-agents" }],
          [
            {
              a: {
                href: "https://kanon-agents.vercel.app",
                label: "kanon-agents.vercel.app",
              },
            },
          ],
          [
            "Static Vite build plus the ",
            { code: "api/kanon-proxy.ts" },
            " function (maxDuration 120 s).",
          ],
        ],
        [
          ["API"],
          ["Render ", { code: "kanon-api" }],
          [
            {
              a: {
                href: "https://kanon-api.onrender.com/healthz",
                label: "kanon-api.onrender.com/healthz",
              },
            },
          ],
          [
            "Node.js 22, start command ",
            { code: "node --import tsx apps/api/src/server.ts" },
            ".",
          ],
        ],
        [
          ["Runner"],
          ["Render ", { code: "kanon-runner" }],
          [
            {
              a: {
                href: "https://kanon-runner.onrender.com/healthz",
                label: "kanon-runner.onrender.com/healthz",
              },
            },
          ],
          [
            "Node.js 22, start command ",
            { code: "node --import tsx apps/runner/src/server.ts" },
            ".",
          ],
        ],
        [
          ["Database"],
          ["Neon PostgreSQL"],
          ["private"],
          ["Installations, releases, evidence, proofs."],
        ],
        [
          ["Chain"],
          ["Ethereum Sepolia"],
          [{ code: "11155111" }],
          [
            "Demo wallet ",
            { code: "0x42D5Fb257d479187607D47C19433Be6aEEd4a9A9" },
            "; control wallet ",
            { code: "0x8b88E1E1174eDC65B08de75A5439f130da8A3DFd" },
            ".",
          ],
        ],
        [
          ["ENS"],
          ["ENSv2 on Sepolia"],
          [{ code: "kanon-ethonline-2026.eth" }],
          [
            { code: "agents.kanon-ethonline-2026.eth" },
            " → ",
            { code: "representative-agent.agents.kanon-ethonline-2026.eth" },
            ".",
          ],
        ],
      ],
    },
    {
      t: "h2",
      text: "Deploy flow",
      id: "deploy-flow",
    },
    {
      t: "list",
      items: [
        [
          "Render redeploys the API and runner automatically on every push to ",
          { code: "main" },
          ".",
        ],
        [
          "The Vercel project is deployed manually with ",
          { code: "vercel --prod" },
          ".",
        ],
        [
          "Both ",
          { code: "/healthz" },
          " endpoints report the release label ",
          { code: "kanon-3rd-web-hack-2026.09" },
          ".",
        ],
      ],
    },
    {
      t: "callout",
      kind: "note",
      title: "Free tier",
      text: [
        "Render free services sleep after about 15 minutes idle. A scheduled GitHub workflow requests the proxy status endpoint and the runner (configured every 10 minutes until 2026-10-03). GitHub runs schedules on a best-effort basis and has run it only every few hours, so the first request after idle can still take up to a minute.",
      ],
    },
  ],
};

const limitations: DocPageContent = {
  id: "limitations",
  title: "Limitations",
  description: "What this release does not do — stated plainly.",
  blocks: [
    {
      t: "list",
      items: [
        ["Sepolia testnet only. No mainnet deployment and no real funds."],
        [
          "Not independently audited. Not a production custody or financial-operations system. No external users.",
        ],
        [
          "Narrow authority grammar: native ETH, one exact recipient per rule, per-action and rolling value ceilings, optional calldata and validity constraints. ERC-20 assets and request-count limits fail closed.",
        ],
        [
          "Privy aggregations are method-dependent and carry Privy's documented stateful-policy concurrency caveat.",
        ],
        [
          "The hosted demo shares one wallet, signer and ENS name — one session holds authority at a time.",
        ],
        ["In-memory rate limits reset when the API restarts."],
        ["ENSv2 contracts on Sepolia are beta and may change before mainnet."],
        [
          "Render free services sleep when idle; a scheduled GitHub keep-warm runs on a best-effort basis (observed only every few hours) until 2026-10-03, so the first request after idle can still take up to a minute.",
        ],
      ],
    },
    {
      t: "h2",
      text: "Fees and gas",
      id: "fees-gas",
    },
    {
      t: "p",
      text: [
        "Kanon has no fees — there is no fee page because nothing is charged. On the hosted demo, the shared Privy demo wallet pays Sepolia gas for test transactions; visitors never pay anything.",
      ],
    },
    {
      t: "h2",
      text: "Not supported today",
      id: "not-supported",
    },
    {
      t: "list",
      items: [
        ["ERC-20 stablecoin terms."],
        ["Quorum approval for large authority changes."],
        ["Per-organization wallets and ENS namespaces."],
        ["Mainnet deployment of any component."],
      ],
    },
  ],
};

export const referencePages: readonly DocPageContent[] = [
  networks,
  assets,
  authorityTerms,
  states,
  deployment,
  limitations,
];
