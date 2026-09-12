# Kanon Manifest Boundary

Canonical source: [Kanon Manifest Spec in Notion](https://app.notion.com/p/3cac5381831281e09d8bc1ae6580ea2f).

The manifest is a portable declaration of what a financial-agent release needs. It is separate from company authority terms and does not grant authority.

T1A defines stable agent identity, release identity, machine-readable capability fields, package and manifest hashes, provisional company terms, and the distinction between requested capabilities and company-granted terms. T1B must define the final company terms, canonical normalization, and exact deterministic `permissionHash` contract from verified Privy behavior. Unsupported or ambiguous authority must fail closed.

T1A may define only a sponsor-independent domain foundation. The final authority grammar and `permissionHash` contract are intentionally deferred until the real Privy feasibility spike establishes what the selected Privy path can enforce.

## T1A Boundary

T1A may define stable agent/release identity, agent-declared capability input, provisional company terms, provisional normalized-permission-set types, `packageHash`, and `manifestHash`. It must keep requested capabilities separate from company-granted terms.

T1A must not freeze final `permissionHash` serialization, digest format, exact authority-field inclusion, wallet identity treatment, recipient semantics, contract/function semantics, spend/rate semantics, validity semantics, or unsupported-condition behavior.

The Privy feasibility spike comes next. T1B must derive the supported company-authority grammar, canonical normalization, deterministic serialization, exact `permissionHash` inputs, and compiler contract from verified Privy behavior. A condition that cannot be represented faithfully must fail closed.

## T1B Final Authority Contract

T1B is complete against the verified Privy surface recorded in `evidence/privy/t3-latest.json` and `evidence/privy/t3-surface-latest.json`.

Final `CompanyAuthorityTerms` use schema `kanon.company-authority-terms` version `2` and contain a finite normalized set of Ethereum transaction rules. Each rule contains:

- a positive numeric `chainId`;
- `asset: "native"`, because token enforcement was not proven;
- one exact lowercase EVM `recipient`;
- a non-negative decimal `maxValueWei` per transaction;
- optional calldata function metadata and exact named argument strings;
- optional inclusive Unix `validityWindow` boundaries;
- optional rolling native-value `sum` limit with a positive window in seconds.

The final grammar excludes wallet identity, Privy resource IDs, request-count limits, token assets, arbitrary conditions, and unknown fields. Those inputs fail closed through `UnsupportedAuthorityError` or structural validation. The rolling-value limit is supported with Privy's documented stateful-policy concurrency caveat. It is not treated as a strict concurrent transaction counter.

`permissionHash` is the SHA-256 digest of the exact final company terms only. Its serialized input is canonical UTF-8 JSON with lexicographically sorted object keys, duplicate rules removed, rules sorted by their canonical serialization, lowercase EVM addresses, and decimal quantities represented as canonical strings. The digest is encoded as `sha256:` followed by lowercase hexadecimal. Agent/release identity, package and manifest hashes, wallet identity, signer identity, policy identity, aggregation identity, and transaction evidence remain separate installation or approval inputs. This permits an unchanged authority to remain unchanged across a software release while the release identity is still bound separately.

The future Privy policy compiler accepts a normalized permission set plus the owner identifier and policy label. It emits only the verified `eth_signTransaction` and `eth_sendTransaction` methods and must reject every unsupported, ambiguous, or unverifiable condition. It may never widen a rule or replace Privy enforcement with an application-only check.

## T2 Diff Contract

The permission diff engine compares normalized company terms and ignores release-only identity changes. `NO_CHANGE` requires identical normalized terms. `NARROWER` and `EXPANDED` use proof-backed rule coverage. `SUBSTITUTED` is reserved for equal-count rule sets with equal limit signatures and changed scope fields. Any forged, invalid, mixed, incomparable, or otherwise unproven relationship returns `UNKNOWN` and requires human review. The result includes both permission hashes and deterministic changed paths.
