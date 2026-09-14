# Kanon implementation status

This page separates verified behavior from local tests, known limits, and future work. It is a public summary of the current checkout and does not contain provider secrets or owner credentials.

## Live and verified

- Frontend: [https://kanon-agents.vercel.app](https://kanon-agents.vercel.app), deployed on Vercel.
- Backend: Render API and runner services with Neon PostgreSQL, connected through the server-side API boundary.
- Network: Ethereum Sepolia, chain ID `11155111`.
- ENSv2 namespace: `kanon-ethonline-2026.eth` with the representative agent identity beneath the `agents` subname.
- Privy: delegated signer, signer-specific policy, allowed execution, forbidden rejection, signer removal, and post-revoke failure were verified.
- Lifecycle: activation, permission-aware update, reauthorization, ENS approved-state synchronization, revoke, and unauthorized restore rejection were verified.
- Browser rehearsals: three clean create-to-revoke runs reached active generation 1 and revoked generation 2.

Evidence records:

- [T17 deployment and browser evidence](../evidence/deployment/t17-live-latest.json)
- [T11 to T13 lifecycle evidence](../evidence/lifecycle/t11-t13-latest.json)
- [ENSv2 write and permission evidence](../evidence/ens/t6-write-latest.json)
- [Privy compiler evidence](../evidence/privy/t5-compiler-latest.json)

## Tested locally

The following commands pass from a clean dependency install:

```text
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
pnpm build:web
```

The local suite covers the domain contract, deterministic permission hashing, permission diffs, method-aware policy compilation, ENS identity binding, lifecycle gates, the isolated runner, API contracts, and tooling smoke checks.

## Known limitations and blockers

- This is a Sepolia hackathon proof, not a mainnet or production custody deployment.
- No open-source license has been selected for the repository. Reuse rights are not granted until the owner chooses and adds a license.
- The exact `kanon.agents.vercel.app` alias is reserved for another Vercel account. The verified default Vercel alias is used.
- Render free services can sleep after idle.
- The persistent ENS fixture needs an explicit owner-authorized baseline reset before repeating a full activation-to-revoke proof.
- The negative provider-failure rollback variant for the update API remains future integration work.

## Future work

- Select and publish the repository license.
- Decide whether the private GitHub repository should become public.
- Add a public demo recording and final submission artifacts.
- Add the provider-failure rollback integration test.
- Revisit stronger production operational controls after the testnet proof.
