# Kanon submission brief

## One-liner

Kanon gives company-deployed financial agents a company-controlled ENSv2 identity and a versioned Privy wallet authority boundary that a software update cannot silently widen.

## Problem and user

The primary user is a business or organization operating financial AI agents. These teams need autonomous execution, but broad wallet credentials and silent permission escalation create unacceptable control risk.

## Core flow

An agent release declares requested capabilities. The company defines the terms it is willing to grant. Kanon normalizes those terms into a deterministic `permissionHash`. A human approves the exact release and authority. Privy then controls the delegated execution path, while ENSv2 records the company-controlled identity and approved public state. Broader updates stop for reauthorization, and revoke removes delegated authority before the public ENS status becomes `revoked`.

## Why the sponsor integrations matter

Privy is the financial enforcement plane. Its wallet ownership, additional signer, signer-specific policy, execution method, and signer removal are part of the authority boundary.

ENSv2 is the identity and namespace plane. The Sepolia organization hierarchy and Permissioned Resolver writer boundary give the company persistent control over the agent identity and protected public records.

## Judge path

Open [kanon-agents.vercel.app](https://kanon-agents.vercel.app) and follow the visible flow:

1. Confirm the organization namespace and API connection.
2. Add the representative financial agent and inspect the requested capabilities.
3. Define company terms and review the exact package, manifest, and permission hashes.
4. Approve the initial authority and wait for the active state.
5. Inspect the ENS identity, Privy execution method, policy reference, and protected records.
6. Run the allowed path and the clearly forbidden path.
7. Request the broader release. Observe the exact update diff and the reauthorization gate.
8. Approve the new authority and observe Privy-first synchronization followed by ENS readback.
9. Revoke the agent and observe signer removal, ENS `revoked` status, and failed post-revoke execution.

## Evidence

- [T17 deployment and browser rehearsal record](../evidence/deployment/t17-live-latest.json)
- [Live T11 to T13 lifecycle record](../evidence/lifecycle/t11-t13-latest.json)
- [ENSv2 Sepolia write, read, and permission record](../evidence/ens/t6-write-latest.json)
- [Privy method-aware compiler record](../evidence/privy/t5-compiler-latest.json)
- [Deployment boundary](../DEPLOYMENT.md)
- [Security boundary](../SECURITY.md)

## Claims boundary

Verified scope is limited to Ethereum Sepolia and the configured ETHOnline proof namespace. The project does not claim mainnet ENS stability, production custody readiness, security audit completion, external adoption, or financial safety beyond the demonstrated Privy and ENSv2 boundaries.

The exact `kanon.agents.vercel.app` hostname is reserved for another Vercel account. The verified live URL is `https://kanon-agents.vercel.app`.

## Repository and license state

The GitHub repository is currently private. No open-source license has been selected, so public visibility and reuse rights remain owner decisions.
