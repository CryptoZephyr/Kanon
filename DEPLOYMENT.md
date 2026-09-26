# Kanon deployment record

Current deployment of the 3rd-Web-Hack release (`v0.3.0`, release label `kanon-3rd-web-hack-2026.09`). No secret values are recorded here.

## Live services

| Service          | Provider                                           | URL                                                                                                                     | Notes                                                                                                                                    |
| ---------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend + proxy | Vercel project `kanon-agents`                      | https://kanon-agents.vercel.app                                                                                         | Static Vite build plus the `api/kanon-proxy.ts` function (`maxDuration` 120 s)                                                           |
| API              | Render `kanon-api` (`srv-daj103tg1s2s7391ov3g`)    | https://kanon-api.onrender.com/healthz                                                                                  | Native Node.js 22, start command `node --import tsx apps/api/src/server.ts`                                                              |
| Runner           | Render `kanon-runner` (`srv-daj102fqj5pc73bs02r0`) | https://kanon-runner.onrender.com/healthz                                                                               | Native Node.js 22, start command `node --import tsx apps/runner/src/server.ts`                                                           |
| Database         | Neon PostgreSQL                                    | private                                                                                                                 | Installations, releases, evidence, proofs                                                                                                |
| Chain            | Ethereum Sepolia                                   | chain ID `11155111`                                                                                                     | Privy demo wallet `0x42D5Fb257d479187607D47C19433Be6aEEd4a9A9`; organization control wallet `0x8b88E1E1174eDC65B08de75A5439f130da8A3DFd` |
| ENS              | ENSv2 on Sepolia                                   | `kanon-ethonline-2026.eth` → `agents.kanon-ethonline-2026.eth` → `representative-agent.agents.kanon-ethonline-2026.eth` | Namespace registered during the original build and reused unchanged                                                                      |

Render deploys the API and runner automatically from `main`. The Vercel project is deployed with the Vercel CLI (`vercel --prod`).

## Credentials and where they live

| Variable                                  | API (Render) | Runner (Render) | Vercel | Browser |
| ----------------------------------------- | :----------: | :-------------: | :----: | :-----: |
| `KANON_COMPANY_API_TOKEN` (operator)      |     yes      |       no        | **no** |   no    |
| `KANON_DEMO_API_TOKEN` (public demo role) |     yes      |       no        |  yes   |   no    |
| Privy app secret                          |     yes      |       yes       |   no   |   no    |
| Privy owner authorization key             |     yes      |       no        |   no   |   no    |
| Privy agent signer key                    |      no      |       yes       |   no   |   no    |
| ENS control (writer) key                  |     yes      |       no        |   no   |   no    |
| `RUNNER_SHARED_SECRET`                    |     yes      |       yes       |   no   |   no    |
| `DATABASE_URL`                            |     yes      |       yes       |   no   |   no    |

The company API token was removed from Vercel in this release. Visitor requests carry only the demo credential, which the API limits to the guided flow.

## 3rd-Web-Hack deployment (2026-09-26)

- Application commit `3537e80` deployed to Render: API deploy `dep-dargin67bikc739be9tg`, runner deploy `dep-dargin67bikc739bea90`. Both `/healthz` endpoints report `release: "kanon-3rd-web-hack-2026.09"`.
- Start-up now takes about 19 seconds from process start to listening, down from about 30 seconds, because the start command no longer downloads pnpm through corepack on every boot.
- Vercel production deployment aliased to `https://kanon-agents.vercel.app` with `KANON_DEMO_API_TOKEN` set and `KANON_COMPANY_API_TOKEN` removed.
- Demo wallet top-up of 0.02 Sepolia ETH from the organization control wallet: [`0x04cbf622…ea13`](https://sepolia.etherscan.io/tx/0x04cbf622f117f1f57e05e9991fb31740afb8c80d57f9c5295958d434eaf8ea13).
- `.github/workflows/keep-warm.yml` requests the proxy status endpoint and the runner (configured every 10 minutes until 2026-10-03). GitHub runs schedules on a best-effort basis and has run it only every few hours, so the first request after idle can still take up to a minute.

### Live checks

| Check                                                                          | Result                                                                             |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `POST /api/v1/proof/run` through the proxy                                     | 403                                                                                |
| Same request with a visitor-supplied `x-kanon-company-token` header            | 403 (header stripped)                                                              |
| Unknown path through the proxy                                                 | 403                                                                                |
| API organization route with no token                                           | 401                                                                                |
| Demo terms with a foreign recipient, or 5000 wei                               | 422 `DEMO_TERMS_OUT_OF_BOUNDS`                                                     |
| `GET /api/v1/status`                                                           | 200, runner `ok`                                                                   |
| `pnpm smoke:live` run 1                                                        | passed all 12 steps ([evidence](evidence/3rd-web-hack/live-judge-flow-run-1.json)) |
| `pnpm smoke:live` run 2, started from the revoked fixture with no manual reset | passed all 12 steps ([evidence](evidence/3rd-web-hack/live-judge-flow-run-2.json)) |

Both runs produced a confirmed allowed Sepolia transaction, a `PRIVY_POLICY_REJECTED_400` forbidden rejection, an `EXPANDED` update requiring human review, reauthorization to generation 1, revocation at generation 2 with Privy authority removed and ENS status `revoked`, and a post-revoke attempt refused with `RUNNER_REFUSED_STALE_OR_REVOKED`.

## Operating notes

- Render free services sleep after about 15 minutes idle. The frontend retries automatically; the scheduled keep-warm reduces cold starts but runs only every few hours in practice, so a first request after idle can still take up to a minute.
- Only one session can hold the shared signer and ENS name. Idle sessions expire after 20 minutes (`KANON_DEMO_LEASE_TTL_SECONDS` overrides this).
- The operator lifecycle proof (`POST /v1/proof/run`, company token only) now writes its own ENS baseline after Privy authority is attached, so it no longer needs a manual fixture reset.
- Keep all ENS writes inside the Sepolia namespace above. No mainnet write is authorized.

## Original build deployment

The API, runner, database and frontend were first deployed during ETHOnline 2026. Records from that build: [Render and Neon](evidence/deployment/render-neon-latest.json), [frontend rehearsals](evidence/deployment/t17-live-latest.json), [frontend lifecycle](evidence/frontend/t15-live-latest.json), [lifecycle proof](evidence/lifecycle/t11-t13-latest.json).
