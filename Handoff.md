# Kanon Handoff

Canonical source: [Kanon Handoff in Notion](https://app.notion.com/p/3cac5381831281b89144d721a86c3d17).

## Current state

The repository is a fresh zero-code Kanon workspace. The setup phase is complete. Product logic has not started.

Kanon is a business agent-control runtime. Privy is the financial-authority plane. ENSv2 is the company-controlled identity and namespace plane. A manifest declares requested capability, the company defines final terms, a human approves the exact normalized authority, and the active delegated signer operates only within the verified Privy policy.

## Configured in this phase

- Node.js 22.23.2 pin files and engine constraints.
- pnpm 11.5.0 with a workspace manifest.
- TypeScript, ESLint, Vitest, and Prettier baseline configuration.
- Required `apps/runner`, package boundaries, and `examples/agents`.
- `.gitignore`, `.npmrc`, and names-only `.env.example`.
- Official Privy documentation MCP configuration.
- Official Privy Agent Skill at `.claude/skills/privy/SKILL.md`.
- Privy `llms.txt` and `skill.md` fallback references.
- ENS `llms.txt` and `llms-full.txt` references.
- Context7 MCP configuration for `/ensdomains/docs` use.

## Documentation tooling status

The official Privy MCP was reachable and returned MCP initialization, tool discovery, and a live documentation search for owners, additional signers, policies, and signer removal. The official Privy skill was installed from `https://docs.privy.io` and recorded by `skills-lock.json`.

The official ENS machine-readable files were reachable. The Context7 MCP endpoint was reachable, resolved `ensdomains/docs` to `/ensdomains/docs`, and returned current ENSv2 registry and permission documentation. No ENS Agent Skill was installed or represented as official.

## Verification passed

- Node.js: `v22.23.2`.
- pnpm: `11.5.0`.
- `pnpm install --frozen-lockfile`: passed across all 7 workspace projects.
- `pnpm typecheck`: passed.
- `pnpm test`: passed, 1 file and 1 test.
- `pnpm lint`: passed.
- `pnpm format:check`: passed.
- `git diff --check`: passed.
- `.env.example` contains zero nonempty assignments.
- Local `.env.local` is ignored and `.env.example` remains trackable.
- Repository secret-pattern scan returned zero matches.

## Security boundary retained

The runner must never receive organization owner or administrator authority. Agent authorization material remains a sensitive secret and must stay out of frontend code, logs, ordinary database fields, and committed files. Privy policy enforcement is authoritative for delegated financial actions. ENSv2 records describe approved identity state and do not enforce wallet permissions. Unsupported or ambiguous restrictions must fail closed.

## Risks and contradictions

- The exact current Privy API and SDK shape for business wallets, policies, additional signers, override policies, and signer removal still requires a live implementation spike.
- The exact ENSv2 Sepolia registry, resolver, EAC, deployment, and ABI choices still require a live spike. ENS documents state that the contracts and interfaces are not final before mainnet.
- The canonical pages vary in build ordering. `Tasks.md` and the owner instruction put manifest, company terms, and deterministic `permissionHash` immediately after setup. `Build.md` prioritizes the Privy and ENSv2 spikes before the permission model, while `Agents.md` and the detailed task IDs put domain types and the permission engine first. This phase follows the owner instruction and records the difference for explicit resolution.
- The docs define the role of `permissionHash` but do not yet fix its canonical serialization, digest format, exact field inclusion, or treatment of wallet identity. Those choices belong to the next phase and must not be guessed here.
- The architecture names `apps/api` and a later web surface, while the required initial structure contains only `apps/runner` and the five packages. API and frontend work remain deferred as instructed.
- The live Notion pages report `unverified` page status. Their content was fetched as the current project source, but that metadata is not an independent approval signal.

## Exact repository state

The repository is initialized locally on branch `main` with no remote configured. The dependency lockfile is present and the working tree is clean after the setup commit. There are no wallet IDs, policy IDs, signer IDs, ENS deployment identifiers, transaction receipts, private keys, or product implementation files in this checkout.

## Exact next action

After this setup phase is explicitly accepted, begin the next phase only:

`T1 - Manifest + company-defined terms + deterministic permissionHash.`

Start by defining the separate agent-declared capability and company-defined authority types. Do not begin Privy wallet creation, ENSv2 writes, API construction, or frontend implementation in that phase until the deterministic permission contract is reviewed.
