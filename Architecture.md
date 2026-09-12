# Kanon Architecture Boundary

Canonical source: [Kanon Architecture in Notion](https://app.notion.com/p/3cac53818312815b9be4f4bb67232d16).

Kanon separates wallet ownership, delegated agent authority, application state, and autonomous execution.

- `packages/manifest` will parse and identify agent release capability declarations. A manifest never grants authority.
- `packages/permissions` normalizes the Privy-backed company terms and derives deterministic `permissionHash`; its diff engine remains the next phase.
- `packages/privy` will contain the vendor-specific wallet, policy, signer, execution, and revoke adapter.
- `packages/ens` will contain the vendor-specific ENSv2 namespace, resolver, access-control, approved-state, and resolution adapter.
- `packages/shared` will hold later shared domain contracts.
- `apps/runner` will execute with only a dedicated delegated authorization context and will refuse stale or revoked work.

Privy controls financial execution. ENSv2 provides the company-controlled identity and namespace plane. Durable application state cannot claim active authority without verified required control configuration. No frontend or API implementation is present in this phase.
