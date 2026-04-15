# Official Documentation Sources

Use these official sources before making workflow assumptions.

1. Microsoft Learn: Power BI MCP server docs
- https://learn.microsoft.com/power-bi/developer/mcp/
- Canonical landing page for Power BI MCP docs and links to remote/modeling MCP guidance.

2. GitHub repository: `microsoft/powerbi-modeling-mcp`
- https://github.com/microsoft/powerbi-modeling-mcp
- Primary source for Modeling MCP behavior, tool inventory, configuration examples, and troubleshooting references.

3. NPM package: `@microsoft/powerbi-modeling-mcp`
- https://www.npmjs.com/package/@microsoft/powerbi-modeling-mcp
- Installation and package-level usage for local MCP startup via `npx`.

4. Troubleshooting guide
- https://github.com/microsoft/powerbi-modeling-mcp/blob/main/TROUBLESHOOTING.md
- Known issues and recovery steps for startup and connection failures.

## Practical notes for Codex integration

- The current package exposes operation names like `Connect` and `ListLocalInstances` under `connection_operations`.
- Natural-language prompts such as "Connect to '[File Name]' in Power BI Desktop" are client-side orchestration patterns; the raw MCP tool call still maps to `connection_operations` with `operation: Connect` and a connection string.
- Keep an operation map synced from live MCP `HELP` output using `scripts/pbi_mcp_client.js catalog`.
