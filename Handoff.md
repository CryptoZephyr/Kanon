# Kanon Handoff

Canonical source: [Kanon Handoff in Notion](https://app.notion.com/p/3cac5381831281b89144d721a86c3d17).

## Current state

The repository is a fresh Kanon workspace. T0 setup and T1A are complete locally. The Privy feasibility spike is in progress. A live Sepolia Privy business wallet, separate owner quorum, agent signer, and signer-specific policy are configured. Allowed and forbidden signing probes pass, and the agent cannot perform an owner-level wallet update. The Privy wallet still needs testnet ETH before delegated broadcast, receipt, revoke, and post-revoke checks can run. No ENS write has been made.

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
- `pnpm test`: passed, 3 files and 15 tests.
- `pnpm lint`: passed.
- `pnpm format:check`: passed.
- `git diff --check`: passed.
- `.env.example` contains zero nonempty assignments.
- Local `.env.local` is ignored and `.env.example` remains trackable.
- Repository secret-pattern scan returned zero matches.

## Environment readiness

- Presence-only check found all eleven variables needed through T1A and the Privy spike non-empty.
- `.env.local` is ignored by Git.
- The configured ENS RPC returned Ethereum Sepolia chain ID `0xaa36a7`.
- The provisional Privy spike fixture is Ethereum Sepolia, chain ID `11155111`, native ETH, with the same public Sepolia RPC. Current official Privy documentation lists this network and native asset as supported. This is a spike fixture, not a finalized company-authority grammar.
- `ENS_ORG_NAMESPACE` remains unset because the namespace is selected during the later ENSv2 spike.
- No secret values were printed, committed, or added to project documentation.

## Security boundary retained

The runner must never receive organization owner or administrator authority. Agent authorization material remains a sensitive secret and must stay out of frontend code, logs, ordinary database fields, and committed files. Privy policy enforcement is authoritative for delegated financial actions. ENSv2 records describe approved identity state and do not enforce wallet permissions. Unsupported or ambiguous restrictions must fail closed.

## Corrected architecture order

The owner has decided that the final authority model must follow the real Privy enforcement surface. T1A defines only sponsor-independent domain identity and content hashes. The Privy feasibility spike then records enforceable and unavailable conditions. T1B freezes company terms, canonicalization, deterministic serialization, `permissionHash`, unsupported-condition behavior, and the policy-compiler contract from that evidence.

```text
T0 setup
-> T1A minimal agent/domain contract
-> Privy feasibility spike
-> T1B final authority model + permissionHash
-> T2 permission diff engine
-> Privy policy compiler
-> ENSv2 feasibility spike
-> combined installation lifecycle
```

The prior pre-Privy `permissionHash` decision gate is retired. No final authority semantics are being inferred in T1A.

## Risks and contradictions

- The live Privy spike has verified business-wallet ownership, an additional signer with an override policy, allowed signing, forbidden-recipient rejection, and rejection of an agent owner-level mutation. Broadcast, receipt, revoke, and post-revoke failure remain pending funding.
- The current Privy transaction API accepts numeric or hex `chain_id` values in the transaction payload, while policy examples express chain conditions as decimal strings. Treat this representation boundary as an adapter invariant and test it explicitly.
- The current `@privy-io/node` package exposes an aggregations resource type but the installed SDK surface does not expose aggregation CRUD methods. Stateful spend/rate policy work may require the documented REST endpoint or a later official SDK release. This remains a vendor-interface risk.
- The exact ENSv2 Sepolia registry, resolver, EAC, deployment, and ABI choices still require a live spike. ENS documents state that the contracts and interfaces are not final before mainnet.
- The canonical pages previously varied in build ordering. The owner has now resolved the contradiction: T1A comes before the Privy feasibility spike, and final authority semantics come after that evidence. Local `Build.md`, `Tasks.md`, and this handoff record that decision.
- The docs define the role of `permissionHash` but do not fix its canonical serialization, digest format, exact field inclusion, or treatment of wallet identity. Those choices are intentionally deferred to T1B.
- The initial Privy spike fixture is provisional. Current official Privy documentation lists Ethereum Sepolia, chain ID `11155111`, and native ETH support. The spike must verify the exact live policy behavior before any fixture becomes a supported authority grammar.
- The architecture names `apps/api` and a later web surface, while the required initial structure contains only `apps/runner` and the five packages. API and frontend work remain deferred as instructed.
- The live Notion pages report `unverified` page status. Their content was fetched as the current project source, but that metadata is not an independent approval signal.

## Privy feasibility spike record

- Provisional fixture: Ethereum Sepolia, chain ID `11155111`, native ETH, recipient `0x8b88E1E1174eDC65B08de75A5439f130da8A3DFd`, maximum value `1` wei.
- Live owner key quorum: `qnvqwminvphhhpjfn8d2xm1x`.
- Live agent signer key quorum: `sg2lc6vqtl2a7s2ibv7f2ca0`.
- Live Privy wallet: `daw18yxziq98ljz1t2hricvu`, address `0x42D5Fb257d479187607D47C19433Be6aEEd4a9A9`.
- Live signer override policy: `wrnwttls8sbespal81qv1ds9`.
- The wallet has no base policy and exactly one additional signer with the override policy. The company owner remains separate from the delegated agent signer.
- Delegated `eth_signTransaction` inside the fixture succeeded.
- Delegated signing to the forbidden recipient was rejected with HTTP `400` and `policy_violation`.
- The delegated agent's wallet update attempt was rejected with HTTP `401` and `invalid_data`, demonstrating that the agent does not hold owner authorization.
- Current feature evidence: chain, recipient, native asset, and value are live-proven. Contract/function and timing are documented by the current official API but not yet live-probed. Spending/rate is documented with the official stateful-policy concurrency caveat and has not yet been live-probed.
- No Privy transaction was broadcast, no receipt exists, and no signer revoke has been attempted because the Privy wallet balance is below the spike threshold of `0.002` Sepolia ETH.

## Exact repository state

The repository is initialized locally on branch `main` with no remote configured. The dependency lockfile is present. The committed checkpoint is `64bb577` (`docs: record privy spike funding gate`), and the working tree is clean. The repository contains the verified T1A domain foundation, the isolated Privy spike harness, the current `evidence/privy/t3-latest.json` partial result, and synchronized documentation edits. Live Privy resource identifiers are recorded in the evidence file. `.env.local` remains ignored and no secret value is present in tracked files. No ENS writes are present.

## Exact next action

Fund the separate Privy wallet at `0x42D5Fb257d479187607D47C19433Be6aEEd4a9A9` with at least `0.002` Sepolia ETH, then rerun `pnpm spike:privy`. Record delegated broadcast, receipt, owner-signed signer removal, post-revoke delegated failure, and the remaining contract/function, timing, and spending/rate evidence. Do not begin T1B, T2, policy compilation, ENS writes, or frontend work until the Privy evidence is sufficient.
