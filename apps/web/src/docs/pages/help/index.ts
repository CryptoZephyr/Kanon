import type { DocPageContent } from "../../types.js";

const troubleshooting: DocPageContent = {
  id: "troubleshooting",
  title: "Troubleshooting",
  description:
    "Real error codes and failure paths, with what to do about each.",
  blocks: [
    {
      t: "p",
      text: [
        "These are the failure paths that exist in the code, mapped to what you see and what to do. Every load failure in the workspace offers ",
        { code: "Retry" },
        " — a failed load never shows as an empty list.",
      ],
    },
    {
      t: "h2",
      text: "Cold start",
      id: "cold-start",
    },
    {
      t: "kv",
      rows: [
        ["What you see", ["Waking hosted backend… attempt N"]],
        [
          "Why",
          [
            "Render free services sleep after ~15 minutes idle; the first request wakes them.",
          ],
        ],
        [
          "Fix",
          ["Wait — the workspace retries automatically. No action needed."],
        ],
      ],
    },
    {
      t: "h2",
      text: "Error codes",
      id: "error-codes",
    },
    {
      t: "error",
      rows: [
        [
          "DEMO_SESSION_ACTIVE",
          "409",
          "Another session holds the shared demo fixture.",
          "Wait for it to finish or expire (the UI shows the longest remaining wait), or watch the latest run read-only.",
        ],
        [
          "RATE_LIMITED",
          "429",
          "Too many demo requests from this client or across the demo.",
          "Wait a few minutes and retry.",
        ],
        [
          "DEMO_TERMS_OUT_OF_BOUNDS",
          "422",
          "Terms exceed the hosted-demo ceiling.",
          "Fix the named field: recipient must be the control wallet, ceilings 1–1000 wei, window 60–86400 s, no calldata or validity fields.",
        ],
        [
          "UPSTREAM_TIMEOUT / UPSTREAM_FAILED / UPSTREAM_REQUEST_FAILED",
          "504 / 502",
          "The proxy timed out waiting for the API, or the API could not reach the runner — usually a cold start.",
          "Retry. The server keeps any work it already started; the workspace re-reads real state rather than guessing.",
        ],
        [
          "CONFLICT",
          "409",
          "The request does not match the installation's current state (e.g. approving twice).",
          "Reload — the real status wins. The workspace re-syncs automatically.",
        ],
        [
          "REVOKED",
          "409",
          "The installation's authority is already revoked.",
          "No action possible — this is terminal. Review the revocation evidence or start a new run.",
        ],
        [
          "FORBIDDEN",
          "403",
          "The route is outside the public proxy allowlist, or the demo role lacks it.",
          "Use the workspace paths only; the demo role has a fixed route set.",
        ],
        [
          "NOT_FOUND",
          "404",
          "Unknown installation or release id.",
          "Check the id. If your stored run disappeared after expiry, start a new run.",
        ],
        [
          "UNAUTHORIZED",
          "401",
          "Missing or wrong credential. Public callers should never see this through the proxy.",
          "Reload the workspace; if it persists the deployment is misconfigured — report it.",
        ],
        [
          "INTERNAL_ERROR",
          "500",
          "Unexpected server failure.",
          "Retry once. If it repeats, record what you clicked and the installation id.",
        ],
        [
          "UNSUPPORTED_POLICY_COMBINATION",
          "422",
          "The terms need a Privy policy shape that is not supported.",
          "Simplify the terms — no policy was created, so nothing needs cleanup.",
        ],
        [
          "RUNNER_REFUSED_STALE_OR_REVOKED",
          "execution evidence (409 from the runner)",
          "The isolated runner refused stale, revoked or mismatched authority before signing.",
          "Expected after revocation or reauthorization — the refusal is the proof, not an error to fix.",
        ],
        [
          "PRIVY_POLICY_REJECTED_400",
          "execution evidence",
          "The forbidden scenario was rejected at the Privy signing layer.",
          "Expected — this is the boundary working. Recorded as evidence, not a crash.",
        ],
      ],
    },
    {
      t: "h2",
      text: "Second allowed action rejected",
      id: "rolling-limit",
    },
    {
      t: "kv",
      rows: [
        [
          "What you see",
          ["A second allowed action fails with a policy rejection."],
        ],
        [
          "Why",
          [
            "Demo terms allow 1 wei per rolling window (default 3600 s) — the first action consumed it.",
          ],
        ],
        [
          "Fix",
          [
            "None needed — the rolling limit is doing its job. Wait for the window or start a new run.",
          ],
        ],
      ],
    },
    {
      t: "h2",
      text: "A step never finishes",
      id: "never-finishes",
    },
    {
      t: "kv",
      rows: [
        [
          "What you see",
          ["Watching… for several minutes with no state change."],
        ],
        [
          "Why",
          [
            "The browser's request ended but the server kept working; occasionally a provider call is genuinely stuck.",
          ],
        ],
        [
          "Fix",
          [
            "Wait for the watcher (~5 minutes), then use Retry. If the state is still pre-authority, nothing was granted — safe to start over.",
          ],
        ],
      ],
    },
  ],
};

const faq: DocPageContent = {
  id: "faq",
  title: "FAQ",
  description: "Direct answers about what the demo does and does not do.",
  blocks: [
    {
      t: "h2",
      text: "Is any real money involved?",
      id: "real-money",
    },
    {
      t: "p",
      text: [
        "No. Everything runs on Sepolia with testnet ETH. The shared demo wallet pays gas; visitors pay nothing — Kanon has no fees.",
      ],
    },
    {
      t: "h2",
      text: "Do I need a wallet or an account?",
      id: "wallet-account",
    },
    {
      t: "p",
      text: [
        "No. The workspace stores your run's installation id in this browser's localStorage. Nothing else identifies you; there is no sign-up.",
      ],
    },
    {
      t: "h2",
      text: "Why does ENS not enforce anything?",
      id: "ens-enforcement",
    },
    {
      t: "p",
      text: [
        "By design. ENSv2 records are public identity evidence — they say what was approved, not whether it is allowed. Privy policy is the enforcement plane; ENS is written only after the matching Privy change succeeds.",
      ],
    },
    {
      t: "h2",
      text: "What does a permissionHash actually commit to?",
      id: "permissionhash",
    },
    {
      t: "p",
      text: [
        "The normalized company terms — recipient, ceilings, rolling window — hashed as canonical JSON. It deliberately excludes release identity and vendor ids; the approval record binds those separately.",
      ],
    },
    {
      t: "h2",
      text: "Can an update widen authority automatically?",
      id: "update-widen",
    },
    {
      t: "p",
      text: [
        "No. Any change that cannot be proven narrower or identical (",
        { code: "EXPANDED" },
        ", ",
        { code: "SUBSTITUTED" },
        ", ",
        { code: "UNKNOWN" },
        ") waits for a fresh human decision bound to the new permissionHash.",
      ],
    },
    {
      t: "h2",
      text: "What happens to a revoked agent's ENS name?",
      id: "revoked-ens",
    },
    {
      t: "p",
      text: [
        "It is kept for history with ",
        { code: "kanon.status" },
        " set to ",
        { code: "revoked" },
        " — written only after the signer is actually removed and a post-revoke attempt fails.",
      ],
    },
    {
      t: "h2",
      text: "What is not supported today?",
      id: "not-supported",
    },
    {
      t: "p",
      text: [
        "ERC-20 assets, request-count limits, mainnet deployment, per-organization wallets/namespaces, and quorum approval for large authority changes are all future work — not supported today.",
      ],
    },
    {
      t: "h2",
      text: "Can I verify it myself?",
      id: "verify",
    },
    {
      t: "p",
      text: [
        "Yes — ",
        { code: "pnpm smoke:live" },
        " replays the full lifecycle against the public deployment without credentials and writes fresh evidence. The on-chain parts are checkable on Sepolia Etherscan and the Permissioned Resolver.",
      ],
    },
  ],
};

export const helpPages: readonly DocPageContent[] = [troubleshooting, faq];
