# Kanon Build Order

Canonical source: [Kanon Build in Notion](https://app.notion.com/p/3cec53818312818da7bcef56a9e2c46d).

## Current phase

T0 setup, T1A, the Privy feasibility spike, T1B, T2, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, and T17 are complete. T6 proved the owner-authorized Sepolia ENSv2 hierarchy and protected writer path. T7 proved the identity adapter and approved-state binding. T8 and T9 define the fail-closed installation and human-approval boundaries. T10 proves that the runner receives delegated authority only and refuses stale or revoked work. T11 proves live activation and allowed delegated execution. T12 proves human-gated authority expansion, Privy-first update ordering, and ENS readback. T13 proves delegated signer removal, post-revoke failure, revoked ENS state, and unauthorized restore rejection. T14 freezes the versioned backend/API data contract. T15 implements the owner-approved frontend, T16 deploys the backend, and T17 verifies the Vercel proxy and three browser rehearsals. T18 submission artifacts are next.

## Exact post-setup order

The owner has resolved the dependency ordering. The next sequence is T1A, the Privy feasibility spike, T1B, then the remaining implementation gates:

```text
T1A minimal agent/domain contract
-> T3 Privy feasibility spike and forbidden-action proof
-> T1B final company terms + permissionHash
-> T2 permission diff
-> T5 Privy policy compiler
-> T6 ENSv2 identity spike
-> T7 ENS adapter + approved-state binding
-> T8 installation state
-> T9 approval boundary
-> T10 isolated runner
-> T11 activation proof
-> T12 permission-aware update
-> T13 revoke lifecycle
-> T14 API contract freeze
-> T15 owner product-design handoff
-> T16 deployment
-> T17 rehearsal
-> T18 submission
```

The final authority model was frozen only after the Privy feasibility spike. T1B excludes request-count limits, token assets, vendor resource identity, and unsupported conditions. T2 returns `UNKNOWN` for any authority relationship it cannot prove. T1A remains sponsor-independent and does not grant authority.

T5 makes the selected Privy method explicit. Stateless controls compile for `eth_sendTransaction`. Rolling native-value aggregation compiles only for `eth_signTransaction`, with a separate broadcast step for the signed transaction. Unsupported method and authority combinations fail closed.

T8 and T9 keep installation state, exact release and permission identity, human decisions, Privy delegated authority, and verified ENS approved state bound together. Expanded, substituted, or unknown authority changes remain behind explicit reauthorization. T10 snapshots that binding into an isolated runner context and passes no owner credential or owner-management field to the executor. T11 to T13 connect those boundaries to the live Sepolia Privy and ENS adapters. The live proof uses `eth_signTransaction` for stateful limits and broadcasts the signed transaction separately. The persistent ENS name remains available after revoke with `kanon.status=revoked`. A provider-failure rollback variant for T12 remains a follow-up API integration test.

T14 freezes `packages/shared/src/api-contracts.ts` as the versioned data boundary for organization, wallet, agent capability, company terms, approval, ENS identity, active authority, evidence, update diff, and revoke resources. Every route is company-authenticated, wallet and authority projections exclude private or owner-management material, and constructors reject mismatched active authority, update, and revoke evidence. The API server and approved frontend now implement that contract without widening it. T17 verifies the production proxy and browser lifecycle boundary.

## Non-negotiable gates

Human approval is required at authority boundaries. Unsupported permission semantics fail closed. ENS approved state cannot advance before the corresponding Privy authority transition is confirmed. The runner cannot hold owner authority. Frontend starts only after owner product design.
