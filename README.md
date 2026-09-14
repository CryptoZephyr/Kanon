# Kanon

Kanon is a business agent-control runtime for company-deployed financial AI agents. It joins a company-controlled ENSv2 identity with versioned, policy-enforced wallet authority through Privy.

The core promise is simple: an agent receives exactly the authority a human approves, and a software update cannot silently widen that authority.

This checkout has completed environment setup, the sponsor-independent T1A domain foundation, the live Privy feasibility spike, T1B final authority normalization, T2 permission diffing, the execution-method-aware Privy policy compiler, the authorized Sepolia ENSv2 proof, the ENS identity adapter, the T8 to T10 installation and runner boundaries, the live T11 to T13 activation, update, and revoke proof, the T14 backend/API contract freeze, the approved T15 frontend implementation, and the owner-authorized T16 deployment. The frontend reads the deployed API through a server-side development proxy. The complete create, authority, approval, active, update, reauthorization, and revoke flow has passed against Render, Neon, Privy, ENSv2, and the isolated runner.

## Canonical documentation

The live Kanon documentation is maintained in the [Kanon Notion workspace](https://app.notion.com/p/3cac5381831281e3951beffb5758a9c4). The local operational records are:

- [Handoff.md](Handoff.md)
- [Tasks.md](Tasks.md)
- [Build.md](Build.md)
- [DEPLOYMENT.md](DEPLOYMENT.md)
- [AI_TOOLING.md](AI_TOOLING.md)
- [FRONTEND.md](FRONTEND.md)

The Notion pages remain authoritative when a local pointer and the live page differ.

## Repository shape

```text
apps/
  web/
  runner/
packages/
  manifest/
  permissions/
  privy/
  ens/
  shared/
examples/
  agents/
```

## Baseline

The project is pinned to Node.js 22.23.2 and pnpm 11.5.0. From a clean checkout, use a Node.js 22 runtime and run:

```text

For the approved frontend, run `pnpm dev:web`. The Vite proxy targets the deployed API and attaches `KANON_COMPANY_API_TOKEN` only in the server-side development process. Approval and reauthorization return `202` while authority configuration runs, so the client polls until the installation settles. Never expose that value through a `VITE_` variable or committed file.
pnpm install
pnpm typecheck
pnpm test
pnpm lint
```

No real secrets belong in this repository. Copy the names in `.env.example` into an ignored local secret source only when a later implementation task requires them.

## Frontend

The owner-approved frontend is live at `https://kanon-agents.vercel.app` with the exact approved logo, one landing page, six application screens, and a server-side Vercel proxy to the deployed API. The requested `kanon.agents.vercel.app` alias is reserved for another Vercel account. Keep the visual system locked to [FRONTEND.md](FRONTEND.md). The remaining milestone is alias resolution, demo rehearsal, and evidence freeze. See [DEPLOYMENT.md](DEPLOYMENT.md) for the production proxy boundary.
