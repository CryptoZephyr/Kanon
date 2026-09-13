# Kanon Integrations

Canonical source: [Kanon Integrations in Notion](https://app.notion.com/p/3cac53818312815fb2bdcfe8fb317fda).

Kanon has two intentional core sponsor integrations:

- Privy provides the business wallet-control and financial-authority plane, including restricted delegated signers, signer-specific policy controls, execution results, and signer removal for revoke.
- ENSv2 provides the company-controlled identity and namespace plane on Sepolia, including hierarchical names, scoped identity permissions, and protected public approved-state records.

Viem is supporting infrastructure only. A third sponsor is cut by default. Privy policy compilation is now method-aware. Stateless controls are available on `eth_sendTransaction`, while rolling aggregation references are limited to `eth_signTransaction` and require a separate broadcast step. T6 proved the exact Sepolia namespace, nested registry path, Permissioned Resolver, protected records, and writer boundary. T7 provides the ENS identity and approved-state adapter. ENSv2 remains an identity and public-state plane, not financial policy enforcement.
