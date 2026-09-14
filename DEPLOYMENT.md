# Kanon Deployment

Canonical deployment record for the current repository and hosted services.

Status as of 2026-09-14: T15 and T16 are complete, and the T17 Vercel deployment portion is live. The approved frontend is implemented and its complete lifecycle was verified against the deployed backend. The default production alias is live. The requested `kanon.agents.vercel.app` alias is blocked because Vercel reserves `*.agents.vercel.app` for another account. T17 demo rehearsal and final alias resolution remain open.

## Repository

- Repository: `https://github.com/CryptoZephyr/Kanon`
- Visibility: private
- Branch: `main`
- Previous verified application commit before this documentation reconciliation: `a5ebf6405c942631516ccfe630f9ab5c594c8879`
- Source commit used for the current Vercel production deployment: `54b3047ad0e75709cac631e172c4b1a77c33ef49`
- Node.js: `22.23.2`
- pnpm: `11.5.0`
- Frontend package: `apps/web`
- Build command: `pnpm build:web`
- Frontend output: Vite `dist`

## Live backend

| Service  | Provider | URL                               | Service ID                     | Latest live deployment                       |
| -------- | -------- | --------------------------------- | ------------------------------ | -------------------------------------------- |
| API      | Render   | https://kanon-api.onrender.com    | `srv-daj103tg1s2s7391ov3g`     | `dep-dajt9kojo6nc73cn9jqg`, commit `85c7434` |
| Runner   | Render   | https://kanon-runner.onrender.com | `srv-daj102fqj5pc73bs02r0`     | `dep-dajt9kojo6nc73cn9jhg`, commit `85c7434` |
| Database | Neon     | private connection                | project `kanon-ethonline-2026` | PostgreSQL 18, `aws-eu-central-1`            |

Verified backend state:

- API health returned `ok` and database `ok`.
- Runner health returned `ok` and database `ok`.
- Render environment state contains the company API token and backend control credentials. No secret value is recorded here or in the repository.
- ENS writes remain limited to the owner-authorized Sepolia namespace `kanon-ethonline-2026.eth`.

## Frontend state

T15 is complete in the repository.

- The special landing page, exact approved logo, and six approved screens are implemented in `apps/web`.
- The frontend uses the approved Field / Structure / Signal system, responsive behavior, accessible native controls, and reduced-motion behavior.
- The client uses `/api` by default. The local Vite development proxy attaches `KANON_COMPANY_API_TOKEN` server-side and never sends it to browser code.
- The current local `.env.local` does not contain `KANON_COMPANY_API_TOKEN`, so local mutation calls fail closed until that variable is configured. Render holds the backend token server-side.
- The live lifecycle proof used installation `installation-release-web-live-20260914-f`. Initial approval and reauthorization returned HTTP `202`, activation reached generations 0 and 1, the update was `EXPANDED` with human review required, and revoke confirmed Privy authority removal, ENS `revoked`, and failed post-revoke delegated execution.
- Evidence: [frontend lifecycle proof](evidence/frontend/t15-live-latest.json).
- The frontend is live at `https://kanon-agents.vercel.app` through Vercel project `kanon-agents` (`prj_N24mPu3Av0eWyqqekzxzHtsNYbOr`). The current production deployment is `dpl_9HrLAS5RmXHkhXWMZRjmUFj99WdQ` and is ready.
- The Vercel production environment contains `KANON_COMPANY_API_TOKEN` as a sensitive server-side variable. No secret value is recorded here or in the repository.
- Chrome verification passed on the live default alias: the landing page loaded, the workspace showed `API connected`, the organization and ENS namespace read back, and the Add an agent screen rendered.
- The requested alias `kanon.agents.vercel.app` could not be assigned. Vercel returned that `*.agents.vercel.app` subdomains are reserved for another account. No alias mutation was made for that hostname.

## Vercel deployment boundary

The local Vite proxy is not the production path. The production Vercel function at `api/[...path].ts` forwards `/api/*` to Render and attaches `KANON_COMPANY_API_TOKEN` server-side. A static Vercel rewrite directly to Render would omit the company token and make company-authenticated mutations fail closed. Putting `KANON_COMPANY_API_TOKEN` in a `VITE_` variable would expose a secret to the browser and is forbidden.

The production frontend needs:

1. A Vercel project linked to this repository and scoped to `apps/web`.
2. A server-side `/api` proxy or Vercel function that forwards requests to `https://kanon-api.onrender.com` and attaches `KANON_COMPANY_API_TOKEN` from Vercel server-side environment state.
3. Public frontend configuration only, such as the Render API origin. No Privy, ENS, owner, signer, or company-token secret belongs in browser environment variables.
4. A production smoke test for health, organization readback, the six screens, asynchronous approval polling, update reauthorization, and revoke.

## T17 remaining action

The Vercel deployment, server-side proxy, production environment, default alias, API health check, and browser smoke check are complete. Resolve the alias decision by keeping `kanon-agents.vercel.app` or selecting another available alias, then run the disposable create to revoke demo flow and freeze the evidence records.

Do not make a mainnet ENS write. Keep Render as the backend authority plane and keep all sponsor credentials server-side.

## Evidence and checks

- [T15 frontend lifecycle proof](evidence/frontend/t15-live-latest.json)
- [T16 Render and Neon deployment proof](evidence/deployment/render-neon-latest.json)
- [T11 to T13 lifecycle proof](evidence/lifecycle/t11-t13-latest.json)
- `pnpm install --frozen-lockfile` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed, 9 files and 58 tests.
- `pnpm lint` passed.
- `pnpm format:check` passed.
- `pnpm build:web` passed.
- `git diff --check` passed.
