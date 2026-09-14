# Kanon Deployment

Canonical deployment record for the current repository and hosted services.

Status as of 2026-09-14: T15, T16, and T17 are complete. The approved frontend is live, its server-side API proxy is verified on deep routes, and three browser rehearsals completed the disposable create, approval, active, update, reauthorization, and revoke flow. The requested `kanon.agents.vercel.app` alias is unavailable because Vercel reserves `*.agents.vercel.app` for another account. The default production alias remains the verified public entry point.

## Repository

- Repository: `https://github.com/CryptoZephyr/Kanon`
- Visibility: private
- Branch: `main`
- Previous verified application commit before this documentation reconciliation: `a5ebf6405c942631516ccfe630f9ab5c594c8879`
- Source commit used for the current Vercel production deployment: `ed3e190`
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

Render uses native Node.js 22 services with the build and start commands in `render.yaml`. No Docker image is required for the current deployment.

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
- The frontend is live at `https://kanon-agents.vercel.app` through Vercel project `kanon-agents` (`prj_N24mPu3Av0eWyqqekzxzHtsNYbOr`). The current production deployment is `dpl_DUmPjGX6VWegUm58YqoxiUwAyW8c` and is ready.
- The Vercel production environment contains `KANON_COMPANY_API_TOKEN` as a sensitive server-side variable. No secret value is recorded here or in the repository.
- Chrome verification passed on the live default alias: the landing page loaded, the workspace showed `API connected`, the organization and ENS namespace read back, the Add an agent screen rendered, deep `/api/v1/*` routes reached Render, and three full browser rehearsals ended in `REVOKED` generation 2.
- The requested alias `kanon.agents.vercel.app` could not be assigned. Vercel returned that `*.agents.vercel.app` subdomains are reserved for another account. No alias mutation was made for that hostname.

## Vercel deployment boundary

The local Vite proxy is not the production path. The production Vercel function at `api/kanon-proxy.ts`, reached through the explicit routes in `vercel.json`, forwards `/api/*` to Render and attaches `KANON_COMPANY_API_TOKEN` server-side. A static Vercel rewrite directly to Render would omit the company token and make company-authenticated mutations fail closed. Putting `KANON_COMPANY_API_TOKEN` in a `VITE_` variable would expose a secret to the browser and is forbidden.

The production frontend needs:

1. A Vercel project linked to this repository and scoped to `apps/web`.
2. A server-side `/api` proxy or Vercel function that forwards requests to `https://kanon-api.onrender.com` and attaches `KANON_COMPANY_API_TOKEN` from Vercel server-side environment state.
3. Public frontend configuration only, such as the Render API origin. No Privy, ENS, owner, signer, or company-token secret belongs in browser environment variables.
4. A production smoke test for health, organization readback, the six screens, asynchronous approval polling, update reauthorization, and revoke.

## T17 complete

- Vercel project `kanon-agents` is live at `https://kanon-agents.vercel.app` with production deployment `dpl_DUmPjGX6VWegUm58YqoxiUwAyW8c`.
- The requested `kanon.agents.vercel.app` alias was attempted once and rejected by Vercel as reserved for another account. No mutation was made for that hostname.
- Production health returned HTTP `200` with API and database `ok`. Organization readback returned the Sepolia namespace `agents.kanon-ethonline-2026.eth`.
- The production proxy passed the deep release publish route and the live browser mutation routes. The proxy keeps the company token server-side.
- Browser rehearsals completed with installations `installation-release-t17-rehearsal-2`, `installation-release-t17-rehearsal-3`, and `installation-release-t17-rehearsal-4`. Each reached active generation 0, displayed exact human approval, classified the broader update as requiring reauthorization, reached active generation 1, and ended at revoked generation 2 with Privy authority removed, ENS revoked, and post-revoke execution rejected.
- The live proof run `1fc70730-9172-4111-bdac-20cd6c04f146` passed T11 to T13 through the deployed API, runner, Neon, Privy, and ENSv2. It includes an allowed transaction receipt, forbidden policy rejection, blocked pre-reauthorization expansion, active generation 1, post-revoke rejection, signer count zero, and unauthorized ENS restore rejection.
- Non-secret evidence is recorded in `evidence/deployment/t17-live-latest.json`.

Do not make a mainnet ENS write. Keep Render as the backend authority plane and keep all sponsor credentials server-side.

## Public consumption pass

- The root README is now product-first and links only to the public deployment, submission brief, implementation status, deployment boundary, and security policy.
- `docs/submission.md` provides the judge path, sponsor boundary, evidence links, claims boundary, and current repository state.
- `docs/implementation-status.md` separates live, tested, blocked, and future work.
- `.github/workflows/ci.yml` runs the pinned Node.js and pnpm install, typecheck, test, lint, format, and frontend build checks on `main` pushes and pull requests.
- Relative links in the public documentation resolve locally, the tracked-file secret-pattern scan returned no real credential matches, and the live Vercel browser surface passed the landing, workspace, API connection, namespace readback, agent detail, reload, and console checks.
- GitHub visibility remains private. The repository now includes the MIT License in `LICENSE`; changing visibility remains an explicit owner decision.

## Evidence and checks

- [T15 frontend lifecycle proof](evidence/frontend/t15-live-latest.json)
- [T16 Render and Neon deployment proof](evidence/deployment/render-neon-latest.json)
- [T17 live frontend deployment and rehearsal proof](evidence/deployment/t17-live-latest.json)
- [T11 to T13 lifecycle proof](evidence/lifecycle/t11-t13-latest.json)
- `pnpm install --frozen-lockfile` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed, 9 files and 58 tests.
- `pnpm lint` passed.
- `pnpm format:check` passed.
- `pnpm build:web` passed.
- `git diff --check` passed.
