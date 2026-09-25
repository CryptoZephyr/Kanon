# Kanon

Kanon is a business agent-control runtime for company-deployed financial AI agents. It joins a company-controlled ENSv2 identity with versioned, policy-enforced wallet authority through Privy.

The core promise is simple: an agent receives exactly the authority a human approves, and a software update cannot silently widen that authority.

[Live demo](https://kanon-agents.vercel.app) · [Deployment record](DEPLOYMENT.md) · [Submission brief](docs/submission.md) · [Implementation status](docs/implementation-status.md) · [Security boundary](SECURITY.md)

## Problem

Financial agents need enough wallet authority to act without a human signing every transaction. Broad wallet credentials create a second risk. A software update can also request more authority than the company approved for the original release.

Kanon gives the company a durable identity and an enforceable authority boundary for each agent release. Human approval stays attached to the exact normalized authority, release, package, and manifest identity.

## How it works

1. An agent release declares the capabilities it requests. The declaration never grants authority.
2. The company defines the operating terms that it is willing to grant.
3. Kanon normalizes those terms and computes a deterministic `permissionHash`.
4. A human approves the exact release and authority before activation.
5. Privy controls a delegated signer with the verified policy for the selected execution method.
6. ENSv2 records the company-controlled agent identity and approved public state under the Sepolia organization namespace.
7. Allowed actions execute through the delegated path. Forbidden actions are rejected by the policy path.
8. A broader, substituted, or unknown release waits for explicit reauthorization. Revocation removes delegated authority before the ENS status changes to `revoked`.

## Load-bearing integrations

Privy is the financial enforcement plane. The business wallet remains owner-controlled. The agent receives a separate signer and a signer-specific policy. Stateless restrictions are supported on `eth_sendTransaction`. Rolling native-value limits use the verified `eth_signTransaction` path with a Privy aggregation, then broadcast the signed transaction separately.

ENSv2 is the company-controlled identity and namespace plane. The ETHOnline proof uses the Sepolia hierarchy `kanon-ethonline-2026.eth`, `agents.kanon-ethonline-2026.eth`, and `representative-agent.agents.kanon-ethonline-2026.eth`. Protected records expose `kanon.agentId`, `kanon.release`, `kanon.permissionHash`, and `kanon.status`. ENSv2 records identity and approved public state. Privy enforces financial authority.

## Verified scope

The live proof is testnet-only and uses Ethereum Sepolia, chain ID `11155111`.

- The deployed frontend is live at [kanon-agents.vercel.app](https://kanon-agents.vercel.app).
- The live browser rehearsals completed create, company terms, human approval, Privy and ENS binding, allowed execution, forbidden rejection, update reauthorization, and revoke.
- The deployed T11 to T13 proof passed allowed execution, forbidden policy rejection, blocked pre-reauthorization expansion, Privy-first update ordering, signer removal, ENS revoked state, post-revoke failure, and unauthorized ENS restore rejection.
- Non-secret evidence is recorded in [evidence/deployment/t17-live-latest.json](evidence/deployment/t17-live-latest.json), [evidence/lifecycle/t11-t13-latest.json](evidence/lifecycle/t11-t13-latest.json), and [evidence/ens/t6-write-latest.json](evidence/ens/t6-write-latest.json).

The requested `kanon.agents.vercel.app` hostname is reserved for another Vercel account. The verified default alias is the live entry point.

## Clean checkout

Requirements: Node.js `22.23.2` and pnpm `11.5.0`.

```text
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
pnpm build:web
```

These commands run without sponsor credentials. Copy variable names from [.env.example](.env.example) only into an ignored local secret source when running provider-backed probes or a locally authenticated deployment. Never put private keys, provider secrets, or the company API token in browser variables, source control, logs, or public evidence.

The hosted demo is the simplest way to inspect the product. A local frontend can be started with `pnpm dev:web`, but company-authenticated mutations require an authorized backend environment and are intentionally unavailable from a clean checkout without those credentials.

## Current limitations

- The ENS identity and all recorded writes are on the authorized Sepolia namespace. No mainnet ENS write was made.
- The prototype has not been audited for production custody or financial operations.
- Privy aggregation behavior is method-dependent, and the documented stateful-policy concurrency caveat remains.
- Request-count limits, token assets, arbitrary conditions, and unsupported policy combinations fail closed.
- The Render free services can sleep after idle. Warm the API and runner before a live demo.
- A future proof run needs an explicit owner-authorized reset of the shared Sepolia fixture after a revoke proof.
- The repository is public under the [MIT License](LICENSE). The current proof remains Sepolia-only and is not a production custody deployment.

## Repository map

```text
apps/web/       approved frontend and server-side development proxy
apps/api/       company-authenticated lifecycle API
apps/runner/    isolated delegated runner and live proof probes
packages/       manifest, permission, Privy, ENSv2, and shared contracts
evidence/       selected non-secret proof records
docs/           public submission and implementation-status records
tests/          domain, policy, lifecycle, API-contract, and tooling tests
LICENSE         MIT license for reuse of the repository
```

The repository is a hackathon and testnet proof. Treat the security boundary and current implementation status as authoritative for the claims that can be made from this checkout.
