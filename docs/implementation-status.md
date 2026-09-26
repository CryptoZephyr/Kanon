# Kanon implementation status

What is live, what is tested locally, what is limited, and what is future work. Release: 3rd-Web-Hack (`v0.3.0`).

## Live and verified on Sepolia

- Frontend and proxy: [kanon-agents.vercel.app](https://kanon-agents.vercel.app).
- API and runner on Render, Neon PostgreSQL.
- Full judge flow through the public proxy, twice in a row, the second starting from the revoked fixture with no manual reset: release registration, company terms, human approval, Privy policy and delegated signer, ENS record readback, allowed transaction, forbidden rejection by Privy, `EXPANDED` update blocked, reauthorization to generation 1, revocation with signer removal and ENS `revoked`, post-revoke rejection. Evidence: [run 1](../evidence/3rd-web-hack/live-judge-flow-run-1.json), [run 2](../evidence/3rd-web-hack/live-judge-flow-run-2.json).
- Public demo boundary: company token absent from Vercel; operator routes refused; out-of-bounds demo terms refused. See [DEPLOYMENT.md](../DEPLOYMENT.md#live-checks).
- From the original build: ENSv2 namespace, registry and resolver setup with an unauthorized-writer rejection ([evidence](../evidence/ens/t6-write-latest.json)); Privy compiler probes ([evidence](../evidence/privy/t5-compiler-latest.json)); operator lifecycle proof including unauthorized ENS restore rejection ([evidence](../evidence/lifecycle/t11-t13-latest.json)).

## Tested locally

```text
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
pnpm build:web
```

The suite covers manifest hashing, permission normalization and diffing, the method-aware policy compiler, ENS identity binding, lifecycle transitions (including update withdrawal and authority retirement), the isolated runner, API contracts, the demo guard (roles, route allowlist, terms ceiling, rate limits, execution targets), the session lease, and the proxy header and route policy.

## Implemented but not exercised live

- The retirement fallback for stale sessions that cannot be revoked normally. No such rows existed at deployment; the path is covered by unit tests.
- The operator lifecycle proof's self-written ENS baseline. The code path is in place; the proof was not re-run in this release.

## Known limitations

- Sepolia testnet only. No mainnet deployment, no audit, no production custody, no external users.
- Narrow authority grammar: native ETH, one exact recipient per rule, per-action and rolling value ceilings, optional calldata and validity constraints. ERC-20 assets and request-count limits fail closed.
- Privy aggregations carry Privy's documented stateful-policy concurrency caveat.
- The hosted demo shares one wallet, signer and ENS name, so one session holds authority at a time.
- In-memory rate limits reset when the API restarts.
- ENSv2 on Sepolia is beta.
- Render free services sleep when idle; keep-warm runs until 2026-10-03.

## Future work

- Quorum approval for large authority changes.
- ERC-20 stablecoin terms.
- Per-organization wallets and ENS namespaces.
- Provider-failure rollback integration tests for updates.
- Independent security review before any mainnet use.
