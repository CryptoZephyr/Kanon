---
name: Privy
description: Use when building wallet infrastructure, authentication systems, or financial applications. Reach for Privy when you need to create embedded wallets, authenticate users, manage wallet controls and policies, execute transactions, or integrate wallet functionality into web, mobile, or backend applications.
metadata:
    mintlify-proj: privy
    version: "1.0"
---

# Privy Skill Reference

## Product summary

Privy is a programmable wallet infrastructure platform that enables developers to build secure financial applications with embedded wallets, authentication, and transaction management. Use Privy to create non-custodial wallets for users, organizations, or agents; authenticate users via email, social, passkeys, or wallets; execute transactions across 50+ blockchains; and enforce spending policies and access controls.

**Key entry points:**
- **React SDK**: `@privy-io/react-auth` with `PrivyProvider` wrapper
- **Node.js SDK**: `@privy-io/node` for backend wallet and user management
- **REST API**: `https://api.privy.io/api/v1/` with Basic Auth (app ID + app secret)
- **Dashboard**: https://dashboard.privy.io for app configuration, policies, and webhooks
- **Primary docs**: https://docs.privy.io

## When to use

Reach for Privy when:
- Building consumer apps that need user authentication + embedded wallets
- Creating organization or treasury wallets with multi-party controls
- Implementing server-side wallet automation (limit orders, rebalancing, agent wallets)
- Integrating external wallets (MetaMask, Phantom) alongside embedded wallets
- Enforcing spending policies, transaction limits, or approval workflows
- Managing users across multiple chains (Ethereum, Solana, Tempo, Bitcoin, etc.)
- Handling fiat on/off-ramps, swaps, or yield integrations
- Building AI agents that need secure, scoped wallet access

Do not use Privy for: password-based authentication (not supported), or if you need complete control over key management without any infrastructure abstraction.

## Quick reference

### SDK initialization

| Platform | Command | Key config |
|----------|---------|-----------|
| React | `npm install @privy-io/react-auth` | Wrap app with `<PrivyProvider appId="..." clientId="...">` |
| Node.js | `npm install @privy-io/node` | `new PrivyClient({appId, appSecret})` |
| React Native | `npm install @privy-io/react-native-auth` | Requires Expo dev build + metro config |
| Swift | `pod install PrivySDK` | Import and initialize in AppDelegate |
| Android | Gradle dependency | Initialize in Application class |
| REST API | N/A | Use Basic Auth: `-u "app-id:app-secret"` + `privy-app-id` header |

### Dashboard configuration checklist

- **App settings > Basics**: Get app ID and app secret
- **App settings > Clients**: Create app clients for different environments (web, mobile, staging)
- **App settings > Domains**: Add allowed origins for web apps (required for production)
- **Authentication**: Enable login methods (email, SMS, socials, passkeys, wallet)
- **Wallet infrastructure > Policies**: Define spending limits, recipient whitelists, contract restrictions
- **Funding**: Enable fiat/crypto deposits and payouts
- **Webhooks**: Subscribe to user, wallet, transaction, and wallet action events

### Common API patterns

| Task | Endpoint | Auth |
|------|----------|------|
| Create wallet | `POST /wallets` | App secret or authorization signature |
| Get wallet | `GET /wallets/{wallet_id}` | App secret |
| Send transaction | `POST /wallets/{wallet_id}/ethereum/eth_sendTransaction` | App secret + authorization signature (if signer) |
| Create user | `POST /users` | App secret |
| Get user | `GET /users/{user_id}` | App secret |
| Create policy | `POST /policies` | App secret |
| Create intent | `POST /intents/rpc` or `/intents/transfer` | App secret + authorization signature |

### Wallet types and custody models

| Model | Owner | Use case | Key feature |
|-------|-------|----------|------------|
| User-owned | User | Self-custodial consumer wallets | User has full control, can export keys |
| User + server | User + app key | Automated trading, limit orders | Server has scoped permissions via policies |
| App-owned | Authorization key | Treasury, agents, bots | App controls wallet, no user involvement |
| Custodial | Licensed custodian | Institutional, regulated | Third-party custody, FBO model |

### Authentication methods

| Method | Type | Best for | Security |
|--------|------|----------|----------|
| Email OTP | Delegated | Broad accessibility | Requires MFA for high-value apps |
| SMS/WhatsApp | Delegated | Phone-based users | Vulnerable to SIM swap; use MFA |
| Passkey | Direct | High security | User owns credential, no third party |
| Social (Google, Discord, etc.) | Delegated | Familiar UX | Requires MFA for high-value apps |
| Wallet (MetaMask, Phantom) | Direct | Crypto-native users | User controls keys |
| Custom OAuth | Delegated | Existing auth system | Requires JWKS endpoint configuration |

## Decision guidance

### When to use embedded vs. external wallets

| Scenario | Embedded | External |
|----------|----------|----------|
| New users with no wallet | ✓ | ✗ |
| Users bringing existing wallets | ✗ | ✓ |
| Seamless onboarding UX | ✓ | ✗ |
| Crypto-native power users | ✗ | ✓ |
| Server-side automation | ✓ | ✗ |
| User retains full key control | ✓ | ✓ |
| Use `connectOrCreateWallet()` for both | ✓ | ✓ |

### When to use Privy auth vs. JWT-based auth

| Scenario | Privy auth | JWT-based |
|----------|-----------|-----------|
| No existing auth system | ✓ | ✗ |
| Need multiple login methods | ✓ | ✗ |
| Already have Auth0/Firebase | ✗ | ✓ |
| Want Privy to manage auth | ✓ | ✗ |
| Integrating wallets into existing app | ✗ | ✓ |
| Requires JWKS endpoint | ✗ | ✓ |

### When to use wallet actions vs. RPC vs. intents

| Approach | Use case | Complexity |
|----------|----------|-----------|
| **Wallet actions** | Transfers, swaps, earn deposits, common flows | Low; Privy handles onchain details |
| **RPC** | Custom contract interactions, raw signatures | High; you construct transaction payloads |
| **Intents** | Asynchronous approval workflows, organizations | Medium; supports async authorization |

## Workflow

### 1. Set up a new Privy app

1. Go to https://dashboard.privy.io and create an app
2. Copy your **app ID** and **app secret** from App settings > Basics
3. Create an **app client** for each environment (web, mobile, staging)
4. Add **allowed domains** for web apps (required for production)
5. Enable **login methods** under Authentication
6. Enable **wallet infrastructure** features (deposits, swaps, policies) as needed

### 2. Integrate Privy into your frontend (React example)

1. Install: `npm install @privy-io/react-auth`
2. Wrap your app root with `PrivyProvider`:
   ```tsx
   <PrivyProvider appId="your-app-id" clientId="your-client-id" config={{
     embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } }
   }}>
     {children}
   </PrivyProvider>
   ```
3. Wait for `ready` from `usePrivy()` before consuming state
4. Use `usePrivy()` for auth, `useWallets()` for wallets, `useSendTransaction()` for transactions
5. Test on localhost (https not required), then deploy to https

### 3. Create and manage wallets server-side (Node.js example)

1. Initialize: `new PrivyClient({appId, appSecret})`
2. Create a user: `client.users().create({...})`
3. Create a wallet: `client.wallets().create({userId, chainType: 'ethereum'})`
4. Send a transaction: `client.wallets().ethereum().sendTransaction(walletId, {...})`
5. For signer-based actions, generate authorization signature and pass as header

### 4. Set up policies and controls

1. Go to Dashboard > Wallet infrastructure > Policies
2. Create a policy with conditions (e.g., max transfer amount, approved recipients)
3. Assign policy to a wallet's owner or signer
4. Test policy enforcement by attempting a transaction that violates the policy
5. Use stateful policies for time-based or count-based rules

### 5. Subscribe to webhooks

1. Go to Dashboard > Configuration > Webhooks
2. Register your endpoint URL
3. Select event types (user.created, wallet.funds_deposited, transaction.confirmed, etc.)
4. Verify webhook signatures using Privy's public key
5. Implement retry logic on your endpoint (Privy retries with exponential backoff)

## Common gotchas

- **HTTPS required for production**: Embedded wallets use WebCrypto API, which only works on https:// (localhost is exempt). Wallets will silently fail to create on http://.
- **App secret is not recoverable**: If you lose your app secret, you must regenerate it in the Dashboard. Store it securely in environment variables, never in code.
- **Delegated auth requires MFA**: If using email, SMS, or social login as primary auth, enable MFA (passkey or TOTP) to protect against account compromise and wallet theft.
- **Policies are evaluated at request time**: Policies don't prevent a transaction from being broadcast; they reject it before signing. Design UX to prevent policy violations upfront.
- **Authorization signatures expire**: Requests with `privy-authorization-signature` headers must include `privy-request-expiry` header. Default is 5 minutes; adjust as needed.
- **Wallet ready state**: Always check `ready` from `useWallets()` before accessing wallet state in React. Wallets may not be loaded immediately.
- **Rate limits on REST API**: Implement exponential backoff for 429 responses. Batch requests where possible.
- **Idempotency keys prevent double-sends**: Use `idempotency-key` header for critical operations (transfers, payouts) to prevent duplicate transactions if requests retry.
- **External wallets don't support all chains**: External wallet connectors work on EVM and Solana only. For other chains, use embedded wallets.
- **User keys vs. app keys**: User keys are tied to a user's authentication; app keys are tied to your app's secret. Don't mix them up when configuring signers.

## Verification checklist

Before submitting work with Privy:

- [ ] App is deployed to https:// (not http://)
- [ ] App ID and app secret are in environment variables, not hardcoded
- [ ] PrivyProvider wraps the entire app and `ready` is checked before consuming state
- [ ] Login methods are enabled in Dashboard > Authentication
- [ ] Allowed domains are configured in Dashboard > App settings > Domains (for production)
- [ ] Wallets are created successfully (test on localhost first, then production)
- [ ] Transactions are signed and broadcast correctly (check block explorer)
- [ ] Policies are enforced (test a transaction that violates policy)
- [ ] Webhooks are registered and receiving events (check Webhooks history in Dashboard)
- [ ] Error handling is in place for failed transactions, policy violations, and auth errors
- [ ] MFA is enabled if using delegated auth (email, SMS, social)
- [ ] Authorization signatures are generated correctly for signer-based actions
- [ ] Rate limits are handled with exponential backoff

## Resources

- **Comprehensive navigation**: https://docs.privy.io/llms.txt (page-by-page listing for all docs)
- **Key concepts**: https://docs.privy.io/basics/key-concepts (authentication, wallets, controls)
- **API reference**: https://docs.privy.io/api-reference/introduction (all endpoints, auth, webhooks)
- **Recipes**: https://docs.privy.io/recipes/overview (trading apps, agents, treasury, payments)

---

> For additional documentation and navigation, see: https://docs.privy.io/llms.txt