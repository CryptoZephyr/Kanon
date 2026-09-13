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

The owner has resolved the build-order dependency. The detailed sequence is:

1. T1A - Minimal agent/domain contract.
2. T3 - Privy feasibility spike, including positive and negative enforcement evidence.
3. T1B - Final company terms and deterministic `permissionHash`.
4. T2 - Permission diff engine.
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

## Current execution

### 2026-09-12

- Setup environment presence check passed for every variable required by the current T1A and Privy spike configuration.
- `.env.local` is ignored by Git and the configured RPC responds as Ethereum Sepolia.
- T1A is DONE locally. It defines only sponsor-independent identity, manifest, provisional terms, provisional normalized-set types, `packageHash`, and `manifestHash`.
- T1B final `permissionHash` semantics and Privy-dependent authority fields are now frozen from the completed feasibility evidence.
- The initial Privy spike fixture is configured locally as Ethereum Sepolia, chain ID `11155111`, native ETH.
- A live Privy owner quorum, agent signer quorum, Sepolia business wallet, and signer-specific override policy now exist for T3. Base signing, forbidden-recipient, owner-boundary, delegated send, receipt, revoke, and post-revoke checks pass. No ENS write has been made.
- The separate live surface probe passes calldata function and argument restrictions, timing windows, and a rolling native-value cap. Request-count rate limiting is unsupported by the current aggregation model.
- T5 is now implemented locally as an execution-method-aware Privy policy compiler. `eth_sendTransaction` compiles only stateless controls. `eth_signTransaction` can compile rolling native-value aggregation references and returns the aggregation requirements needed before policy creation. A signed transaction is broadcast separately.
- The compiler rejects unsupported method and authority combinations with `UNSUPPORTED_POLICY_COMBINATION`, verifies the normalized permission hash before compiling, and never drops unsupported restrictions. The local T5 suite now passes 36 tests. No ENS write has been made.
- The live T5 compiler probe passed against Privy. The compiled stateless send policy rejected a forbidden `eth_sendTransaction` before broadcast. The compiled stateful sign policy allowed the first sign and rejected the next sign at the rolling cap. Temporary policies and aggregations were owner-signed and removed.
- The required Node.js `22.23.2` runtime was selected with the official portable distribution. `pnpm install`, `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm format:check`, and `git diff --check` pass under that runtime.

### T6 - Real ENSv2 identity spike

Status: DONE, Sepolia write/read/permission proof passed

Read-only feasibility is complete against the current official ENS documentation and the configured Context7 MCP library `/ensdomains/docs`.

- Ethereum Sepolia chain ID `11155111` is reachable through the configured ENS RPC.
- The configured ENS control wallet is `0x8b88E1E1174eDC65B08de75A5439f130da8A3DFd` and has Sepolia ETH.
- The current documented `ETHRegistrar`, `ETHRegistry`, `PermissionedResolverImpl`, `UniversalResolverV2`, and `VerifiableFactory` deployments all contain code on Sepolia.
- ENSv2 documents confirm hierarchical registries, per-account Permissioned Resolver proxies, and record-level EAC permissions. The contracts and interfaces remain beta and may change before mainnet.
- Read-only feasibility evidence is recorded in `evidence/ens/t6-feasibility-latest.json`.
- The exact owner-authorized parent `kanon-ethonline-2026.eth` was available on the Sepolia registrar and was registered with the configured control wallet.
- The live hierarchy is `kanon-ethonline-2026.eth` -> `agents.kanon-ethonline-2026.eth` -> `representative-agent.agents.kanon-ethonline-2026.eth`.
- UserRegistry proxies and a Permissioned Resolver proxy were deployed through the official Sepolia Verifiable Factory path.
- The four protected text records `kanon.agentId`, `kanon.release`, `kanon.permissionHash`, and `kanon.status` read back through Universal Resolver v2.
- The control wallet has scoped text-role administration and named text-writer roles for the four protected keys. The representative agent owner has no root text-writer role and its attempted rewrite was rejected by the resolver.
- Full transaction, hierarchy, record, normal-resolution, and unauthorized-writer evidence is recorded in `evidence/ens/t6-write-latest.json`.

T6 boundary and risks:

- This namespace is authorized for the Sepolia hackathon proof only. No production or mainnet ENS name was registered.
- ENSv2 contracts and interfaces remain beta and may change before mainnet. The deployed commit and addresses are recorded in the evidence file.
- ENSv2 records prove approved identity state and scoped record-writer behavior. They do not replace Privy financial policy enforcement.

### T7 - ENS identity adapter and approved-state binding

Status: DONE, live read verification and local write-gate tests passed

- `packages/ens/src/index.ts` normalizes ENS names and addresses, binds the organization, namespace, agent node, resolver, and control wallet, and validates the exact hierarchy.
- The adapter reads only `kanon.agentId`, `kanon.release`, `kanon.permissionHash`, and `kanon.status` through a supplied ENSv2 resolution transport.
- The adapter rejects resolver provenance or node mismatches and returns deterministic protected-record mismatches.
- Approved-state writes require an `APPROVED` or `ACTIVE` lifecycle, confirmed active Privy authority, and exact agent, release, and permission-hash equality. Revoked state and mismatched authorization fail closed.
- The write plan contains public approved-state records only. Company authority terms are not accepted or published by this adapter.
- `pnpm spike:ens:t7` verified the live Sepolia hierarchy, resolver, node, and four protected records without making another chain write.
- Evidence is recorded in `evidence/ens/t7-adapter-latest.json`.

Acceptance:

- The adapter read and verification path passed against the real T6 hierarchy.
- Local tests prove identity normalization, resolver provenance, exact record verification, lifecycle gating, and absence of company terms from the write plan.

### T8 - Minimal installation state

Status: DONE, local lifecycle proof passed

- `packages/shared/src/index.ts` defines the installation state, organization binding, exact release and permission-set identity, delegated Privy binding, verified ENS record state, execution evidence, and revocation evidence.
- `ACTIVE` requires an approved human decision, an active delegated Privy authority, a verified ENS approved or active state, matching agent and release identity, matching `permissionHash`, and matching authority generation.
- Owner credentials and owner-management fields are absent from the shared installation contract.
- Synthetic lifecycle evidence is recorded in `evidence/lifecycle/t8-t10-latest.json`.

Acceptance:

- Local tests prove that stale, revoked, unverified, and mismatched authority cannot become active.
- No chain write or live Privy mutation was performed by T8.

### T9 - Company terms and human approval boundary

Status: DONE, local approval and update-gating proof passed

- T9 consumes the final T1B normalized permission set. It does not redefine `permissionHash` or broaden the supported authority grammar.
- Human decisions are bound to the exact agent, release, package hash, manifest hash, and `permissionHash` they approve.
- Expanded authority is classified through the existing T2 diff engine and remains in `UPDATE_AVAILABLE` until an exact approved `REAUTHORIZE` decision is recorded.
- Reauthorization does not silently activate a new release. Authority reconfiguration remains a later activation step.
- Revocation records require delegated Privy loss, ENS revoked state, and failed post-revoke delegated execution before the installation can enter `REVOKED`.

Acceptance:

- Local tests prove exact approval binding, expanded-authority review, reauthorization gating, and incomplete-revocation rejection.
- The lifecycle proof records `EXPANDED`, `requiresHumanReview: true`, and `AWAITING_REAUTHORIZATION` without any external write.

### T10 - Isolated runner

Status: DONE, local delegated-only runner proof passed

- `apps/runner/src/isolated-runner.ts` creates an execution context only from an active installation.
- The runner re-reads installation state before every call and refuses non-active, revoked, stale-generation, mismatched-hash, mismatched-method, changed delegated wallet/signer/policy identity, or unverified work.
- The executor receives only the delegated wallet, delegated signer, policy, selected execution method, and request. There is no owner credential fallback.
- Allowed execution and forbidden-action rejection are represented as execution evidence. The runner refuses stale work before invoking the executor.
- `pnpm spike:lifecycle:t8-t10` writes `evidence/lifecycle/t8-t10-latest.json`.

Acceptance:

- The local T10 suite passes allowed delegated execution, forbidden-action rejection, owner-authority absence, and stale/revoked refusal checks.
- This is a synthetic adapter proof. T11 to T13 now provide the live activation, update reconfiguration, and combined revoke proof.

### T11 - Full activation end to end

Status: DONE, live Sepolia proof passed

- `pnpm spike:lifecycle:t11-t13` connected the lifecycle state machine to the live Privy wallet, signer-specific policy, stateful aggregation, ENSv2 resolver, Universal Resolver v2, and isolated delegated runner.
- Release A reused the verified T6 approved identity and `permissionHash`. The owner-approved decision moved the installation through `AWAITING_APPROVAL` and `CONFIGURING_AUTHORITY` before it became `ACTIVE`.
- Privy owner control attached the dedicated agent signer to the release-A policy. The wallet readback showed the signer-specific override, and the delegated `eth_signTransaction` path signed and broadcast an allowed 1 wei Sepolia transaction.
- ENS approved-state readback verified the exact agent ID, release ID, permission hash, and `approved` status before activation.
- The live T11 policy and aggregation identifiers, transaction hash, and state snapshots are recorded in `evidence/lifecycle/t11-t13-latest.json`.

Acceptance:

- [x] Human approval is bound to the exact release, package hash, manifest hash, and `permissionHash`.
- [x] Privy delegated authority is attached before the installation becomes active.
- [x] ENS approved state and Privy authority agree on agent, release, and permission identity.
- [x] Allowed delegated execution succeeds through the stateful signing path and separate broadcast.
- [x] No owner credential enters the runner context.

### T12 - Permission-aware update

Status: DONE, live approved update proof passed

- Release B changed the per-transaction and rolling native-value limits from `1` wei to `2` wei. T2 classified the change as `EXPANDED` and required human review.
- The lifecycle stopped at `AWAITING_REAUTHORIZATION` until the exact approved `REAUTHORIZE` decision for release B was present.
- The owner created and attached the release-B Privy policy and aggregation. The new delegated 2 wei action succeeded before the ENS approved-state update was written.
- Only after the new Privy authority succeeded did the company-controlled resolver update the four protected records. Universal Resolver v2 readback confirmed release B and its new `permissionHash`, and the active installation advanced to generation 1.
- The live T12 policy, aggregation, transaction, ENS writes, and readback are recorded in `evidence/lifecycle/t11-t13-latest.json`.
- Local lifecycle tests retain the old active state until the new authority and ENS state are configured. A provider-failure rollback attempt was not run as an additional live mutation and remains a follow-up risk for the API implementation.

Acceptance:

- [x] Expanded authority cannot activate without exact human reauthorization.
- [x] Privy authority is updated before ENS approved-state records.
- [x] The new permission hash is bound to the new release and generation.
- [x] The approved update succeeds through the verified stateful signing path.
- [x] Unsupported or failed authority changes remain fail closed in the local contract.

### T13 - Combined revoke lifecycle

Status: DONE, live Sepolia proof passed

- The owner-approved revoke decision moved the active installation into `REVOKING`.
- Owner control removed the delegated signer from the Privy wallet. Wallet readback showed zero additional signers, and a later delegated signing attempt failed with HTTP `401`.
- The authorized ENS resolver writer changed only `kanon.status` to `revoked`. The name and historical identity records remained resolvable.
- A representative agent owner attempted to restore `kanon.status=approved` and was rejected by the Permissioned Resolver. The final Universal Resolver v2 readback remained revoked.
- Policies and aggregations created for T11 and T12 were removed with owner-authorized operations. Evidence is recorded in `evidence/lifecycle/t11-t13-latest.json`.

Acceptance:

- [x] Delegated Privy authority is removed before the revoked installation is finalized.
- [x] Post-revoke delegated execution fails.
- [x] ENS resolves the persistent agent name with `kanon.status=revoked`.
- [x] The agent cannot restore protected ENS records.
- [x] No mainnet or production ENS write was performed.

### T14 - Backend/API contract freeze

Status: DONE, contract freeze passed

- `packages/shared/src/api-contracts.ts` freezes API contract version 1, company-authenticated `/v1` routes, success and fail-closed error envelopes, and stable request/resource types.
- The contract covers organization, wallet, ENS identity, agent capability, company terms, approval, active Privy authority, execution and revocation evidence, update diff, and revoke resources.
- Wallet and authority projections expose scoped public identifiers only. Private keys, secrets, owner credentials, owner quorum material, and policy-management authority are excluded.
- Active authority requires matching Privy and ENS generation, permission hash, and normal ENS readback. Update and revoke resources require matching proposal and decision evidence.
- No API server, frontend UI, layout, typography, component, dashboard, animation, or visual design work was added.

Acceptance:

- [x] Frontend can later consume stable domain data without changing core lifecycle behavior.
- [x] API contracts preserve human approval, Privy authority, ENS identity, evidence, update, and revoke boundaries.
- [x] Mismatched authority, readback, update, and revoke evidence fails closed.
- [x] Contract tests cover the versioned route surface, secret boundary, active authority, update, revoke, evidence, and error envelopes.

### T16 - Public backend deployment

Status: DONE, owner-authorized Render and Neon deployment with live lifecycle proof

The owner directed this deployment before the documented T15 frontend-design gate. Frontend work remains untouched.

- GitHub repository `https://github.com/CryptoZephyr/Kanon` is private and was created and pushed with GitHub CLI.
- Neon free project `kanon-ethonline-2026` uses PostgreSQL 18 in `aws-eu-central-1`, database `kanon`, branch `br-spring-block-b2xd3rlk`. The existing migration passed.
- Render free service `kanon-api` is live at `https://kanon-api.onrender.com`, service ID `srv-daj103tg1s2s7391ov3g`, deployment `dep-daj1ag8jo6nc73c13gmg`.
- Render free service `kanon-runner` is live at `https://kanon-runner.onrender.com`, service ID `srv-daj102fqj5pc73bs02r0`, deployment `dep-daj1ag8jo6nc73c13geg`.
- Both services use Node.js `22.23.2`, pnpm `11.5.0`, one free instance in Frankfurt, and reach Neon successfully through TLS.
- The runner is public because of the Render free-service topology. Its internal endpoint requires the application shared secret. Owner and ENS control credentials remain API-only, and the runner receives delegated execution material only.
- The API rejected an unauthenticated proof start with HTTP `401` and accepted a company-authenticated start with HTTP `202`.
- Remote run `51738841-b204-4c75-b58f-6d8897d8cc53` passed T11 to T13 through Render, Neon, Privy, ENSv2, and the isolated runner. The proof used `eth_signTransaction` for stateful limits, broadcast signed transactions separately, and removed temporary Privy policies and aggregations.
- The complete non-secret deployment record is `evidence/deployment/render-neon-latest.json`.

Acceptance:

- [x] API and runner are live on Render free services with public HTTPS health checks.
- [x] Neon migration and database health checks pass from both deployed services.
- [x] Secrets are stored in provider environment variables only and are absent from the repository.
- [x] Privy and ENSv2 are reachable from the deployed API path.
- [x] The deployed lifecycle proof covers allowed execution, forbidden rejection, human-gated expansion, Privy-before-ENS update, revoke, post-revoke failure, and unauthorized ENS restore rejection.
- [x] No paid upgrade, mainnet ENS write, or frontend change was made.

## Final verification checkpoint

Status: T11, T12, T13, T14, and the owner-authorized T16 deployment complete. The repository is on private GitHub remote `https://github.com/CryptoZephyr/Kanon` on branch `main`. `.env.local` is ignored and no secret value is tracked. The live lifecycle evidence is in `evidence/lifecycle/t11-t13-latest.json`, and the deployed proof summary is in `evidence/deployment/render-neon-latest.json`. T14 contract evidence is in `tests/api-contracts.t14.test.ts`.

- Node.js `22.23.2`, pnpm `11.5.0`, TypeScript `5.9.2`, ESLint `9.35.0`, Vitest `3.2.4`, and Prettier `3.6.2` are selected.
- `pnpm install --frozen-lockfile`: passed across all 7 workspace projects.
- `pnpm typecheck`: passed.
- `pnpm test`: passed, 9 files and 58 tests.
- `pnpm lint`: passed.
- `pnpm format:check`: passed.
- `git diff --check`: passed.
- Official Privy MCP, official Privy Agent Skill, Privy machine-readable fallback docs, ENS machine-readable docs, and Context7 `/ensdomains/docs` remain configured and verified.
- Render service health, Neon migration, private GitHub visibility, API authentication, and the remote lifecycle proof passed. Full deployment identifiers and evidence are in `evidence/deployment/render-neon-latest.json`.
- No frontend design or implementation was added. No mainnet or production ENS write was performed.

Deployment risk and sequence note:

- The first remote proof failed closed because the persistent ENS fixture was already revoked. The existing T6 setup probe restored the exact approved baseline before the successful run. Future proof runs need an explicit owner-authorized baseline reset before starting.
- The current documented list places T15 before T16, while this owner-authorized deployment was completed ahead of that order. Review the numbering before T17 planning. T15 remains the exact next action and the frontend stays untouched.

### T1A - Minimal agent/domain contract

Status: DONE

Allowed scope:

- stable agent/release identity;
- agent-declared capability manifest;
- provisional company authority terms and normalized permission set types;
- deterministic package/content hash and manifest hash;
- explicit separation between requested capability and company-granted terms.

Deferred until Privy evidence:

- final `permissionHash` serialization and digest;
- exact authority field inclusion and wallet identity treatment;
- recipient, contract/function, asset/value, spend/rate, and validity semantics;
- unsupported-condition behavior and policy compiler contract.

Acceptance:

- T1A tests prove the domain separation and hash inputs without claiming enforcement.
- T1A does not create a Privy policy, wallet, signer, ENS record, or final permission hash.

### T1B - Final company terms and deterministic permission hash

Status: DONE

Implemented in `packages/permissions/src/index.ts` and covered by `tests/permissions.t1b.test.ts`.

- final terms use `kanon.company-authority-terms` version `2`;
- supported rules cover Ethereum chain, native asset, exact recipient, per-transaction value, proven calldata constraints, inclusive validity windows, and rolling native-value `sum` limits;
- canonical normalization lowercases EVM addresses, canonicalizes decimal quantities, deduplicates and sorts rules, and rejects unknown fields;
- `permissionHash` is `sha256:` plus lowercase hexadecimal SHA-256 over canonical UTF-8 JSON of final company terms only;
- release identity, package and manifest hashes, wallet identity, signer identity, policy IDs, aggregation IDs, and transaction IDs remain separate binding inputs;
- token assets, request-count limits, arbitrary conditions, and ambiguous inputs fail closed;
- the compiler must accept one explicit execution method per plan. It emits only that method and rejects unsupported method and authority combinations.

### T2 - Permission diff engine

Status: DONE

Implemented in `packages/permissions/src/index.ts` and covered by `tests/permissions.t1b.test.ts`.

- `NO_CHANGE` requires identical normalized company terms, regardless of release-only identity changes;
- `NARROWER` requires every next rule to be provably covered by a previous rule, with no reverse coverage;
- `EXPANDED` requires the reverse coverage relationship, with no next-to-previous coverage;
- `SUBSTITUTED` requires equal rule counts, equal limit signatures, and changed scope fields such as chain, recipient, calldata, or validity window;
- `UNKNOWN` is returned for forged permission hashes, invalid normalized sets, mixed or incomparable limits, and every relationship that cannot be proven;
- `EXPANDED`, `SUBSTITUTED`, and `UNKNOWN` require human review. `NARROWER` and `NO_CHANGE` do not.
- The result includes both permission hashes and deterministic changed paths for review evidence.

### T3 - Real Privy wallet-control spike

Status: DONE

The spike used a real business wallet, a narrow policy, a dedicated signer with a signer-specific override policy, a separate runner process, one allowed financial action, one clearly forbidden action, and a revoke check. It records real wallet, policy, and signer identifiers and proves the runner has no owner-level authority. The fixture is Ethereum Sepolia native ETH for this feasibility evidence.

Current evidence:

- live wallet `daw18yxziq98ljz1t2hricvu` at `0x42D5Fb257d479187607D47C19433Be6aEEd4a9A9`;
- live owner quorum `qnvqwminvphhhpjfn8d2xm1x` and agent signer quorum `sg2lc6vqtl2a7s2ibv7f2ca0` are separate;
- live override policy `wrnwttls8sbespal81qv1ds9` covers Ethereum Sepolia, the approved recipient, and native value `<= 1` wei;
- allowed delegated signing succeeds;
- forbidden-recipient signing is rejected with `400 policy_violation`;
- agent owner-level wallet update is rejected with `401 invalid_data`;
- live calldata probe allows `ping(7)` to the probe target and rejects `ping(8)` and `pong()`;
- live timing probe allows the current window and rejects a future-only window;
- live rolling-value aggregation allows the first 1 wei sign and rejects the subsequent 1 wei sign;
- the current aggregation model exposes `sum` over extracted values and does not provide a request-count rate condition;
- the Privy wallet was funded with `0.002` Sepolia ETH from the configured development wallet, and the funding transaction is recorded in `Handoff.md`;
- delegated `eth_sendTransaction` succeeded with transaction hash `0x89fd33dc562cb97339cbfc6a4f3bb02cc597e9746dbb52ac3e5ad1c0e2cefe50` and receipt status `success`;
- the owner removed the agent signer and a post-revoke delegated signing attempt was rejected with HTTP `401`;
- the official stateful-policy concurrency caveat remains material even though the sequential rolling-value probe passed;
- the exact feature evidence is in `evidence/privy/t3-surface-latest.json`;

### T5 - Privy policy compiler

Status: DONE, GATE PASSED

- compile only the final `CompanyAuthorityTerms` grammar into method-specific Privy policy conditions;
- require an explicit `eth_sendTransaction` or `eth_signTransaction` compiler input and emit one method per plan;
- attach signer-specific overrides without granting owner-level authority;
- use owner-controlled stateful aggregation only for rolling-value limits on `eth_signTransaction`;
- broadcast signed transactions separately when the stateful path is selected;
- reject rolling limits on `eth_sendTransaction`, missing aggregation IDs, token assets, request-count limits, arbitrary conditions, ambiguous ABI inputs, and every unsupported field;
- fail closed when a policy cannot faithfully represent the normalized permission set, with no application-only fallback.

T5 verification:

- `eth_sendTransaction` stateless compilation passes for chain, recipient, native value, calldata, and validity conditions;
- `eth_signTransaction` stateful compilation passes with an explicit aggregation reference and deterministic aggregation requirement;
- rolling authority plus `eth_sendTransaction` fails with `UNSUPPORTED_POLICY_COMBINATION`;
- missing aggregation IDs, forged permission hashes, and ambiguous ABI types fail closed;
- `pnpm typecheck` passes and `pnpm test` passes with 6 files and 43 tests.
- `pnpm spike:privy:compiler` passes against the live Sepolia Privy wallet. Evidence is recorded in `evidence/privy/t5-compiler-latest.json`.
- `pnpm spike:ens:t7` passes against the live Sepolia ENSv2 hierarchy. Evidence is recorded in `evidence/ens/t7-adapter-latest.json`.
- `pnpm spike:lifecycle:t8-t10` passes the local installation, approval, update-gating, and isolated-runner proof. Evidence is recorded in `evidence/lifecycle/t8-t10-latest.json`.

- T11, T12, and T13 are complete against the live Sepolia fixtures. T11 allowed execution, T12 required and completed exact reauthorization before the expanded authority and ENS update, and T13 removed the signer, proved post-revoke rejection, resolved ENS as revoked, and rejected an unauthorized restore. Evidence is recorded in `evidence/lifecycle/t11-t13-latest.json`.

## Never cut

Deterministic authority hashing, human approval, real Privy wallet control, restricted delegated signer behavior, real ENSv2 identity and permission evidence, isolated runner execution, allowed and forbidden action proof, update escalation blocking, real revoke, ENS revoked state, and post-revoke failure.

## Frontend gate

T15 is blocked by owner design. Do not invent layout, typography, components, dashboard structure, animation, or visual language.

## Next action

T11, T12, T13, T14, and the owner-authorized T16 deployment are complete. The exact next action is T15, wait for the owner product-design handoff. Keep the frontend untouched until that design is supplied, keep both free Render services warm for any demo proof, and keep all ENS work on the authorized Sepolia namespace only.
