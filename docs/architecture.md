# Kanon architecture

Kanon separates four things that are usually mixed together: wallet ownership, delegated agent authority, application state and autonomous execution. No long-running agent process holds the organization's owner authority.

## Components

```text
                       ┌─────────────────────────────┐
  Browser  ───────────►│ Vercel: static React app    │
                       │ + api/kanon-proxy.ts        │
                       └──────────────┬──────────────┘
                                      │ x-kanon-demo-token (server-side only)
                                      ▼
                       ┌─────────────────────────────┐        ┌──────────────┐
                       │ Kanon API (Render)          │◄──────►│ Neon Postgres│
                       │ roles, lifecycle, decisions │        └──────────────┘
                       │ permission engine, compiler │
                       │ ENS writer, session lease   │
                       └───┬───────────┬─────────────┘
          owner-signed     │           │ company writer role
          policy changes   ▼           ▼
                 ┌────────────────┐  ┌───────────────────────────────────┐
                 │ Privy          │  │ ENSv2 on Sepolia                  │
                 │ business wallet│  │ kanon-ethonline-2026.eth          │
                 │ owner: quorum  │  │  └ agents.…  (user registry)      │
                 │ agent signer + │  │     └ representative-agent.…      │
                 │ override policy│  │        Permissioned Resolver:     │
                 └───────▲────────┘  │        kanon.agentId / release /  │
                         │           │        permissionHash / status    │
       delegated signing │           └───────────────────────────────────┘
                 ┌───────┴────────┐
                 │ Isolated runner│  holds only the agent signer key
                 │ (Render)       │  re-reads installation before each run
                 └────────────────┘
```

| Component     | Path                   | Responsibility                                                                                                                                    |
| ------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manifest      | `packages/manifest`    | Parses a release, canonicalizes it, derives `packageHash` and `manifestHash`. Never grants authority.                                             |
| Permissions   | `packages/permissions` | Normalizes company terms, computes `permissionHash`, classifies release changes.                                                                  |
| Privy adapter | `packages/privy`       | Compiles normalized terms into a Privy policy for one explicit execution method, manages aggregations, attaches and removes the delegated signer. |
| ENS adapter   | `packages/ens`         | Binds the agent name, writes and reads the four protected records, refuses writes that would overstate authority.                                 |
| Shared        | `packages/shared`      | Installation state machine, human decisions, evidence types, versioned API contracts, database access.                                            |
| API           | `apps/api`             | HTTP lifecycle, role checks, demo guard, session lease, asynchronous authority configuration.                                                     |
| Runner        | `apps/runner`          | Delegated execution only; refuses stale, revoked or mismatched authority.                                                                         |
| Web           | `apps/web`             | Judge-facing workspace.                                                                                                                           |
| Proxy         | `api/kanon-proxy.ts`   | Public entry point; adds the restricted demo credential and enforces a route allowlist.                                                           |

## Authority lifecycle

```text
VALIDATED → AWAITING_APPROVAL → CONFIGURING_AUTHORITY → ACTIVE
ACTIVE → UPDATE_AVAILABLE → AWAITING_REAUTHORIZATION → ACTIVE (generation + 1)
UPDATE_AVAILABLE → ACTIVE            (human rejects the broader release)
ACTIVE → REVOKING → REVOKED
```

- **Activation.** After the human approval is recorded, the API creates the Privy aggregation and policy, attaches the delegated signer, then writes the ENS records and reads them back. `ACTIVE` is stored only after both succeed. If any step fails, the API rolls back to the previous Privy policy and ENS state.
- **Update.** A new release plus company terms is normalized and diffed against the active record. `EXPANDED`, `SUBSTITUTED` and `UNKNOWN` require a new human decision bound to the new `permissionHash`. On approval, Privy changes first; ENS changes after Privy confirms.
- **Revocation.** The owner removes the delegated signer, the API confirms zero signers, checks that the runner refuses the old authority, then writes `kanon.status = revoked`. The ENS name is kept for history.

## Permission model

Company terms (`kanon.company-authority-terms` v2) are a finite set of rules. Each rule has a chain ID, native asset, one exact recipient, a per-transaction ceiling, and optionally calldata function/argument constraints, a validity window and a rolling native-value limit. `permissionHash` is `sha256:` over the canonical JSON of the normalized terms. It excludes release identity and vendor IDs, which are bound separately by the approval record, so an unchanged authority keeps the same hash across releases.

The Privy compiler emits one execution method per plan. Stateless rules can use `eth_sendTransaction`. Rolling limits require an owner-controlled aggregation and the `eth_signTransaction` path, with the signed transaction broadcast separately. Unsupported combinations return `UNSUPPORTED_POLICY_COMBINATION` and no policy is created.

## Trust boundaries

| Holder                  | Has                                                                               | Never has                                                |
| ----------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Browser                 | Public resources and the demo UI                                                  | Any provider secret, the company token or the demo token |
| Vercel proxy            | Demo token                                                                        | Company token, Privy or ENS keys                         |
| API                     | Company token check, Privy owner credential, ENS writer key, runner shared secret | Agent signer key                                         |
| Runner                  | Agent signer key, runner shared secret                                            | Owner credential, ENS writer key                         |
| ENS agent owner address | Name ownership under the company registry                                         | Writer role on the protected records                     |

## Public demo boundary (3rd-Web-Hack release)

The hosted demo is open to anyone, so it is treated as an untrusted client:

- **Roles.** `x-kanon-company-token` → operator (full access). `x-kanon-demo-token` → demo role, set only by the proxy. The proxy strips any visitor-supplied token headers.
- **Route allowlist.** The demo role can read, publish releases, define terms, approve, reauthorize, run the two execution scenarios, reject an update and revoke. It cannot start the operator lifecycle proof or call anything else.
- **Terms ceiling.** One rule, Sepolia, native ETH, recipient equal to the organization's control wallet, per-action and rolling ceilings between 1 and 1000 wei, rolling window 60 to 86400 seconds, no calldata or validity window.
- **Execution scenarios.** Callers pick `ALLOWED` (1 wei to the approved recipient) or `FORBIDDEN` (1 wei to a fixed address outside the policy). They cannot choose targets.
- **Rate limits.** Per-client and global limits on mutations and executions.
- **Session lease.** One session holds the shared signer and ENS name. A new activation is refused with the remaining wait time while another session is fresh. Sessions idle for 20 minutes are expired through the normal revocation path, recorded with `decidedBy: demo-operator-session-expiry-policy`. Rows that can no longer be revoked normally are retired only after Privy reports zero delegated signers.

## Deployment

| Piece              | Where                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------- |
| Frontend and proxy | Vercel project `kanon-agents`, [kanon-agents.vercel.app](https://kanon-agents.vercel.app)     |
| API                | Render `kanon-api`, [kanon-api.onrender.com](https://kanon-api.onrender.com/healthz)          |
| Runner             | Render `kanon-runner`, [kanon-runner.onrender.com](https://kanon-runner.onrender.com/healthz) |
| Database           | Neon PostgreSQL                                                                               |
| Chain              | Ethereum Sepolia                                                                              |

See [DEPLOYMENT.md](../DEPLOYMENT.md) for the current deployment record.
