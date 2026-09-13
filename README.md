# Kanon

Kanon is a business agent-control runtime for company-deployed financial AI agents. It joins a company-controlled ENSv2 identity with versioned, policy-enforced wallet authority through Privy.

The core promise is simple: an agent receives exactly the authority a human approves, and a software update cannot silently widen that authority.

This checkout has completed environment setup, the sponsor-independent T1A domain foundation, the live Privy feasibility spike, T1B final authority normalization, T2 permission diffing, the execution-method-aware Privy policy compiler, the authorized Sepolia ENSv2 proof, the ENS identity adapter, the T8 to T10 installation and runner boundaries, the live T11 to T13 activation, update, and revoke proof, and the T14 backend/API contract freeze. The API server and frontend implementation remain gated by the ordered build plan.

## Canonical documentation

The live Kanon documentation is maintained in the [Kanon Notion workspace](https://app.notion.com/p/3cac5381831281e3951beffb5758a9c4). The local operational records are:

- [Handoff.md](Handoff.md)
- [Tasks.md](Tasks.md)
- [Build.md](Build.md)
- [AI_TOOLING.md](AI_TOOLING.md)
- [FRONTEND.md](FRONTEND.md)

The Notion pages remain authoritative when a local pointer and the live page differ.

## Repository shape

```text
apps/
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
pnpm install
pnpm typecheck
pnpm test
pnpm lint
```

No real secrets belong in this repository. Copy the names in `.env.example` into an ignored local secret source only when a later implementation task requires them.

## Frontend gate

Frontend implementation stays untouched until the owner supplies the Kanon product design. No layout, typography, component system, dashboard structure, animation, or visual language is chosen in this phase.
