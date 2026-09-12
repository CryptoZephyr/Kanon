# Kanon Build Order

Canonical source: [Kanon Build in Notion](https://app.notion.com/p/3cec53818312818da7bcef56a9e2c46d).

## Current phase

T0 setup, T1A, the Privy feasibility spike, and T1B are complete. The repository now has a verified Privy enforcement boundary and a final conservative company-authority grammar with deterministic `permissionHash`. The next phase is T2 permission diffing. ENSv2 and frontend implementation remain gated.

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

The final authority model was frozen only after the Privy feasibility spike. T1B excludes request-count limits, token assets, vendor resource identity, and unsupported conditions. T1A remains sponsor-independent and does not grant authority.

## Non-negotiable gates

Human approval is required at authority boundaries. Unsupported permission semantics fail closed. ENS approved state cannot advance before the corresponding Privy authority transition is confirmed. The runner cannot hold owner authority. Frontend starts only after owner product design.
