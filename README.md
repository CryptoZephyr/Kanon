# Kanon

Kanon is a business agent-control runtime for company-deployed financial AI agents. A human approves an exact wallet authority for a specific agent release. Privy enforces that authority on every transaction. ENSv2 publishes the agent's company-controlled identity and approved state. A software update that asks for more cannot inherit the old approval.

**Core promise:** an agent receives exactly the authority a human approved, and a software update cannot silently widen it.

- Live prototype: [kanon-agents.vercel.app](https://kanon-agents.vercel.app) (Ethereum Sepolia testnet)
- Judge brief: [docs/submission.md](docs/submission.md)
- Architecture: [docs/architecture.md](docs/architecture.md)
- Pitch deck: [docs/pitch/kanon-pitch-deck.pdf](docs/pitch/kanon-pitch-deck.pdf)
- Security boundary: [SECURITY.md](SECURITY.md) · Status: [docs/implementation-status.md](docs/implementation-status.md) · Deployment: [DEPLOYMENT.md](DEPLOYMENT.md)

This is the **3rd-Web-Hack release** (`v0.3.0`, release label `kanon-3rd-web-hack-2026.09`). See [Project history](#project-history) for where Kanon started and what changed in this release.

## The problem

Companies want agents to pay contractors, move treasury funds and run recurring payments. Today they choose between two bad options: give the agent a broad hot-wallet key, or have a human sign every transaction. There is also a quieter risk. Agents are software and ship updates. When version 2 asks for more spending power than version 1, most setups let it inherit the old access without anyone reviewing the change.

Kanon's users are businesses and organizations running financial agents: crypto-native startups, DAOs, and teams paying contributors in crypto.

## How Kanon solves it

1. **The release declares.** An agent release lists the capabilities it wants. The declaration never grants authority.
2. **The company defines.** The company sets the terms it will grant: recipient, per-action ceiling, rolling spend ceiling.
3. **Kanon normalizes.** Terms become a canonical record with a deterministic `permissionHash`.
4. **A human approves.** The decision is bound to the release, package hash, manifest hash and `permissionHash`.
5. **Privy enforces.** Kanon compiles the terms into a signer-specific Privy policy and attaches a dedicated delegated signer. The company keeps wallet ownership.
6. **ENSv2 identifies.** The agent's ENS name under the company namespace records `kanon.agentId`, `kanon.release`, `kanon.permissionHash` and `kanon.status`. Only the company writer role can change them.
7. **The agent operates.** The isolated runner executes allowed actions. Out-of-policy actions are rejected by Privy.
8. **Updates are diffed.** A new release is classified `NO_CHANGE`, `NARROWER`, `EXPANDED`, `SUBSTITUTED` or `UNKNOWN`. Anything not provably equal or narrower waits for a fresh human decision. Privy is updated first; ENS moves only after Privy confirms.
9. **Revocation is real.** The delegated signer is removed, ENS status becomes `revoked`, and later execution fails.

Humans approve authority boundaries. Agents operate inside them.

## Try the judge flow

Open [kanon-agents.vercel.app](https://kanon-agents.vercel.app), choose **Enter the workspace** and follow the judge path rail. Every step uses the deployed API, the isolated runner, Privy and ENSv2 on Sepolia:

| #   | Step                                     | What you see                                       |
| --- | ---------------------------------------- | -------------------------------------------------- |
| 1   | Register an agent release                | Release, package hash, manifest hash               |
| 2   | Review requested capabilities            | The request, kept separate from any grant          |
| 3   | Define company authority                 | Recipient, per-action ceiling, rolling ceiling     |
| 4   | Approve the exact boundary               | Normalized terms and `permissionHash`              |
| 5   | Activate Privy-enforced authority        | Policy and delegated signer attached, generation 0 |
| 6   | Inspect ENS identity and permission hash | Live records from the Permissioned Resolver        |
| 7   | Run an allowed action                    | A Sepolia transaction with an Etherscan link       |
| 8   | Reject a forbidden action                | Privy policy rejection recorded as evidence        |
| 9   | Detect a broader release                 | `EXPANDED` diff with changed paths                 |
| 10  | Require fresh human authorization        | New approval, generation 1                         |
| 11  | Revoke authority                         | Signer removed, ENS status `revoked`               |
| 12  | Prove post-revocation execution fails    | Rejected attempt recorded as evidence              |

Notes for the hosted demo:

- It shares one Privy demo wallet, one delegated signer and one ENS name. One session holds them at a time. If someone else is mid-run, the workspace shows when the fixture frees up (sessions expire after 20 minutes of inactivity through the real revocation path).
- Terms are capped for the public demo: the recipient is the organization's own control wallet and values are at most 1000 wei. Those caps are enforced by the API.
- The backend runs on free-tier hosting. If it was idle, the workspace shows "Waking hosted backend" and retries automatically; the first request can take up to a minute.

The same flow can be run headlessly against the public deployment with `pnpm smoke:live`. It needs no credentials and writes a non-secret record to `evidence/3rd-web-hack/`.

## Architecture

```text
Browser (Vercel, React)
   │  /api/*  — no secrets in the browser
   ▼
Vercel proxy ── restricted demo credential, route allowlist, body cap
   │
   ▼
Kanon API (Render, Node.js 22) ── Neon PostgreSQL
   │  lifecycle state machine, human decisions, permission diff,
   │  Privy policy compiler, ENS writes, session lease
   ├──────────────► Privy: business wallet (company-owned), policy, delegated signer
   ├──────────────► ENSv2 Sepolia: company namespace, agent name, protected records
   ▼
Isolated runner (Render) ── holds only the agent's delegated key, re-checks
                            installation state before every execution
```

Full description, trust boundaries and lifecycle states: [docs/architecture.md](docs/architecture.md).

## Technology stack

| Layer                 | Technology                                                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Network               | Ethereum Sepolia (chain ID `11155111`)                                                                                                                |
| Financial enforcement | Privy server wallets, key quorum ownership, additional signers, signer-specific policies, rolling-value aggregations (`eth_signTransaction`)          |
| Identity              | ENSv2 beta on Sepolia: Permissioned Registry, nested user registry, Permissioned Resolver, Enhanced Access Control roles, Universal Resolver readback |
| EVM tooling           | viem                                                                                                                                                  |
| Backend               | Node.js 22, TypeScript, `tsx`, PostgreSQL (Neon) via `pg`                                                                                             |
| Frontend              | React 19, Vite 7                                                                                                                                      |
| Hosting               | Vercel (frontend + proxy function), Render (API and runner)                                                                                           |
| Quality               | Vitest, ESLint, Prettier, GitHub Actions CI                                                                                                           |

## Setup

Requirements: Node.js `22.x` (pinned `22.23.2` in `.node-version`) and pnpm `11.5.0`.

```text
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
pnpm build:web
```

None of these need provider credentials.

**Run the frontend locally against your own backend:** `pnpm dev:web`. The Vite dev server proxies `/api` to the backend and attaches a token server-side. Company-authenticated mutations need a backend you control.

**Run your own backend:** copy the variable names from [.env.example](.env.example) into an ignored secret store. You need a Privy app with a business wallet owned by a key quorum, a separate agent signer key, a Sepolia RPC, an ENSv2 Sepolia namespace you control with the Kanon writer roles configured (see `apps/runner/src/ens-t6-write-probe.ts`), a PostgreSQL database, and two random tokens (`KANON_COMPANY_API_TOKEN` for the operator, `KANON_DEMO_API_TOKEN` for the public demo role). Start the services with:

```text
node --import tsx apps/api/src/server.ts
node --import tsx apps/runner/src/server.ts
```

Never put private keys, provider secrets, the company token or the demo token in browser (`VITE_`) variables, source control, logs or evidence files.

## Security boundary

- The company owns the Privy wallet through a key quorum. The runner holds only the agent's delegated signer key and never falls back to owner signing.
- Privy policy evaluation is the financial enforcement boundary. Kanon's own checks are defense in depth.
- If a term cannot be enforced by the selected Privy execution method, the compiler refuses to emit a policy.
- ENS records describe approved state; they never enforce wallet permissions. They are written only after the matching Privy change succeeds.
- The public proxy never forwards the company API token. Visitor requests carry a restricted demo credential that the API limits to the guided flow, capped terms and rate limits. Operator routes such as the full lifecycle proof are refused.

Details and reporting instructions: [SECURITY.md](SECURITY.md).

## Current limitations

- Sepolia testnet only. No mainnet deployment and no real funds.
- Not independently audited. Not a production custody or financial-operations system. No external users.
- The authority grammar is intentionally narrow: native ETH, one exact recipient, per-action and rolling value ceilings, optional calldata and validity constraints. ERC-20 assets and request-count limits fail closed.
- Privy aggregations are method-dependent and carry Privy's documented stateful-policy concurrency caveat.
- The hosted demo shares one wallet, signer and ENS name, so only one session can hold authority at a time.
- ENSv2 contracts on Sepolia are beta and may change before mainnet.
- The ENS namespace `kanon-ethonline-2026.eth` was registered during the original build and is reused unchanged so the verified records and permissions stay valid.
- Render free services sleep when idle. A scheduled workflow keeps them warm until 2026-10-03.

## Project history

Before September 11, 2026, Kanon existed only as written product notes; there was no code. Every line of code in this repository was written between September 12 and September 26, 2026, which is inside the 3rd-Web-Hack submission period (August 22 to September 27, 2026). The first commit is `09c187b` on September 12, and the Git history is unchanged.

The same build was also created for ETHOnline 2026. That first stage (September 12 to 14) produced the permission engine, Privy compiler, ENSv2 identity adapter, lifecycle API, runner and frontend.

The second stage (September 25 to 26) is the work that made Kanon a dependable, repeatable prototype for public judging in 3rd-Web-Hack:

- Fixed the workspace sticking on "API pending" with timed retries, a visible wake-up state and faster service start-up, plus a keep-warm workflow.
- Removed the company API token from the public proxy. Added a restricted demo role, a demo terms ceiling, rate limits and a proxy route allowlist.
- Added a session lease so abandoned sessions expire through the real revocation path. The flow now repeats without manually resetting the shared ENS fixture, and the operator proof writes its own ENS baseline after Privy authority is attached.
- Added allowed, forbidden and post-revocation execution to the UI with on-chain evidence, a twelve-step judge path, a live ENS record panel and a reject-update path.
- Added `pnpm smoke:live` and new tests for the demo guard, lease, proxy and new lifecycle transitions.

Records from the original build live in `evidence/` (for example `evidence/lifecycle/t11-t13-latest.json`). New release evidence lives in `evidence/3rd-web-hack/`.

## Repository map

```text
apps/web/            React frontend (workspace, judge path, evidence views)
api/kanon-proxy.ts   Vercel function: public proxy with demo credential and allowlist
apps/api/            lifecycle API, demo guard, session lease
apps/runner/         isolated delegated runner, live probes, smoke:live flow
packages/manifest/   release and manifest hashing
packages/permissions/ normalization, permissionHash, diff classification
packages/privy/      method-aware Privy policy compiler and adapter
packages/ens/        ENSv2 identity binding and protected record writes
packages/shared/     installation state machine, API contracts, database
tests/               Vitest suites
evidence/            non-secret proof records
docs/                judge brief, architecture, status, pitch deck, Devpost copy
```

## License

[MIT](LICENSE)
