# Power BI Modeling MCP for Codex

A Codex plugin and standalone Codex skill bundle that integrate the official Microsoft Power BI Modeling MCP server and add a local PBIR report-authoring MCP for page, visual, and interactive report authoring workflows.

## Current Release

- Version: `0.8.0`
- Milestone: `Phase 4 - Composition Authoring and Cross-Report Drillthrough`
- Highlights: grouped visuals, visibility and layer-order authoring, align/distribute/resize composition tools, cross-report drillthrough targets, and web URL/Q&A action buttons

## Upstream Acknowledgment

This project is built on top of Microsoft's official Power BI Modeling MCP server:

- https://github.com/microsoft/powerbi-modeling-mcp

## What is included

- Plugin manifest: `.codex-plugin/plugin.json`
- MCP server wiring: `.mcp.json`
- Local PBIR report authoring server: `server/powerbi-report-authoring-server.js`
- Node package metadata and runtime dependencies: `package.json`
- Bundled skills:
  - `skills/powerbi-modeling-mcp/SKILL.md`
  - `skills/powerbi-dashboard-architect/SKILL.md`
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

This performs a clean reinstall for this integration by removing any previous local install at `~/plugins/powerbi-modeling-codex`, removing any previous bundled standalone skills mirrored from repo `skills/` into `~/.codex/skills`, removing duplicate marketplace entries for `./plugins/powerbi-modeling-codex`, installing the Node dependencies used by the local PBIR report-authoring server, and updating `~/.agents/plugins/marketplace.json`.

3. Restart Codex desktop.

Installed paths:

- Plugin files: `~/plugins/powerbi-modeling-codex`
- Marketplace entry file: `~/.agents/plugins/marketplace.json`
- Bundled standalone skill files:
  - `~/.codex/skills/powerbi-modeling-mcp`
  - `~/.codex/skills/powerbi-dashboard-architect`

## Uninstall (local)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-local.ps1
```

This removes the installed plugin folder, all bundled standalone skill folders mirrored from repo `skills/`, and all marketplace entries that target `powerbi-modeling-codex`.

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

After install, restart Codex desktop so the plugin and bundled standalone skills are loaded into session context.

## Usage examples in Codex

- `USE powerbi-modeling-mcp Connect to 'CVs.pbix' in Power BI Desktop`
- `USE powerbi-modeling-mcp list tables`
- `USE powerbi-modeling-mcp create a measure to count inactive candidates`
- `USE powerbi-modeling-mcp open my PBIR project and create a new page called Executive Summary`
- `USE powerbi-modeling-mcp create a clustered column chart on Executive Summary using Sales[Category] and [Total Sales]`
- `USE powerbi-modeling-mcp rebind the line chart to Date[Month] and [Net Sales]`
- `USE powerbi-modeling-mcp create a bookmark group and add bookmark buttons on the Overview page`
- `USE powerbi-modeling-mcp configure a drillthrough page on Category and add a back button`
- `USE powerbi-modeling-mcp create a field parameter for Category, Month, and Net Sales and wire it to a slicer`
- `USE powerbi-modeling-mcp configure a tooltip page and assign it to a chart`
- `USE powerbi-modeling-mcp create a page navigator and apply-all-slicers button on Executive Summary`
- `USE powerbi-modeling-mcp group the slicer, bookmark button, and web URL button into a header composition and align them`
- `USE powerbi-modeling-mcp configure a cross-report drillthrough target page on Sales[Category]`
- `USE powerbi-modeling-mcp auto-create mobile layout metadata for my Overview page`

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

## Maintainer

- Pashupati Mishra
- LinkedIn: https://www.linkedin.com/in/pashupati-mishra/

## Notes

- This plugin focuses on semantic model operations (tables, columns, measures, relationships, DAX query, etc.).
- The public installer now mirrors all bundled repo skills into `$CODEX_HOME/skills` so discovery works through either Codex plugin loading or standalone skill loading.
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
- `report_bookmark_operations`: `List`, `Get`, `Create`, `Update`, `Delete`, `Reorder`, `CreateGroup`, `UpdateGroup`, `DeleteGroup`
- `report_interaction_operations`: `ConfigureDrillthroughPage`, `ClearDrillthroughPage`, `ConfigureCrossReportDrillthroughPage`, `ClearCrossReportDrillthroughPage`, `ConfigureTooltipPage`, `ClearTooltipPage`, `AssignTooltip`, `SetVisualInteractions`, `SetSlicerSync`, `CreatePageNavigationButton`, `CreatePageNavigator`, `CreateSlicerActionButton`, `CreateWebUrlButton`, `CreateQnaButton`, `CreateControl`, `UpdateControl`
- `report_field_parameter_operations`: `List`, `Create`, `Update`, `Delete`, `BindVisual`, `CreateSlicerControl`
- `report_mobile_layout_operations`: `List`, `Get`, `AutoCreateFromDesktop`, `PlaceVisual`, `UpdateVisual`, `RemoveVisual`, `Clear`
- `report_composition_operations`: `ListGroups`, `GetGroup`, `CreateGroup`, `UpdateGroup`, `DeleteGroup`, `AddToGroup`, `RemoveFromGroup`, `Ungroup`, `SetVisibility`, `SetLayerOrder`, `Align`, `Distribute`, `ResizeToFit`

Phase 4 local PBIR authoring now supports:

- `card`
- `multiRowCard`
- `table`
- `matrix`
- `clusteredBarChart`
- `clusteredColumnChart`
- `stackedBarChart`
- `stackedColumnChart`
- `lineChart`
- `areaChart`
- `lineAndClusteredColumnChart`
- `pieChart`
- `donutChart`
- `slicer`
- `textbox`
- true report bookmarks and bookmark groups
- drillthrough page binding and drillthrough buttons
- tooltip pages and visual-to-tooltip assignment
- page navigation buttons and generated page navigators that sync with `pages.json`
- per-visual interaction matrices and drilling-filters-other-visuals configuration
- slicer sync groups
- apply-all-slicers and clear-all-slicers buttons
- back, bookmark, drillthrough, and page-navigation buttons plus generated bookmark/page navigators
- web URL and Q&A action buttons
- grouped visuals with real PBIR `visualGroup` containers and `parentGroupName`
- selection-pane style visibility and layer-order metadata through `isHidden`, `z`, and `tabOrder`
- align, distribute, and resize-to-fit composition operations
- cross-report drillthrough page targets with `referenceScope: "CrossReport"` and `settings.useCrossReportDrillthrough`
- mobile layout authoring through per-visual `mobile.json` files
- field-parameter orchestration through the official modeling MCP with local PBIR wiring

Typical phase-4 workflows:

- create a tooltip page and assign it to one or more visuals
- create a page navigator that stays in sync with page rename, reorder, hide, and duplicate operations
- add apply-all-slicers and clear-all-slicers buttons for page-wide slicer control
- author explicit source-to-target visual interaction rules on a report page
- group visuals or nested groups, then hide, reorder, align, distribute, or resize them as a composition unit
- create cross-report drillthrough targets and enable service-compatible report settings in PBIR metadata
- add web URL and Q&A buttons using `visualLink`
- generate or update `mobile.json` layout metadata for PBIR visuals
