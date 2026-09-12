# Kanon Manifest Boundary

Canonical source: [Kanon Manifest Spec in Notion](https://app.notion.com/p/3cac5381831281e09d8bc1ae6580ea2f).

The manifest is a portable declaration of what a financial-agent release needs. It is separate from company authority terms and does not grant authority.

T1A defines stable agent identity, release identity, machine-readable capability fields, package and manifest hashes, provisional company terms, and the distinction between requested capabilities and company-granted terms. T1B must define the final company terms, canonical normalization, and exact deterministic `permissionHash` contract from verified Privy behavior. Unsupported or ambiguous authority must fail closed.

T1A may define only a sponsor-independent domain foundation. The final authority grammar and `permissionHash` contract are intentionally deferred until the real Privy feasibility spike establishes what the selected Privy path can enforce.

## T1A Boundary

T1A may define stable agent/release identity, agent-declared capability input, provisional company terms, provisional normalized-permission-set types, `packageHash`, and `manifestHash`. It must keep requested capabilities separate from company-granted terms.

T1A must not freeze final `permissionHash` serialization, digest format, exact authority-field inclusion, wallet identity treatment, recipient semantics, contract/function semantics, spend/rate semantics, validity semantics, or unsupported-condition behavior.

The Privy feasibility spike comes next. T1B must derive the supported company-authority grammar, canonical normalization, deterministic serialization, exact `permissionHash` inputs, and compiler contract from verified Privy behavior. A condition that cannot be represented faithfully must fail closed.
