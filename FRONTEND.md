# Kanon Frontend

Canonical source: [Kanon Frontend in Notion](https://app.notion.com/p/3d8c5381831281e781e7cc5c72c4c9db).

The owner-approved T15 product-design handoff is live. This file records the implementation locks. The linked Notion page remains authoritative for the complete design direction and screen requirements.

## Ownership rule

Implement the approved system exactly. Do not add screens, restyle the product, import a prebuilt theme, reinterpret sponsor examples, or invent a second visual language.

## Approved visual direction

Kanon is institutional financial-control infrastructure with a visible technical authority layer. The temperament is calm and operational, with restrained technical metadata. The shared fingerprint is Swiss structure, editorial art direction, neo-grotesk typography, monospace metadata, monochrome or conceptual media, strong negative space, and controlled experimentation.

Use the governing Field / Structure / Signal model:

- product UI: 82% Field, 15% Structure, 3% Signal;
- landing page: 70% Field, 25% Structure or editorial media, 5% Signal;
- signal is reserved for approval, authority expansion, changed rules, focused interaction, warnings, and revoke actions.

Use a 12-column desktop grid, deliberate asymmetry, visible rules where they organize real information, restrained surfaces, and cards only when containment is functionally useful. Navigation stays visually subordinate to the work surface. The product must not become a crypto wallet dashboard, generic SaaS admin panel, developer console, terminal, or sponsor-branded shell.

Use a neo-grotesk or grotesk family for display, body, controls, and interface text. Use monospace only for IDs, ENS names, versions, hashes, policy and signer references, timestamps, state codes, and aligned limit data. Use a mostly neutral low-chroma canvas, one institutional accent, and restrained semantic warning and destructive signals. Technical and editorial blocks use sharp geometry, normally 0 to 4px radius, with restrained control rounding and rare subtle shadows.

Use the exact approved standalone logo at `apps/web/public/kanon-approved-logo.svg`. Do not redraw, simplify, reinterpret, or replace its geometry.

## Approved scope

The product contains one special landing page and exactly six application screens:

1. Agents / Organization, a structured registry of agents and attention state.
2. Add Agent, showing the agent request before any company grant.
3. Define Authority, a structured authority document for the verified company terms.
4. Approval Review, a human financial-mandate decision boundary.
5. Agent Detail, the operational control point for active state, evidence, update, and revoke.
6. Update / Reauthorization, a redline-style current-versus-requested authority comparison.

Revoke lives inside Agent Detail. It is not a seventh screen.

## State and interaction locks

The core hierarchy is Agent, Authority, Status, then Changes requiring attention. Active is neutral and structural. Authorization required uses the primary accent. Expanded authority uses a restrained local warning mark. Revoked communicates subtraction first, with restrained destructive support. State must never rely on color alone.

The Update / Reauthorization screen is the application visual north star. Unchanged rows stay quiet. Changed rows remain in the same field, receive a local rule and stronger type, and may carry concise delta labels such as `LIMIT +`, `NEW RECIPIENT`, `NEW FUNCTION`, or `SCOPE EXPANDED`. Do not use two large differently colored columns or raw JSON as the primary review surface.

Motion is restrained and must reinforce hierarchy, state, composition, or feedback. Reduced motion must remove nonessential movement. Responsive layouts preserve Agent, Authority, Status, and Changes requiring attention in that order. Comparison regions may stack, but changed markers stay attached to the affected rule and critical meaning never depends on hover.

Use owned accessible primitives and native semantic controls. Base UI is preferred when a headless primitive is needed. Radix UI remains acceptable for a specific primitive. Do not inherit a prebuilt theme, generic card system, default badge language, or default SaaS composition.

## API boundary

The browser must never receive the company API token. The web development proxy may attach the token server-side from ignored environment state. The frontend client follows the frozen company-authenticated API contract in `packages/shared/src/api-contracts.ts` and reads the deployed organization, agent, installation, company-terms, approval, update-diff, evidence, revoke, health, and proof routes.

Approval and reauthorization return HTTP `202` after the API persists `CONFIGURING_AUTHORITY` or `AWAITING_REAUTHORIZATION`. Privy and ENS configuration then runs asynchronously. The frontend polls the installation every two seconds and enters the active detail state only after `ACTIVE` is persisted. If provider configuration does not settle to `ACTIVE`, the UI keeps the installation fail-closed and reports the unresolved state.

## Completion definition

T15 is complete when the landing page, all six screens, active, authorization-required, expanded-authority, and revoked states, the redline comparison, Field / Structure / Signal usage, typography and surface rules, accessible controls, responsive hierarchy, and restrained motion are implemented from this handoff. The deployed API route surface must support create, authority, approval, active activation, update and reauthorization, and revoke without exposing secrets or changing the frozen contracts for convenience. The live proof for that boundary is recorded in `evidence/frontend/t15-live-latest.json`.
