# Kanon Security Boundary

Canonical source: [Kanon Security in Notion](https://app.notion.com/p/3cac5381831281ff9a57f17f2f099d2f).

The autonomous runtime must never possess more wallet authority than the exact human-approved permission set for its active installation.

The organization retains owner or quorum control. The agent receives a dedicated delegated signer with a signer-specific Privy policy. The signer cannot update owners, signers, policies, or its own limits. The owner credential never enters the runner, and the runner never falls back to owner signing.

The selected Privy execution method is part of the authority boundary. `eth_sendTransaction` may use only the verified stateless controls. `eth_signTransaction` may use a verified rolling-value aggregation, after which a separate broadcast step submits the signed transaction. If a requested term cannot be enforced by the selected method, the compiler returns `UNSUPPORTED_POLICY_COMBINATION` and emits no policy. No application-only counter or weaker replacement is acceptable.

`EXPANDED`, `SUBSTITUTED`, and `UNKNOWN` permission changes require human review. Ambiguous, unrestricted, unsupported, stale, failed, or unverifiable authority must fail closed. ENSv2 approved-state records are protected identity evidence, not financial enforcement. The T7 adapter writes only the four public records after an approved or active lifecycle and exact active Privy authority binding are confirmed. It never accepts or publishes company terms. Revocation requires real loss of delegated Privy authority, a revoked installation state, a revoked ENS status, and a failed later delegated request.

The installation lifecycle binds the human decision, release identity, `permissionHash`, active delegated Privy binding, and verified ENS approved state. `ACTIVE` cannot be reached when any of those values is stale or mismatched. The runner re-reads the installation before execution and refuses a non-active status, revoked signer, stale generation, changed wallet/signer/policy identity, changed permission hash, changed execution method, or unverified ENS state before invoking the delegated executor. The live T11 to T13 proof confirms activation, Privy-first expanded update ordering, signer removal, post-revoke rejection, ENS revoked state, and unauthorized record-restore rejection. The deployed API returns HTTP `202` while provider configuration runs asynchronously, and the frontend polls until a terminal lifecycle state. A failed or unfinished operation remains configuring and cannot be presented as active authority. The local contract keeps the old state until the new authority and ENS state are both configured.

T14 through T16 keep the backend/API and frontend inside the same boundary. Versioned resources expose only public or scoped identifiers and verified state. Wallet resources contain no private key, secret, owner credential, or quorum material. Active authority construction requires matching Privy and ENS generation, permission hash, and ENS readback. Update and revoke resources reject evidence that does not match the approved proposal or decision. The browser receives no company token. These contracts describe data and failure modes. They do not grant authority or replace Privy and ENS enforcement.

No secret, authorization key, seed phrase, or owner credential belongs in source control, frontend responses, logs, analytics, or ordinary database fields.

## Reporting a vulnerability

Do not open a public issue for a suspected security problem. Use the repository owner's GitHub profile to request a private report or use GitHub's private vulnerability reporting when it is enabled for the repository. Include only the minimum reproduction details needed to triage the issue. Never include private keys, seed phrases, provider secrets, authorization keys, or company tokens in a report.

## Scope

In scope are the delegated Privy authority boundary, policy compilation, runner isolation, company-authenticated API routes, server-side token handling, ENSv2 protected-record permissions, lifecycle binding, and fail-closed behavior.

Out of scope are third-party Privy or ENS infrastructure, the security of the user's own wallet or operating system, unrelated hosted services, and attacks that require disclosure of a secret that the user stored outside this repository.

## Prototype limits

Kanon is a hackathon and Ethereum Sepolia testnet proof. It has not received an independent security audit and is not a production custody or financial-operations deployment. ENSv2 beta interfaces, Privy policy behavior, free-tier hosting, provider availability, and testnet state can change. No mainnet ENS write is authorized by this repository.
