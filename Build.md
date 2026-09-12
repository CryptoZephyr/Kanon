# Kanon Build Order

Canonical source: [Kanon Build in Notion](https://app.notion.com/p/3cec53818312818da7bcef56a9e2c46d).

## Current phase

Bootstrap a fresh zero-code repository and configure current sponsor documentation tooling. Product logic and frontend implementation are deferred.

## Exact post-setup order

The owner instruction and the detailed task IDs define the next sequence as T1 and T2 first, then the blocking sponsor proofs and lifecycle work:

```text
T1 manifest + company terms + permissionHash
-> T2 permission diff
-> T3 Privy wallet-control spike
-> T4 forbidden-action proof
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

The Notion build-priority summary places the Privy and ENSv2 feasibility spikes before the permission model. That ordering differs from the detailed task IDs and owner instruction. The difference is recorded in `Handoff.md` and must be resolved explicitly before it affects implementation.

## Non-negotiable gates

Human approval is required at authority boundaries. Unsupported permission semantics fail closed. ENS approved state cannot advance before the corresponding Privy authority transition is confirmed. The runner cannot hold owner authority. Frontend starts only after owner product design.
