# Power BI Modeling MCP for Codex

A Codex plugin that integrates the official Microsoft Power BI Modeling MCP server and provides a ready-to-use skill for semantic model operations.

## What is included

- Plugin manifest: `.codex-plugin/plugin.json`
- MCP server wiring: `.mcp.json`
- Skill: `skills/powerbi-modeling-mcp/SKILL.md`
- Local fallback MCP client: `skills/powerbi-modeling-mcp/scripts/pbi_mcp_client.js`
- Live operation catalog (generated from MCP `HELP` responses):
  - `skills/powerbi-modeling-mcp/references/operations-index.md`
  - `skills/powerbi-modeling-mcp/references/operations-catalog.json`
- Installer script: `scripts/install-local.ps1`

## Prerequisites

- Windows with Power BI Desktop installed
- Node.js 18+
- Codex desktop installed
- GitHub CLI (`gh`) optional, for publishing updates

## Install (local)

1. Clone this repo.
2. Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-local.ps1
```

This copies the plugin into `~/plugins/powerbi-modeling-codex` and updates `~/.agents/plugins/marketplace.json`.

3. Restart Codex desktop.

## Usage examples in Codex

- `USE powerbi-modeling-mcp Connect to 'CVs.pbix' in Power BI Desktop`
- `USE powerbi-modeling-mcp list tables`
- `USE powerbi-modeling-mcp create a measure to count inactive candidates`

## Regenerate operations catalog

```powershell
node .\skills\powerbi-modeling-mcp\scripts\pbi_mcp_client.js catalog --out .\skills\powerbi-modeling-mcp\references\operations-catalog.json
```

Then rebuild the summary index if needed.

## Official references

- Microsoft Learn: https://learn.microsoft.com/power-bi/developer/mcp/
- GitHub: https://github.com/microsoft/powerbi-modeling-mcp
- NPM: https://www.npmjs.com/package/@microsoft/powerbi-modeling-mcp
- Troubleshooting: https://github.com/microsoft/powerbi-modeling-mcp/blob/main/TROUBLESHOOTING.md

## Notes

- This plugin focuses on semantic model operations (tables, columns, measures, relationships, DAX query, etc.).
- Report canvas visual authoring in Power BI Desktop UI is not exposed by the current modeling MCP operations.
