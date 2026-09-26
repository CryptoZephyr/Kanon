# Kanon: 3rd-Web-Hack judge brief

## One line

Kanon lets a company approve an exact wallet authority for a specific AI agent release, has Privy enforce it, publishes the approved state on ENSv2, and stops any broader release until a human approves again.

## Problem

Financial agents need real wallet authority to be useful. Businesses today either hand them broad hot-wallet keys or approve every transaction by hand. Neither works, and neither handles software updates: a new agent release can ask for more authority and quietly inherit the old access.

## Solution and Web3 value

- **Privy** is the enforcement plane. The company owns the wallet through a key quorum. The agent gets a dedicated delegated signer with a signer-specific policy. Out-of-policy transactions are rejected by Privy.
- **ENSv2** is the identity plane. Each agent has a name under the company namespace on Sepolia, with protected records for agent ID, approved release, `permissionHash` and status. Only the company's writer role can change them, so anyone can resolve what the company approved and whether it is still active.
- **Kanon** is the lifecycle that joins them: declared capabilities, company terms, deterministic hashing, human approval, policy compilation, permission diffing on updates, and revocation.

## Judge path (about five minutes)

Open [kanon-agents.vercel.app](https://kanon-agents.vercel.app) → **Enter the workspace**. The judge path rail tracks these steps:

1. Register an agent release (a unique release ID is generated for you).
2. Review the requested capabilities.
3. Define company authority. Keep the defaults: 1 wei per action, 1 wei per hour rolling.
4. Approve the exact boundary and wait for **active** (usually under a minute; Privy and two Sepolia writes run in the background).
5. Open the agent detail. Inspect the ENS name, resolver and the four records, including the full `permissionHash`.
6. **Run allowed action.** Wait for Sepolia confirmation and follow the Etherscan link.
7. **Try forbidden action.** The Privy policy rejects it.
8. **Review release update.** Request version 2 with a 2 wei ceiling. Kanon classifies it `EXPANDED` and requires human review.
9. **Approve new authority.** The generation moves from 0 to 1.
10. **Revoke authority.** Privy signer removed, ENS status `revoked`.
11. **Attempt allowed action after revoke.** The attempt is rejected and recorded.

If the workspace says another session is live, wait for the time shown (at most 20 minutes) or open **Latest run** to observe the most recent completed flow.

## Mapping to the judging criteria

| Criterion             | Where to look                                                                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Innovation            | Release-bound approvals; permission diffing that fails closed; strict Privy-first, ENS-second ordering so the public record never overstates authority.                                                                              |
| Technical feasibility | Everything runs live on Sepolia: real Privy policies and signer removal, real ENSv2 records, real transactions. `pnpm smoke:live` replays the whole flow against the public deployment without credentials. Test suite: `pnpm test`. |
| Uniqueness            | Not a wallet, agent launcher or trading bot. Kanon is the authority record and enforcement lifecycle around an agent a company already runs.                                                                                         |
| Design                | One calm workspace with a twelve-step judge path, redlined update diffs, and evidence that stays secondary to the decision. Handles cold starts, busy fixtures and failures with plain explanations.                                 |

## What's new in this release

All of Kanon's code was written September 12 to 26, 2026, inside the 3rd-Web-Hack submission period (August 22 to September 27). Before that it existed only as product notes. The same build was also created for ETHOnline 2026. The work since September 25 adds: reliable backend connection and start-up, a restricted public demo role in place of the company token, a session lease that makes the flow repeatable without manual ENS resets, allowed/forbidden/post-revoke execution in the UI, the judge path, a live ENS panel, a reject-update path, `pnpm smoke:live`, and new tests. Details: [README → Project history](../README.md#project-history).

## Evidence

- 3rd-Web-Hack live judge flow through the public proxy: [run 1](../evidence/3rd-web-hack/live-judge-flow-run-1.json), [run 2](../evidence/3rd-web-hack/live-judge-flow-run-2.json) (started from the revoked fixture with no manual reset), and [latest](../evidence/3rd-web-hack/live-judge-flow-latest.json) (after the final deployment)
- Original build records: [lifecycle proof](../evidence/lifecycle/t11-t13-latest.json), [ENSv2 write and permission proof](../evidence/ens/t6-write-latest.json), [Privy compiler proof](../evidence/privy/t5-compiler-latest.json), [deployment rehearsals](../evidence/deployment/t17-live-latest.json)
- [Architecture](architecture.md) · [Security boundary](../SECURITY.md) · [Deployment record](../DEPLOYMENT.md)

## Claims boundary

Sepolia testnet only. No mainnet deployment, no audit, no production custody, no external users, no claim of financial safety beyond the demonstrated Privy and ENSv2 boundaries.
