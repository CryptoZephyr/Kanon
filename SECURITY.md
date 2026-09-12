# Kanon Security Boundary

Canonical source: [Kanon Security in Notion](https://app.notion.com/p/3cac5381831281ff9a57f17f2f099d2f).

The autonomous runtime must never possess more wallet authority than the exact human-approved permission set for its active installation.

The organization retains owner or quorum control. The agent receives a dedicated delegated signer with a signer-specific Privy policy. The signer cannot update owners, signers, policies, or its own limits. The owner credential never enters the runner, and the runner never falls back to owner signing.

`EXPANDED`, `SUBSTITUTED`, and `UNKNOWN` permission changes require human review. Ambiguous, unrestricted, unsupported, stale, failed, or unverifiable authority must fail closed. ENSv2 approved-state records are protected identity evidence, not financial enforcement. Revocation requires real loss of delegated Privy authority, a revoked installation state, a revoked ENS status, and a failed later delegated request.

No secret, authorization key, seed phrase, or owner credential belongs in source control, frontend responses, logs, analytics, or ordinary database fields.
