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
- Final `permissionHash` semantics and Privy-dependent authority fields are deferred until the Privy feasibility spike.
- The initial Privy spike fixture is configured locally as Ethereum Sepolia, chain ID `11155111`, native ETH.
- A live Privy owner quorum, agent signer quorum, Sepolia business wallet, and signer-specific override policy now exist for T3. Base signing, forbidden-recipient, and owner-boundary checks pass. No transaction has been broadcast and no ENS write has been made.
- The separate live surface probe passes calldata function and argument restrictions, timing windows, and a rolling native-value cap. Request-count rate limiting is unsupported by the current aggregation model.
- The current local `HEAD` is the committed checkpoint containing the surface-probe harness and evidence. No remote is configured.

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

Status: BLOCKED BY T3

Start only after the Privy feasibility evidence defines the enforceable authority surface.

### T2 - Permission diff engine

Status: BLOCKED BY T1B

Required classifications are `NO_CHANGE`, `NARROWER`, `EXPANDED`, `SUBSTITUTED`, and `UNKNOWN`. Expanded, substituted, and unknown authority changes must require human review.

### T3 - Real Privy wallet-control spike

Status: IN PROGRESS, BLOCKING FOR T1B

The spike will use a real business wallet, a narrow policy, a dedicated signer with a signer-specific override policy, a separate runner process, one allowed financial action, one clearly forbidden action, and a revoke check. It must record real wallet, policy, and signer identifiers and prove the runner has no owner-level authority. The initial test fixture is provisional Ethereum Sepolia native ETH, subject to live verification.

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
- the wallet needs at least `0.002` Sepolia ETH before send, receipt, revoke, and post-revoke checks can run;
- the official stateful-policy concurrency caveat remains material even though the sequential rolling-value probe passed;
- the exact feature evidence is in `evidence/privy/t3-surface-latest.json`;

## Never cut

Deterministic authority hashing, human approval, real Privy wallet control, restricted delegated signer behavior, real ENSv2 identity and permission evidence, isolated runner execution, allowed and forbidden action proof, update escalation blocking, real revoke, ENS revoked state, and post-revoke failure.

## Frontend gate

T15 is blocked by owner design. Do not invent layout, typography, components, dashboard structure, animation, or visual language.

## Next action

Fund `0x42D5Fb257d479187607D47C19433Be6aEEd4a9A9` with at least `0.002` Sepolia ETH, rerun `pnpm spike:privy`, and record send, receipt, revoke, and post-revoke evidence. The enforcement surface is recorded in `evidence/privy/t3-surface-latest.json`. Keep T1B blocked until the funded wallet checks pass and the unsupported rate condition is excluded from the authority grammar.
