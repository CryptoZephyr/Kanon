# Kanon Handoff

Canonical source: [Kanon Handoff in Notion](https://app.notion.com/p/3cac5381831281b89144d721a86c3d17).

## Current state

The repository is a fresh Kanon workspace. T0 setup, T1A, the Privy feasibility spike, and T1B are complete locally. A live Sepolia Privy business wallet, separate owner quorum, agent signer, and signer-specific policy are configured. Allowed and forbidden signing probes pass, the agent cannot perform an owner-level wallet update, live surface probes cover calldata function and argument restrictions, timing windows, and rolling native-value limits, and the funded delegated send, receipt, revoke, and post-revoke checks pass. T1B now freezes a conservative authority grammar and deterministic `permissionHash` from that evidence. No ENS write has been made.

Kanon is a business agent-control runtime. Privy is the financial-authority plane. ENSv2 is the company-controlled identity and namespace plane. A manifest declares requested capability, the company defines final terms, a human approves the exact normalized authority, and the active delegated signer operates only within the verified Privy policy.

## Configured in this phase

- Node.js 22.23.2 pin files and engine constraints.
- pnpm 11.5.0 with a workspace manifest.
- TypeScript, ESLint, Vitest, and Prettier baseline configuration.
- Required `apps/runner`, package boundaries, and `examples/agents`.
- `.gitignore`, `.npmrc`, and names-only `.env.example`.
- Isolated live Privy surface probe command and safe evidence output under `evidence/privy/`.
- Final T1B authority normalization and deterministic `permissionHash` implementation under `packages/permissions/`.
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
- `pnpm test`: passed, 4 files and 22 tests.
- `pnpm lint`: passed.
- `pnpm format:check`: passed.
- `git diff --check`: passed.
- `pnpm spike:privy:surface`: passed all three live surface probes and restored the baseline signer policy.
- `pnpm spike:privy`: passed delegated signing, forbidden-action rejection, delegated send, receipt confirmation, signer revoke, and post-revoke rejection.
- T1B tests: passed authority normalization, stable serialization, hash separation, and fail-closed unsupported-condition checks.
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

- The live Privy spike has verified business-wallet ownership, an additional signer with an override policy, allowed signing, forbidden-recipient rejection, rejection of an agent owner-level mutation, delegated broadcast, receipt success, signer removal, and post-revoke delegated failure. The separate surface evidence has also verified calldata function and argument restrictions, timing windows, and a rolling native-value cap.
- The current Privy transaction API accepts numeric or hex `chain_id` values in the transaction payload, while policy examples express chain conditions as decimal strings. Treat this representation boundary as an adapter invariant and test it explicitly.
- The current `@privy-io/node` package exposes an aggregations resource type but the installed SDK surface does not expose aggregation CRUD methods. Stateful spend/rate policy work may require the documented REST endpoint or a later official SDK release. This remains a vendor-interface risk.
- The live surface probe used the documented REST aggregation endpoint because `@privy-io/node@0.34.0` has no aggregation CRUD methods. The rolling value cap passed, but the current aggregation model exposes `sum` over extracted values, so request-count rate limits remain unsupported and must not be represented as enforceable company terms.
- The exact ENSv2 Sepolia registry, resolver, EAC, deployment, and ABI choices still require a live spike. ENS documents state that the contracts and interfaces are not final before mainnet.
- The canonical pages previously varied in build ordering. The owner has now resolved the contradiction: T1A comes before the Privy feasibility spike, and final authority semantics come after that evidence. Local `Build.md`, `Tasks.md`, and this handoff record that decision.
- T1B now fixes `permissionHash` as `sha256:` plus lowercase hexadecimal SHA-256 over canonical UTF-8 JSON of the normalized final company terms. Object keys are sorted, equivalent rules are deduplicated and sorted, decimal quantities are canonical strings, and EVM recipients are lowercase.
- The permission hash excludes agent/release/package/manifest identity and Privy wallet, signer, policy, quorum, aggregation, and transaction identifiers. Those values are bound separately by the installation and approval records, so unchanged authority can remain unchanged across a software release.
- The final authority grammar is deliberately limited to Ethereum transaction rules with a positive chain ID, native ETH, one exact recipient, a per-transaction value ceiling, optional proven calldata function and exact named-argument constraints, optional inclusive Unix validity boundaries, and optional rolling native-value `sum` limits.
- ERC-20 or other token assets, request-count limits, arbitrary conditions, ambiguous ABI inputs, and unknown fields fail closed. Rolling-value aggregation remains subject to Privy's documented concurrency caveat.
- The architecture names `apps/api` and a later web surface, while the required initial structure contains only `apps/runner` and the five packages. API and frontend work remain deferred as instructed.
- The live Notion pages report `unverified` page status. Their content was fetched as the current project source, but that metadata is not an independent approval signal.

## Privy feasibility spike record

- Provisional fixture: Ethereum Sepolia, chain ID `11155111`, native ETH, recipient `0x8b88E1E1174eDC65B08de75A5439f130da8A3DFd`, maximum value `1` wei.
- Live owner key quorum: `qnvqwminvphhhpjfn8d2xm1x`.
- Live agent signer key quorum: `sg2lc6vqtl2a7s2ibv7f2ca0`.
- Live Privy wallet: `daw18yxziq98ljz1t2hricvu`, address `0x42D5Fb257d479187607D47C19433Be6aEEd4a9A9`.
- Live signer override policy: `wrnwttls8sbespal81qv1ds9`.
- Funding transaction: `0x420bca4b1942023ef98c554cced32b76f266c3d2d2e78a0f67790c848475f18f`, `0.002` Sepolia ETH from `0x8b88E1E1174eDC65B08de75A5439f130da8A3DFd`.
- The wallet has no base policy and exactly one additional signer with the override policy. The company owner remains separate from the delegated agent signer.
- Delegated `eth_signTransaction` inside the fixture succeeded.
- Delegated signing to the forbidden recipient was rejected with HTTP `400` and `policy_violation`.
- The delegated agent's wallet update attempt was rejected with HTTP `401` and `invalid_data`, demonstrating that the agent does not hold owner authorization.
- Current feature evidence: chain, recipient, native asset, and value are live-proven in `evidence/privy/t3-latest.json`. The separate `evidence/privy/t3-surface-latest.json` records live proof for contract/function and argument matching, timing windows, and a rolling native-value cap. The official stateful-policy caveat remains material because aggregation values are updated after signing and concurrent requests can race. Request-count rate limiting is unsupported by the current aggregation model.
- The delegated transaction `0x89fd33dc562cb97339cbfc6a4f3bb02cc597e9746dbb52ac3e5ad1c0e2cefe50` was accepted and its receipt status was `success`.
- The owner removed the agent signer, reducing the signer count from one to zero. A later delegated signing attempt was rejected with HTTP `401`, proving post-revoke loss of delegated authority.
- Request-count rate limiting remains unsupported by the current Privy aggregation model and must be excluded from the final company-authority grammar.

## T1B authority model record

- Final company terms are `kanon.company-authority-terms` version `2` with a finite normalized `authority.rules` set.
- `permissionHash` represents only the exact normalized company-granted authority. It does not represent the agent request, package content, release identity, or vendor resource IDs.
- `NormalizedPermissionSet` carries the stable release source separately and includes the derived `permissionHash`.
- The future Privy compiler must accept a normalized permission set plus owner ID and policy label, emit only the two verified execution methods, and reject every field or condition outside this grammar. It must never widen, approximate, or replace Privy enforcement with an application-only check.

## Exact repository state

The repository is initialized locally on branch `main` with no remote configured. The dependency lockfile is present. The current local `HEAD` is the clean T1B checkpoint `d315ef9`, and the repository contains the verified T1A domain foundation, the final T1B authority model, the isolated Privy spike harness, `evidence/privy/t3-latest.json`, `evidence/privy/t3-surface-latest.json`, and synchronized documentation edits. Live Privy resource identifiers are recorded in the evidence files. `.env.local` remains ignored and no secret value is present in tracked files. No ENS writes are present.

## Exact next action

Begin T2. Implement the permission diff engine over the final normalized authority sets. Preserve human review for `EXPANDED`, `SUBSTITUTED`, and `UNKNOWN`, and keep the Privy compiler and ENSv2 spike behind their ordered gates. Do not begin frontend work.
