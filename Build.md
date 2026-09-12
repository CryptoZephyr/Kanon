# Kanon Build Order

Canonical source: [Kanon Build in Notion](https://app.notion.com/p/3cec53818312818da7bcef56a9e2c46d).

## Current phase

Bootstrap a fresh zero-code repository, configure current sponsor documentation tooling, and complete the sponsor-independent T1A domain foundation. Privy-dependent authority logic and frontend implementation remain deferred.

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

The final authority model is intentionally deferred until the Privy feasibility spike proves the real enforcement surface. T1A remains sponsor-independent and does not freeze `permissionHash` semantics.

## Non-negotiable gates

Human approval is required at authority boundaries. Unsupported permission semantics fail closed. ENS approved state cannot advance before the corresponding Privy authority transition is confirmed. The runner cannot hold owner authority. Frontend starts only after owner product design.
