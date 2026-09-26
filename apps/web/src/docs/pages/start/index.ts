import type { DocPageContent } from "../../types.js";

const introduction: DocPageContent = {
  id: "introduction",
  title: "Introduction",
  description:
    "Kanon is a business agent-control runtime for company-deployed financial AI agents.",
  blocks: [
    {
      t: "p",
      text: [
        "Kanon is a business agent-control runtime for company-deployed financial AI agents. A human approves an exact wallet authority for a specific agent release. Privy enforces that authority on every transaction. ENSv2 publishes the agent's company-controlled identity and approved state. A software update that asks for more cannot inherit the old approval.",
      ],
    },
    {
      t: "callout",
      kind: "note",
      title: "Core promise",
      text: [
        "An agent receives exactly the authority a human approved, and a software update cannot silently widen it.",
      ],
    },
    {
      t: "p",
      text: [
        "The live prototype runs on the Ethereum Sepolia testnet at ",
        {
          a: {
            href: "https://kanon-agents.vercel.app",
            label: "kanon-agents.vercel.app",
          },
        },
        ". No wallet, sign-up, or credentials are needed to try it.",
      ],
    },
    {
      t: "h2",
      text: "What Kanon is",
      id: "what-kanon-is",
    },
    {
      t: "p",
      text: [
        "Kanon sits between a company and its financial agent. The agent declares what it wants to do, the company defines the exact boundary it will grant, a human approves that boundary, and from then on a delegated signer inside a signer-specific Privy policy enforces it. ENSv2 records under the company's namespace publish the approved state so anyone can check what was approved — but ENS never enforces wallet permissions itself.",
      ],
    },
    {
      t: "h2",
      text: "What Kanon is not",
      id: "what-kanon-is-not",
    },
    {
      t: "list",
      items: [
        [
          "Not a custody product. The company keeps ownership of the Privy wallet through a key quorum; the agent only ever holds a delegated signer.",
        ],
        [
          "Not a production financial system. This is a hackathon prototype on a testnet with no real funds, no audit, and no external users.",
        ],
        [
          "Not an agent framework. Kanon does not write or run agent logic — it controls the wallet authority an agent is granted and proves enforcement.",
        ],
      ],
    },
  ],
};

const whyKanon: DocPageContent = {
  id: "why-kanon",
  title: "Why Kanon",
  description:
    "The problem: broad hot-wallet keys or per-transaction human signing, plus silent authority growth on updates.",
  blocks: [
    {
      t: "p",
      text: [
        "Companies want agents to pay contractors, move treasury funds and run recurring payments. Today they choose between two bad options: give the agent a broad hot-wallet key, or have a human sign every transaction.",
      ],
    },
    {
      t: "p",
      text: [
        "There is a quieter risk. Agents are software and ship updates. When version 2 asks for more spending power than version 1, most setups let it inherit the old access without anyone reviewing the change.",
      ],
    },
    {
      t: "h2",
      text: "The three records Kanon keeps separate",
      id: "three-records",
    },
    {
      t: "list",
      ordered: true,
      items: [
        [
          { code: "Declared" },
          " — an agent release describes the capabilities it wants. The declaration grants nothing.",
        ],
        [
          { code: "Granted" },
          " — the company defines the exact boundary it is willing to approve.",
        ],
        [
          { code: "Recorded" },
          " — Privy enforces the boundary on every transaction; ENSv2 publishes the approved state for review.",
        ],
      ],
    },
    {
      t: "p",
      text: [
        "A wider release stops at a human decision instead of inheriting the old wallet policy silently. That is the property the rest of the system exists to protect.",
      ],
    },
  ],
};

const howItWorks: DocPageContent = {
  id: "how-it-works",
  title: "How it works",
  description:
    "One lifecycle: declare, define, normalize, approve, enforce, publish, execute, diff, revoke.",
  blocks: [
    {
      t: "p",
      text: [
        "Every run through Kanon follows the same lifecycle. Each step has a single owner, and each step fails closed if its inputs do not match what was approved.",
      ],
    },
    {
      t: "flow",
      steps: [
        "Release declares capabilities",
        "Company defines authority terms",
        "Kanon normalizes terms → permissionHash",
        "Human approves the exact record",
        "Privy policy + delegated signer attached",
        "ENSv2 records the approved state",
        "Runner executes inside the boundary",
        "Updates diffed — wider needs re-approval",
        "Revoke removes the signer; later actions fail",
      ],
    },
    {
      t: "h2",
      text: "The lifecycle in detail",
      id: "lifecycle-detail",
    },
    {
      t: "list",
      ordered: true,
      items: [
        [
          { code: "The release declares" },
          ". An agent release lists the capabilities it wants. The declaration never grants authority.",
        ],
        [
          { code: "The company defines" },
          ". Recipient, per-action ceiling and rolling spend ceiling.",
        ],
        [
          { code: "Kanon normalizes" },
          ". Terms become a canonical record with a deterministic ",
          { code: "permissionHash" },
          ".",
        ],
        [
          { code: "A human approves" },
          ". The decision binds release, package hash, manifest hash and permissionHash together.",
        ],
        [
          { code: "Privy enforces" },
          ". Kanon compiles the terms into a signer-specific Privy policy and attaches a dedicated delegated signer. The company keeps wallet ownership.",
        ],
        [
          { code: "ENSv2 identifies" },
          ". The agent's name under the company namespace records ",
          { code: "kanon.agentId" },
          ", ",
          { code: "kanon.release" },
          ", ",
          { code: "kanon.permissionHash" },
          " and ",
          { code: "kanon.status" },
          ". Only the company writer role can change them.",
        ],
        [
          { code: "The agent operates" },
          ". The isolated runner executes allowed actions. Out-of-policy actions are rejected by Privy.",
        ],
        [
          { code: "Updates are diffed" },
          ". A new release is classified ",
          { code: "NO_CHANGE" },
          ", ",
          { code: "NARROWER" },
          ", ",
          { code: "EXPANDED" },
          ", ",
          { code: "SUBSTITUTED" },
          " or ",
          { code: "UNKNOWN" },
          ". Anything not provably equal or narrower waits for a fresh human decision.",
        ],
        [
          { code: "Revocation is real" },
          ". The delegated signer is removed, the ENS status becomes ",
          { code: "revoked" },
          ", and later execution fails.",
        ],
      ],
    },
    {
      t: "callout",
      kind: "boundary",
      title: "Enforcement vs evidence",
      text: [
        "Privy enforces financial authority on-chain. ENS records are identity evidence — they describe approved state but never grant or revoke wallet permission. Kanon writes ENS only after the matching Privy change succeeds.",
      ],
    },
  ],
};

const tryKanon: DocPageContent = {
  id: "try-kanon",
  title: "Try Kanon",
  description:
    "Run the full lifecycle on the hosted public demo — about five minutes, no wallet required.",
  blocks: [
    {
      t: "p",
      text: [
        "Open ",
        {
          a: {
            href: "https://kanon-agents.vercel.app",
            label: "kanon-agents.vercel.app",
          },
        },
        " and choose ",
        { code: "Start a live authority run" },
        ". The workspace guides you through the full lifecycle with a judge-path rail on the right.",
      ],
    },
    {
      t: "list",
      ordered: true,
      items: [
        [
          "Register a release",
          " — the release, package hash and manifest hash.",
        ],
        [
          "Review requested capabilities",
          " — the request, kept separate from any grant.",
        ],
        [
          "Define company authority",
          " — recipient, per-action ceiling, rolling ceiling.",
        ],
        [
          "Approve the exact boundary",
          " — normalized terms and the permissionHash.",
        ],
        [
          "Activate Privy-enforced authority",
          " — policy and delegated signer attached, generation 0.",
        ],
        [
          "Inspect ENS identity and permission hash",
          " — live records from the Permissioned Resolver.",
        ],
        [
          "Run an allowed action",
          " — a real Sepolia transaction with an Etherscan link.",
        ],
        [
          "Reject a forbidden action",
          " — a Privy policy rejection recorded as evidence.",
        ],
        [
          "Detect a broader release",
          " — an EXPANDED diff listing the changed paths.",
        ],
        [
          "Require fresh human authorization",
          " — a new approval, generation 1.",
        ],
        [
          "Revoke authority",
          " — signer removed, ENS status ",
          { code: "revoked" },
          ".",
        ],
        [
          "Prove post-revocation execution fails",
          " — the rejected attempt recorded as evidence.",
        ],
      ],
    },
    {
      t: "h2",
      text: "Hosted demo facts",
      id: "demo-facts",
    },
    {
      t: "list",
      items: [
        [
          "One shared Privy demo wallet, one delegated signer and one ENS name — one session holds them at a time. A busy fixture shows the remaining wait.",
        ],
        [
          "Terms are capped: the recipient is fixed to the organization's control wallet, ceilings are 1–1000 wei, and a rolling window of 60–86400 seconds is required.",
        ],
        [
          "Idle sessions expire after 20 minutes through the real revocation path.",
        ],
        [
          "The backend runs on free-tier hosting and sleeps when idle. The first request after a cold start can take up to a minute; the workspace retries automatically.",
        ],
      ],
    },
    {
      t: "h2",
      text: "Headless verification",
      id: "headless",
    },
    {
      t: "p",
      text: [
        "The same flow can be replayed against the public deployment without credentials:",
      ],
    },
    { t: "code", text: "pnpm smoke:live", label: "Terminal", copy: true },
    {
      t: "p",
      text: [
        "It writes a non-secret record to ",
        { code: "evidence/3rd-web-hack/" },
        ".",
      ],
    },
  ],
};

export const startPages: readonly DocPageContent[] = [
  introduction,
  whyKanon,
  howItWorks,
  tryKanon,
];
