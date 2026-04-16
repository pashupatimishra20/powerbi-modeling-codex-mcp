# Power BI Modeling MCP for Codex

A Codex plugin and standalone Codex skill bundle that integrate the official Microsoft Power BI Modeling MCP server and add a local PBIR report-authoring MCP for page and visual creation workflows.

## Upstream Acknowledgment

This project is built on top of Microsoft's official Power BI Modeling MCP server:

- https://github.com/microsoft/powerbi-modeling-mcp

## What is included

- Plugin manifest: `.codex-plugin/plugin.json`
- MCP server wiring: `.mcp.json`
- Local PBIR report authoring server: `server/powerbi-report-authoring-server.js`
- Node package metadata and runtime dependencies: `package.json`
- Skill: `skills/powerbi-modeling-mcp/SKILL.md`
- Local fallback MCP client: `skills/powerbi-modeling-mcp/scripts/pbi_mcp_client.cjs`
- Live operation catalog (generated from MCP `HELP` responses):
  - `skills/powerbi-modeling-mcp/references/operations-index.md`
  - `skills/powerbi-modeling-mcp/references/operations-catalog.json`
- Installer script: `scripts/install-local.ps1`
- Uninstaller script: `scripts/uninstall-local.ps1`
- Bootstrap installer (one command): `scripts/bootstrap-install.ps1`
- GitHub Pages entry file: `index.html`
- End-user guide page (same content): `end-user-guide.html`

Open the guide directly in a browser for onboarding visuals and copy-ready commands.

## GitHub Pages

This repo is ready for GitHub Pages because it now includes `index.html`.

After making the repo public and enabling Pages (`main` branch / root), the site URL will be:

- `https://pashupatimishra20.github.io/powerbi-modeling-codex-mcp/`

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

This performs a clean reinstall for this integration by removing any previous local install at `~/plugins/powerbi-modeling-codex`, removing any previous standalone skill at `~/.codex/skills/powerbi-modeling-mcp`, removing duplicate marketplace entries for `./plugins/powerbi-modeling-codex`, installing the Node dependencies used by the local PBIR report-authoring server, and updating `~/.agents/plugins/marketplace.json`.

3. Restart Codex desktop.

Installed paths:

- Plugin files: `~/plugins/powerbi-modeling-codex`
- Marketplace entry file: `~/.agents/plugins/marketplace.json`
- Standalone skill files: `~/.codex/skills/powerbi-modeling-mcp`

## Uninstall (local)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-local.ps1
```

This removes the installed plugin folder, the installed standalone skill folder, and all marketplace entries that target `powerbi-modeling-codex`.

## Install (public one-command bootstrap)

This flow assumes the repository is public.

Run this from PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex (irm 'https://raw.githubusercontent.com/pashupatimishra20/powerbi-modeling-codex-mcp/main/scripts/bootstrap-install.ps1')"
```

Running the same bootstrap command again performs the same clean reinstall. `-Force` is still accepted for backward compatibility, but it is no longer required:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create((irm 'https://raw.githubusercontent.com/pashupatimishra20/powerbi-modeling-codex-mcp/main/scripts/bootstrap-install.ps1'))) -Force"
```

After install, restart Codex desktop so both the plugin and standalone skill are loaded into session context.

## Usage examples in Codex

- `USE powerbi-modeling-mcp Connect to 'CVs.pbix' in Power BI Desktop`
- `USE powerbi-modeling-mcp list tables`
- `USE powerbi-modeling-mcp create a measure to count inactive candidates`
- `USE powerbi-modeling-mcp open my PBIR project and create a new page called Executive Summary`
- `USE powerbi-modeling-mcp create a clustered column chart on Executive Summary using Sales[Category] and [Total Sales]`
- `USE powerbi-modeling-mcp rebind the line chart to Date[Month] and [Net Sales]`

## Regenerate operations catalog

```powershell
node .\skills\powerbi-modeling-mcp\scripts\pbi_mcp_client.cjs catalog --out .\skills\powerbi-modeling-mcp\references\operations-catalog.json
```

Then rebuild the summary index if needed.

## Official references

- Microsoft Learn: https://learn.microsoft.com/power-bi/developer/mcp/
- GitHub: https://github.com/microsoft/powerbi-modeling-mcp
- NPM: https://www.npmjs.com/package/@microsoft/powerbi-modeling-mcp
- Troubleshooting: https://github.com/microsoft/powerbi-modeling-mcp/blob/main/TROUBLESHOOTING.md

## Notes

- This plugin focuses on semantic model operations (tables, columns, measures, relationships, DAX query, etc.).
- The public installer now provisions both the plugin and a standalone skill so discovery works through either Codex plugin loading or `$CODEX_HOME/skills`.
- PBIR/PBIP report authoring is now supported through the local `powerbi-report-authoring-mcp` server.
- PBIX binary editing is still out of scope. Convert PBIX to PBIP/PBIR in Power BI Desktop first using `File > Save As`.
- External PBIR changes require reopening or restarting Power BI Desktop before they appear in the authoring canvas.
- If Codex cannot handshake with MCP in-session, use the included fallback client:

```powershell
node .\skills\powerbi-modeling-mcp\scripts\pbi_mcp_client.cjs list-tools
```

## Report Authoring Tool Surface

The local report-authoring MCP adds these tool families:

- `report_project_operations`: `OpenProject`, `GetProject`, `ValidateProject`, `ListSchemas`
- `report_page_operations`: `List`, `Get`, `Create`, `Update`, `Delete`, `Reorder`, `Duplicate`
- `report_visual_operations`: `List`, `Get`, `Create`, `Update`, `Delete`, `Duplicate`, `Move`, `BindFields`, `SetFormatting`

Phase 1 visual support includes:

- `card`
- `multiRowCard`
- `table`
- `matrix`
- `clusteredBarChart`
- `clusteredColumnChart`
- `lineChart`
- `pieChart`
- `slicer`
- `textbox`
