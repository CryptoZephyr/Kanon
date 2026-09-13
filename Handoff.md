# Kanon Handoff

Canonical source: [Kanon Handoff in Notion](https://app.notion.com/p/3cac5381831281b89144d721a86c3d17).

## Current state

The repository is a complete Kanon workspace. T0 setup, T1A, the Privy feasibility spike, T1B, T2, T5, T6, T7, T8, T9, T10, T11, T12, T13, and T14 are complete locally, with T11 to T13 proven against the live Sepolia fixtures. T6 has a real Sepolia ENSv2 write/read/permission proof under the owner-authorized namespace `kanon-ethonline-2026.eth`. T7 binds that live identity to a vendor-specific adapter with fail-closed resolver and approved-state checks. T8 and T9 bind installation state, exact human approval, delegated Privy authority, and verified ENS state. T10 proves a delegated-only runner that refuses stale or revoked work before execution. A live Sepolia Privy business wallet, separate owner quorum, agent signer, and signer-specific policy are configured. Allowed and forbidden signing probes pass, the agent cannot perform an owner-level wallet update, live surface probes cover calldata function and argument restrictions, timing windows, and rolling native-value limits, and the funded delegated send, receipt, revoke, and post-revoke checks pass. T1B freezes a conservative authority grammar and deterministic `permissionHash` from that evidence. T2 classifies authority changes with proof-backed coverage. T5 makes the compiler execution-method aware. T11 proves activation and allowed delegated execution, T12 proves human-gated authority expansion before the ENS update, T13 proves signer removal, post-revoke rejection, ENS revoked state, and unauthorized restore rejection, and T14 freezes the versioned backend/API data contract without adding frontend assumptions. The owner-authorized Render and Neon deployment is also live and has passed the complete remote lifecycle proof. It was performed ahead of the documented T15 then T16 ordering so the backend proof could be completed while the frontend remains untouched.

Kanon is a business agent-control runtime. Privy is the financial-authority plane. ENSv2 is the company-controlled identity and namespace plane. A manifest declares requested capability, the company defines final terms, a human approves the exact normalized authority, and the active delegated signer operates only within the verified Privy policy.

## Configured in this phase

- Node.js 22.23.2 pin files and engine constraints.
- pnpm 11.5.0 with a workspace manifest.
- TypeScript, ESLint, Vitest, and Prettier baseline configuration.
- Required `apps/runner`, package boundaries, and `examples/agents`.
- `.gitignore`, `.npmrc`, and names-only `.env.example`.
- Isolated live Privy surface probe command and safe evidence output under `evidence/privy/`.
- Final T1B authority normalization and deterministic `permissionHash` implementation under `packages/permissions/`.
- T2 permission diff engine with deterministic classifications and changed-path evidence under `packages/permissions/`.
- T5 Privy policy compiler under `packages/privy/`. It emits one explicit execution method per plan. Stateless rules compile for `eth_sendTransaction`. Rolling native-value aggregation compiles only for `eth_signTransaction`, with a separate signed-transaction broadcast boundary.
- T5 live compiler probe under `apps/runner/src/privy-policy-compiler-probe.ts`, with namespaced command `pnpm spike:privy:compiler` and non-secret evidence under `evidence/privy/t5-compiler-latest.json`.
- T6 read-only ENSv2 feasibility evidence under `evidence/ens/t6-feasibility-latest.json`.
- T6 live ENSv2 write/read/permission proof under `evidence/ens/t6-write-latest.json` and `apps/runner/src/ens-t6-write-probe.ts`.
- The exact Sepolia namespace `kanon-ethonline-2026.eth`, its `agents` subregistry, and `representative-agent` subname are controlled and resolved through the verified hierarchy.
- T7 ENS identity adapter under `packages/ens/src/index.ts`, with live read verification under `apps/runner/src/ens-t7-read-probe.ts` and evidence under `evidence/ens/t7-adapter-latest.json`.
- T8 and T9 installation lifecycle contracts under `packages/shared/src/index.ts`, including exact human-decision binding, active authority gates, update reauthorization gating, and revocation evidence requirements.
- T10 isolated runner under `apps/runner/src/isolated-runner.ts`, with local proof coverage for delegated success, forbidden-action rejection, owner-authority absence, and stale or changed delegated-authority refusal.
- T8 to T10 lifecycle proof command `pnpm spike:lifecycle:t8-t10` and non-secret evidence under `evidence/lifecycle/t8-t10-latest.json`.
- T11 to T13 live lifecycle proof command `pnpm spike:lifecycle:t11-t13` and non-secret evidence under `evidence/lifecycle/t11-t13-latest.json`.
- T14 versioned backend/API contract under `packages/shared/src/api-contracts.ts`, with route, resource, request, response, and fail-closed constructor tests under `tests/api-contracts.t14.test.ts`.
- The live lifecycle probe uses `eth_signTransaction` for stateful limits, broadcasts the signed transaction separately, and keeps owner policy and aggregation management outside the runner.
- Official Privy documentation MCP configuration.
- Official Privy Agent Skill at `.claude/skills/privy/SKILL.md`.
- Privy `llms.txt` and `skill.md` fallback references.
- ENS `llms.txt` and `llms-full.txt` references.
- Context7 MCP configuration for `/ensdomains/docs` use.
- Private GitHub repository `https://github.com/CryptoZephyr/Kanon`, created and pushed with GitHub CLI.
- Neon free PostgreSQL project `kanon-ethonline-2026` in `aws-eu-central-1`, database migration applied successfully.
- Render free services `kanon-api` and `kanon-runner`, both using Node.js `22.23.2`, with public HTTPS health endpoints.
- Render service configuration in `render.yaml`, reconciled to the actual native-Node services and separate start commands.
- Deployed proof summary in `evidence/deployment/render-neon-latest.json`, with no secret values.

## Documentation tooling status

The official Privy MCP was reachable and returned MCP initialization, tool discovery, and a live documentation search for owners, additional signers, policies, and signer removal. The official Privy skill was installed from `https://docs.privy.io` and recorded by `skills-lock.json`.

The official ENS machine-readable files were reachable. The Context7 MCP endpoint was reachable, resolved `ensdomains/docs` to `/ensdomains/docs`, and returned current ENSv2 registry and permission documentation. No ENS Agent Skill was installed or represented as official.

## Verification passed

- Node.js: `v22.23.2` was selected and verified with the official Node portable distribution. The runtime is installed under the user-local Kanon toolchain and is first in the user-level PATH for new shells. The repository pin and engine constraint remain `v22.23.2`.
- pnpm: `11.5.0`.
- `pnpm install --frozen-lockfile`: passed across all 7 workspace projects.
- `pnpm typecheck`: passed.
- `pnpm test`: passed under Node `v22.23.2`, 9 files and 58 tests.
- `pnpm lint`: passed.
- `pnpm format:check`: passed.
- `git diff --check`: passed.
- `pnpm spike:privy:surface`: passed all three live surface probes and restored the baseline signer policy.
- `pnpm spike:privy`: passed delegated signing, forbidden-action rejection, delegated send, receipt confirmation, signer revoke, and post-revoke rejection.
- `pnpm spike:privy:compiler`: passed method-aware stateless-send rejection and stateful-sign aggregation enforcement. Temporary policies and aggregations were removed with owner-signed requests, and the wallet returned to its pre-probe empty-signer state.
- `pnpm spike:ens:t6`: passed exact-label availability, Sepolia registration, control-wallet ownership, nested UserRegistry deployment, Permissioned Resolver deployment, protected record writes, Universal Resolver v2 readback, scoped company-writer success, and representative-agent writer rejection.
- `pnpm spike:ens:t7`: passed live ENS identity binding, node and resolver provenance, four protected-record readback, and no-write verification against the T6 hierarchy.
- `pnpm spike:lifecycle:t8-t10`: passed the local installation, approval, update-gating, and isolated-runner proof. The evidence records no chain writes, no secrets, and no frontend changes.
- `pnpm spike:lifecycle:t11-t13`: passed the live Sepolia activation, permission-aware update, and combined revoke proof. T11 allowed execution and receipt confirmation. T12 recorded an `EXPANDED` diff, required exact reauthorization, succeeded with the new Privy authority before four ENS record updates, and read the new state back. T13 removed all additional signers, received HTTP `401` on the later delegated request, wrote `kanon.status=revoked`, read the persistent name back, and rejected the representative-agent restore attempt. T11 and T12 policies and aggregations were removed with owner-authorized operations.
- T14 contract tests: passed the versioned company-authenticated route surface, resource projections, secret boundary, active-authority binding, ENS readback, update diff, revoke request and evidence, installation aggregate, and success/error envelopes.
- T1B tests: passed authority normalization, stable serialization, hash separation, and fail-closed unsupported-condition checks.
- T2 tests: passed all five classifications, human-review flags, changed paths, and forged-set fail-closed behavior.
- `.env.example` contains zero nonempty assignments.
- Local `.env.local` is ignored and `.env.example` remains trackable.
- Repository secret-pattern scan returned zero matches.
- GitHub CLI verified the private repository and local/remote commit parity.
- Render proof deployments `dep-daj1ag8jo6nc73c13gmg` for the API and `dep-daj1ag8jo6nc73c13geg` for the runner reached `live` on the free plan. The stable current identifiers are the service IDs recorded above.
- `https://kanon-api.onrender.com/healthz` returned API and Neon database `ok`.
- `https://kanon-runner.onrender.com/healthz` returned runner and Neon database `ok`.
- The public API rejected an unauthenticated proof start with HTTP `401` and accepted a company-authenticated start with HTTP `202`.
- Remote lifecycle run `51738841-b204-4c75-b58f-6d8897d8cc53` passed T11, T12, and T13 through Render, Neon, Privy, ENSv2, and the isolated runner. All temporary Privy policies and aggregations were deleted.

## Environment readiness

- Presence-only check found all eleven variables needed through T1A and the Privy spike non-empty.
- `.env.local` is ignored by Git.
- The configured ENS RPC returned Ethereum Sepolia chain ID `0xaa36a7`.
- The provisional Privy spike fixture is Ethereum Sepolia, chain ID `11155111`, native ETH, with the same public Sepolia RPC. Current official Privy documentation lists this network and native asset as supported. This is a spike fixture, not a finalized company-authority grammar.
- `ENS_ORG_NAMESPACE=kanon-ethonline-2026.eth` is configured in ignored `.env.local` for the authorized Sepolia proof.
- No secret values were printed, committed, or added to project documentation.
- The deployed services received secrets through Render environment variables only. The public runner receives delegated execution credentials and the application shared secret, but no owner or ENS control credentials.

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
-> T8 installation state
-> T9 human approval boundary
-> T10 isolated runner
-> T11 full activation proof
-> T12 permission-aware update
-> T13 combined revoke lifecycle
-> T14 backend and API contract freeze
```

The prior pre-Privy `permissionHash` decision gate is retired. No final authority semantics are being inferred in T1A.

## Risks and contradictions

- The live Privy spike has verified business-wallet ownership, an additional signer with an override policy, allowed signing, forbidden-recipient rejection, rejection of an agent owner-level mutation, delegated broadcast, receipt success, signer removal, and post-revoke delegated failure. The separate surface evidence has also verified calldata function and argument restrictions, timing windows, and a rolling native-value cap.
- The current Privy transaction API accepts numeric or hex `chain_id` values in the transaction payload, while policy examples express chain conditions as decimal strings. Treat this representation boundary as an adapter invariant and test it explicitly.
- The current `@privy-io/node` package exposes an aggregations resource type but the installed SDK surface does not expose aggregation CRUD methods. Stateful spend/rate policy work may require the documented REST endpoint or a later official SDK release. This remains a vendor-interface risk.
- The live surface probe used the documented REST aggregation endpoint because `@privy-io/node@0.34.0` has no aggregation CRUD methods. The rolling value cap passed, but the current aggregation model exposes `sum` over extracted values, so request-count rate limits remain unsupported and must not be represented as enforceable company terms.
- Privy aggregation/reference controls are method-dependent. The compiler therefore rejects rolling authority on `eth_sendTransaction`. For `eth_signTransaction`, it requires an owner-controlled aggregation ID and emits the aggregation creation requirement. The signed transaction must be broadcast in a separate step.
- The installed SDK has no aggregation CRUD methods, so the T5 probe uses the documented REST endpoint. Aggregation deletion requires an owner authorization signature. The adapter now uses the official Privy authorization-signature primitive for cleanup and must keep aggregation management outside the runner.
- The exact ENSv2 Sepolia registry, resolver, EAC, deployment, and ABI path has been verified read-only. ENS documents state that the contracts and interfaces are not final before mainnet.
- The owner authorized a fresh Sepolia `.eth` namespace with the exact label `kanon-ethonline-2026`. Availability was `true` before the registrar commit, and the completed write proof registered `kanon-ethonline-2026.eth` to the configured control wallet.
- T6 established `agents.kanon-ethonline-2026.eth` and `representative-agent.agents.kanon-ethonline-2026.eth`, deployed the official UserRegistry and Permissioned Resolver proxies, and wrote the four protected Kanon records.
- T6 normal resolution returned all four protected records through Universal Resolver v2. Only the control wallet received named text-writer roles. The representative agent owner has no root text-writer role, and a simulated resolver write from that address reverted without changing `kanon.status`.
- T6 used Sepolia MockUSDC for registrar payment and no mainnet or production ENS write was performed. The complete transaction evidence is in `evidence/ens/t6-write-latest.json`.
- The canonical pages previously varied in build ordering. The owner has now resolved the contradiction: T1A comes before the Privy feasibility spike, and final authority semantics come after that evidence. Local `Build.md`, `Tasks.md`, and this handoff record that decision.
- T1B now fixes `permissionHash` as `sha256:` plus lowercase hexadecimal SHA-256 over canonical UTF-8 JSON of the normalized final company terms. Object keys are sorted, equivalent rules are deduplicated and sorted, decimal quantities are canonical strings, and EVM recipients are lowercase.
- The permission hash excludes agent/release/package/manifest identity and Privy wallet, signer, policy, quorum, aggregation, and transaction identifiers. Those values are bound separately by the installation and approval records, so unchanged authority can remain unchanged across a software release.
- The final authority grammar is deliberately limited to Ethereum transaction rules with a positive chain ID, native ETH, one exact recipient, a per-transaction value ceiling, optional proven calldata function and exact named-argument constraints, optional inclusive Unix validity boundaries, and optional rolling native-value `sum` limits.
- ERC-20 or other token assets, request-count limits, arbitrary conditions, ambiguous ABI inputs, and unknown fields fail closed. Rolling-value aggregation remains subject to Privy's documented concurrency caveat.
- T2 treats any relationship it cannot prove from normalized rules as `UNKNOWN`. This includes mixed rolling-limit direction, malformed sets, and future authority fields not covered by the current grammar.
- The architecture names `apps/api` and a later web surface, while the required initial structure contains only `apps/runner` and the five packages. API and frontend work remain deferred as instructed.
- The live Notion pages report `unverified` page status. Their content was fetched as the current project source, but that metadata is not an independent approval signal.
- The T11 to T13 live proof uses owner-controlled Sepolia resources and leaves the ENS agent name persistent with `kanon.status=revoked`. The negative T12 provider-failure rollback variant remains a follow-up integration test for the API layer. The local lifecycle contract keeps the old active state until the new authority and ENS state are both configured.
- The first remote lifecycle attempt failed closed because the persistent ENS fixture was already in the terminal `revoked` state from an earlier run. The existing T6 setup probe restored the exact approved release-A state, after which the remote proof passed. The proof is therefore not repeatable from its terminal state without an explicit, owner-authorized ENS baseline reset. This is an implementation risk for a future production API and must be handled as a controlled fixture reset, not an implicit broadening or record overwrite.
- Render's free topology requires the runner to be a separate public web service. Application-level shared-secret authentication protects its internal endpoint, and both services can sleep when idle. Warm both endpoints before a demo. This is a deployment limitation, not a replacement for Privy policy enforcement.
- The Neon connection uses TLS. The current `pg` runtime reports that `sslmode=require` is treated as `verify-full` today and warns that future major versions will follow standard libpq semantics. Set the production connection value explicitly to `sslmode=verify-full` before upgrading the PostgreSQL client.
- The owner deployment directive placed backend deployment before the documented T15 frontend-design gate and T16 deployment item. The owner instruction is recorded as authoritative for this run. The documented sequence should be reviewed before T17 planning so the task numbering does not imply that deployment is still pending.

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
- The Privy compiler accepts a normalized permission set, owner ID, policy label, and explicit execution method. It emits one method per plan, verifies the permission hash, and rejects every unsupported method and authority combination with `UNSUPPORTED_POLICY_COMBINATION`. It never widens, approximates, drops a restriction, or replaces Privy enforcement with an application-only check.

## T5 policy compiler record

- `eth_sendTransaction` plans compile only stateless chain, recipient, native-value, calldata, and validity conditions.
- `eth_signTransaction` plans compile the same stateless conditions plus owner-controlled rolling native-value aggregation references when an explicit aggregation ID is supplied.
- The aggregation plan uses Privy's `sum` metric over `ethereum_transaction.value`, a rolling window, and chain plus recipient filters. The runner does not receive owner credentials or aggregation-management authority.
- Rolling authority combined with `eth_sendTransaction`, missing aggregation IDs, extra aggregation IDs, forged hashes, and ambiguous ABI inputs fail closed. No compiler output is produced for those combinations.
- T5 verification passed under Node `v22.23.2` with 5 test files and 36 tests. The live probe passed against Privy and wrote `evidence/privy/t5-compiler-latest.json`.

## T2 permission diff record

- `NO_CHANGE` requires identical normalized company terms and does not require human review for release-only identity changes.
- `NARROWER` and `EXPANDED` use proof-backed rule coverage. Rolling-value coverage requires the next maximum to be no greater and its window to be no shorter for a narrower result.
- `SUBSTITUTED` requires equal rule counts and matching limit signatures with changed scope fields such as chain, recipient, calldata, or validity window.
- `UNKNOWN` is fail-closed for forged permission hashes, invalid normalized sets, incomparable constraints, and any relationship outside the proven comparison rules.
- The diff result carries both permission hashes and deterministic changed paths. `EXPANDED`, `SUBSTITUTED`, and `UNKNOWN` require human review.

## T14 backend/API contract freeze

Status: DONE.

- `packages/shared/src/api-contracts.ts` freezes API contract version 1, company-authenticated `/v1` routes, stable request/resource types, success responses, and fail-closed errors.
- The contract covers organization, wallet, ENS identity, agent capability, company terms, approval, active authority, execution and revocation evidence, update diff, and revoke resources.
- Active authority requires matching Privy and ENS generation, permission hash, and normal ENS readback. Update and revoke resources require matching proposal and decision evidence.
- Wallet and authority projections exclude private keys, secrets, owner credentials, owner quorum material, and policy-management authority.
- No API server or frontend implementation was added. The next phase is blocked on the owner product-design handoff.

## Exact repository state

The repository is on branch `main` with the private remote `https://github.com/CryptoZephyr/Kanon`. The dependency lockfile is present. The current working tree contains the verified T1A domain foundation, final T1B authority model, T2 permission diff engine, T5 execution-method-aware Privy compiler, T6 ENSv2 write probe, T7 ENS identity adapter, T8 and T9 lifecycle contracts, T10 isolated runner, T11 to T13 live lifecycle probe, the T14 API contract module and tests, Render and Neon deployment configuration, deployment evidence, read-only documentation evidence, live Privy and ENS write/read/permission evidence, isolated Privy spike harnesses, lifecycle evidence, and synchronized documentation edits. `.env.local` remains ignored and no secret value is present in tracked files. All ENS writes remain within the owner-authorized Sepolia hackathon namespace. T11 and T12 updated only the protected records through the authorized company writer. T13 changed only `kanon.status` to `revoked`; the persistent identity records remain readable. No mainnet or production ENS write was performed. The final verification commit and local/remote parity are recorded after the last documentation update.

## Exact next action

T11, T12, T13, T14, and the owner-authorized Render and Neon deployment are complete. The exact next action is T15, wait for the owner product-design handoff. Keep the frontend untouched until that design is supplied, keep both services warm for any demo proof, and keep all ENS work on the authorized Sepolia namespace only.
