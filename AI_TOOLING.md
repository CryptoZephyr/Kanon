# Kanon AI Tooling

Canonical source: [Kanon AI Tooling in Notion](https://app.notion.com/p/3d8c538183128106a278f258d8a51aa7).

## Privy

- Official documentation MCP: `https://docs.privy.io/mcp`
- Official documentation index: `https://docs.privy.io/llms.txt`
- Official full documentation snapshot: `https://docs.privy.io/llms-full.txt`
- Official Agent Skill source: `https://docs.privy.io`, installed at `.claude/skills/privy/SKILL.md`

Use the MCP for current API and policy questions. Use the static files as fallback. Verify exact wallet, owner, signer, policy, authorization-key, and revoke behavior before implementation.

## ENSv2

- Official concise docs: `https://docs.ens.domains/llms.txt`
- Official full docs: `https://docs.ens.domains/llms-full.txt`
- Official AI guidance: `https://docs.ens.domains/building-with-ai/`
- Context7 MCP: `https://mcp.context7.com/mcp`
- Context7 library: `/ensdomains/docs`

The project `.mcp.json` contains the Privy and Context7 servers. The Context7 endpoint may use `CONTEXT7_API_KEY` from an external secret source. No key is stored here. ENS's official AI guidance documents Context7 and machine-readable docs, but does not document an ENS-maintained Agent Skill. No ENS Agent Skill is installed.

Before changing ENSv2 code, query current documentation for the Sepolia registry, resolver, Enhanced Access Control, Permissioned Resolver, deployments, and ABIs. Treat beta interfaces as changeable until verified.
