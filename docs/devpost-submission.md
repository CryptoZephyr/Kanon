# Kanon: Devpost submission copy (3rd-Web-Hack)

Paste each section into the matching Devpost field. Everything here describes what the live Sepolia deployment and this repository actually do.

## Project name

Kanon

## Tagline

The company decides what its financial agent may do. A software update cannot quietly change that.

## Links

- Live prototype: https://kanon-agents.vercel.app
- Source code: https://github.com/CryptoZephyr/Kanon
- Pitch deck: docs/pitch/kanon-pitch-deck.pdf in the repository
- Network: Ethereum Sepolia testnet (chain ID 11155111)

## Built with

TypeScript, React, Vite, Node.js 22, pnpm, Privy server wallets and policies, ENSv2 on Sepolia (Permissioned Registry, Permissioned Resolver, Enhanced Access Control), viem, PostgreSQL (Neon), Render, Vercel, Vitest.

---

## Inspiration

Companies want AI agents to pay contractors, move treasury funds and run recurring payments. Today there are two bad options. You hand the agent a hot wallet key, or a human signs every transaction and the automation is pointless.

There is a quieter problem too. Agents are software, and software ships updates. When version 2 asks for more spending power than version 1, most setups just let it inherit the old wallet access. Nobody reviews the change, because nothing forces a review.

We wanted a control layer where a human approves an exact authority boundary once, the agent works freely inside it, and any broader release stops until a human looks at the difference.

## Problem

A financial agent needs real wallet authority to be useful. That creates three unsolved problems for the business running it:

1. **Unbounded keys.** Backend hot wallets give an agent far more authority than its task needs, and application-level checks can be bypassed by a bug or a prompt injection.
2. **Silent escalation.** A new agent release can request broader authority than the one the company approved, and nothing ties the approval to a specific release.
3. **No public, company-controlled identity.** Outsiders cannot check which agent is acting for a company, which release was approved, or whether its authority has been revoked.

## Solution

Kanon is a business agent-control runtime. It sits between the company, the agent release, a Privy wallet and an ENSv2 identity.

- The agent release declares the capabilities it wants. That declaration never grants anything.
- The company defines the terms it is willing to grant: recipient, per-action ceiling, rolling spend ceiling.
- Kanon normalizes those terms and computes a deterministic `permissionHash`.
- A human approves that exact hash, bound to the release, package and manifest hashes.
- Kanon compiles the approved terms into a Privy signer-specific policy and attaches a dedicated delegated signer. The company keeps wallet ownership. Privy enforces the boundary on every transaction.
- Kanon writes the approved release, `permissionHash` and status to the agent's ENSv2 name under the company namespace, where only the company's writer role can change them.
- When a new release asks for more, Kanon classifies the change as `EXPANDED`, blocks it and requires a fresh human decision. Privy is updated first; the ENS record only moves after Privy confirms.
- Revocation removes the delegated signer, then marks the ENS identity `revoked`. Later execution attempts fail.

The rule is simple: humans approve authority boundaries, agents operate inside them.

## How it works

The live demo walks through the whole lifecycle on Sepolia:

1. **Register an agent release.** The release gets a package hash and manifest hash.
2. **Review requested capabilities.** The request is shown separately from anything granted.
3. **Define company authority.** One exact recipient, a per-action ceiling in wei, and a rolling ceiling per time window.
4. **Approve the exact boundary.** The review screen shows the normalized terms and `permissionHash` the human is signing off on.
5. **Activate Privy-enforced authority.** The API creates the Privy policy and aggregation, attaches the agent signer, then writes and reads back the ENS records.
6. **Inspect the ENS identity.** `kanon.agentId`, `kanon.release`, `kanon.permissionHash` and `kanon.status` resolve from the Permissioned Resolver.
7. **Run an allowed action.** The isolated runner signs through Privy with only the agent's key and broadcasts a real Sepolia transaction.
8. **Reject a forbidden action.** A transfer to an unapproved recipient is refused by the Privy policy, not by a UI check.
9. **Detect a broader release.** Version 2 asks for a higher ceiling. Kanon's permission diff returns `EXPANDED` with the changed paths.
10. **Require fresh human authorization.** The old authority stays in force until a human approves the new hash. Then the generation increments.
11. **Revoke authority.** The Privy signer is removed and ENS status becomes `revoked`.
12. **Prove post-revocation execution fails.** The next delegated attempt is rejected and recorded as evidence.

## Innovation

- **Release-bound authority.** Approval attaches to a specific release, package hash, manifest hash and `permissionHash`. A new release cannot reuse an old approval if its authority changes.
- **Permission diffing for agent updates.** Every release is classified as `NO_CHANGE`, `NARROWER`, `EXPANDED`, `SUBSTITUTED` or `UNKNOWN`. Anything that is not provably equal or narrower fails closed and waits for a human.
- **Two planes with a strict order.** Privy enforces money movement; ENSv2 publishes company-controlled identity and approved state. ENS never claims authority Privy does not hold, because ENS is only written after Privy confirms.
- **Fail-closed compilation.** If a company term cannot be enforced by the selected Privy execution method, Kanon refuses to compile a policy instead of silently approximating it.

## Uniqueness

Most agent-wallet tools answer "how does an agent get a wallet?" Kanon answers a different question: "what exactly did the company approve, for which release, and can anyone prove it is still true?" It is not a wallet provider, an agent launcher or a trading bot. It is the authority record and enforcement lifecycle around an agent a company already wants to run.

## Technical implementation

- **Monorepo** (pnpm, TypeScript): `packages/manifest` (release and manifest hashing), `packages/permissions` (normalization, `permissionHash`, diff classification), `packages/privy` (method-aware policy compiler and Privy adapter), `packages/ens` (ENSv2 identity binding, protected record writes and readback), `packages/shared` (installation state machine and versioned API contracts).
- **API** (Render, Node.js 22, Neon PostgreSQL): installation lifecycle, human decisions, asynchronous authority configuration with polling, Privy-first update ordering, revocation.
- **Isolated runner** (separate Render service): holds only the agent's delegated signing key, re-reads the installation before every execution and refuses stale, revoked or mismatched authority. It never receives owner credentials.
- **Frontend** (Vercel, React + Vite): the judge-facing workspace. Browser code never sees a provider secret or the company API token.
- **Public demo boundary** (new in this release): the Vercel proxy sends a restricted demo credential instead of the company token. The API limits that role to the guided flow, caps terms to the organization's own wallet and small wei values, rate-limits mutations, and blocks operator routes.
- **Tests:** Vitest suites cover manifest hashing, permission normalization and diffing, policy compilation, ENS binding, lifecycle gates, the runner, API contracts, and the new demo guard and session lease.

## What's new in the 3rd-Web-Hack release

Kanon was first built during ETHOnline 2026 (September 2026). This release is the work done for 3rd-Web-Hack to make it a dependable, judge-repeatable prototype:

- **Reliable hosted backend.** The workspace no longer sticks on "API pending". It retries with timeouts, explains free-tier wake-ups, and offers a manual retry. Services start faster and a scheduled job keeps them warm during judging.
- **Safe public demo.** Visitor requests no longer carry the company API token. A restricted demo role, a terms ceiling, rate limits and a proxy route allowlist stop visitors from damaging the shared Sepolia state or draining the demo wallet.
- **Repeatable flow without manual fixture resets.** A session lease gives one visitor the shared Privy signer and ENS name at a time. Abandoned sessions expire through the real revocation path, so the next judge always starts clean. The operator proof now restores its ENS baseline itself, after Privy authority is attached.
- **Allowed, forbidden and post-revoke execution in the UI.** Judges can trigger each one and see the Sepolia transaction or the policy rejection recorded as evidence.
- **Judge path.** A twelve-step checklist tracks the run, and the ENS panel shows the live records and full `permissionHash`.
- **Reject-update path.** A human can reject a broader release and keep the current authority.

## Impact

Kanon targets small crypto-native teams, DAOs, and startups paying contributors in stablecoins: groups that want agents to do financial work but cannot afford to trust an agent with an unrestricted key. It gives them a way to say "this agent, this release, this much, to this recipient", have a wallet enforce it, and let anyone check the company-controlled identity record. The same pattern applies to payroll, treasury rebalancing, vendor payments or a company's own custom agent.

## Challenges we ran into

- **Matching company terms to what Privy actually enforces.** Rolling spend limits only work with Privy aggregations on the `eth_signTransaction` path, so the compiler became execution-method aware and refuses unsupported combinations instead of faking them.
- **Keeping two systems consistent.** Privy and ENS can fail independently. We made Privy the source of truth, update it first, and roll back to the previous policy and ENS state when a step fails.
- **ENSv2 is beta on Sepolia.** We verified registry, resolver and role behavior against the live deployment before relying on it.
- **A shared testnet fixture.** One Privy signer and one ENS name meant an abandoned session could block everyone. The session lease and expiry-through-revocation solved that without weakening any rule.
- **Free-tier hosting.** Cold starts caused the stuck connection state. Retries, faster startup and a keep-warm job fixed the judge experience.

## Accomplishments that we're proud of

- The full lifecycle runs end to end on Sepolia with real Privy policy enforcement and real ENSv2 records: activation, allowed transaction, policy rejection, expanded update, reauthorization, revocation and post-revoke failure.
- An unauthorized account cannot rewrite the agent's protected ENS records; the proof checks this.
- The public demo is open to anyone without giving anyone operator power.

## What we learned

- Policy enforcement is only as honest as the compiler in front of it. Refusing to compile is better than approximating a limit.
- Ordering matters. "Privy first, then ENS" is what keeps the public record from overstating authority.
- A demo shared by many strangers needs the same care as a product: least-privilege credentials, bounded inputs and automatic cleanup.

## What's next

- Multi-party (quorum) approval for large authority changes.
- ERC-20 stablecoin terms once the policy path is verified end to end.
- A per-company fixture so each organization gets its own wallet and ENS namespace instead of a shared demo.
- An integration test for provider-failure rollback during updates.
- Independent security review before any mainnet or production use.

## Limitations (please read)

- Sepolia testnet only. No mainnet deployment, no real funds.
- Not audited. Not production custody. No external users yet.
- The ENS namespace `kanon-ethonline-2026.eth` was registered during the original build and is reused so the verified records stay valid.
- The hosted demo shares one Privy signer and one ENS name. If another person is mid-run, the UI shows when the fixture becomes free (at most 20 minutes).
- Render free services can take up to a minute to wake after idle.
