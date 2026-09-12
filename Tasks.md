# Kanon Tasks

Canonical source: [Kanon Tasks in Notion](https://app.notion.com/p/3cac5381831281068ce6dfdfa9369b1a).

## Setup checkpoint

### T0 - Bootstrap Kanon from zero code

Status: DONE

Scope for this phase:

- fresh local repository and required workspace structure;
- Node.js 22 and pnpm pinning;
- TypeScript, typechecking, tests, and linting;
- safe secret placeholders and ignore rules;
- official Privy MCP and Agent Skill;
- official ENS machine-readable docs and Context7 MCP configuration;
- no product logic, sponsor writes, API, or frontend design.

Acceptance evidence:

- [x] Fresh local repository initialized on `main`.
- [x] Node.js 22.23.2 and pnpm 11.5.0 pinned.
- [x] TypeScript, Vitest, ESLint, and Prettier configured.
- [x] Required workspace boundaries created with no product implementation.
- [x] Secret placeholders and ignore rules verified.
- [x] Official Privy MCP initialized, listed tools, and returned a live search result.
- [x] Official Privy Agent Skill installed and recorded in `skills-lock.json`.
- [x] Privy `llms.txt` and `skill.md` fallback endpoints returned successfully.
- [x] ENS `llms.txt` and `llms-full.txt` endpoints returned successfully.
- [x] Context7 MCP initialized, resolved `/ensdomains/docs`, and returned ENSv2 documentation.
- [x] `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, and `pnpm lint` passed.
- [x] Optional `pnpm format:check` and `git diff --check` passed.
- [x] No real secrets or product logic were added.

T0 is complete for this workspace. The exact build-order difference and vendor-interface risks remain recorded in `Handoff.md` and must be resolved at their gates.

## Critical path after setup

The owner-defined next phase is T1. The detailed task sequence is:

1. T1 - Agent manifest, company authority terms, and deterministic permission hash.
2. T2 - Permission diff engine.
3. T3 - Real Privy wallet-control spike.
4. T4 - Privy forbidden-action proof.
5. T5 - Privy policy compiler.
6. T6 - Real ENSv2 identity spike.
7. T7 - ENS identity adapter and approved-state binding.
8. T8 - Minimal installation state.
9. T9 - Company terms and human approval boundary.
10. T10 - Isolated runner.
11. T11 - Full activation end to end.
12. T12 - Permission-aware update.
13. T13 - Combined revoke lifecycle.
14. T14 - Backend and API contract freeze.
15. T15 - Owner frontend product-design handoff.
16. T16 - Public backend deployment.
17. T17 - Demo rehearsal and evidence freeze.
18. T18 - Submission artifacts.

The build-order variation described in `Handoff.md` is unresolved and must be decided explicitly before implementation crosses the affected gate.

## Never cut

Deterministic authority hashing, human approval, real Privy wallet control, restricted delegated signer behavior, real ENSv2 identity and permission evidence, isolated runner execution, allowed and forbidden action proof, update escalation blocking, real revoke, ENS revoked state, and post-revoke failure.

## Frontend gate

T15 is blocked by owner design. Do not invent layout, typography, components, dashboard structure, animation, or visual language.

## Next action

Once T0 is explicitly complete, start T1 only. Update this file and `Handoff.md` after each meaningful milestone, blocker, dependency change, or evidence result.
