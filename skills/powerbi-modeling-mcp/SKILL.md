---
name: powerbi-modeling-mcp
description: Operate Power BI semantic models through the official `@microsoft/powerbi-modeling-mcp` server and author PBIR/PBIP report pages and visuals through the local `powerbi-report-authoring-mcp` server. Use when a user asks to connect to PBIX/PBIP/BIM/TMDL models, inspect model metadata, create/update/delete modeling objects, or create report pages and visuals from Codex.
---

# Power BI Modeling MCP

## Overview

Use this skill for a two-server workflow:

- Semantic model changes: official `powerbi-modeling-mcp`
- PBIR/PBIP report authoring: local `powerbi-report-authoring-mcp`

This skill also includes a Node-based fallback client and a generated operation catalog for the official modeling MCP operations.

## Quick Start

1. Check official references:
- `references/official-docs.md`
- `references/operations-index.md`

2. List tools exposed by the current MCP build:

```bash
node scripts/pbi_mcp_client.cjs list-tools
```

3. Generate or refresh operation catalog from live `HELP` endpoints:

```bash
node scripts/pbi_mcp_client.cjs catalog --out references/operations-catalog.json
```

4. Connect to a local Power BI Desktop instance for semantic model work:

```bash
node scripts/pbi_mcp_client.cjs call connection_operations "{\"request\":{\"operation\":\"ListLocalInstances\"}}"
node scripts/pbi_mcp_client.cjs call connection_operations "{\"request\":{\"operation\":\"Connect\",\"ConnectionString\":\"Data Source=localhost:<port>;Application Name=MCP-PBIModeling\"}}"
```

5. For report authoring, open a PBIR/PBIP project and use the report tools:

```text
report_project_operations -> OpenProject
report_page_operations -> Create
report_visual_operations -> Create / BindFields / SetFormatting
```

## Core Workflow

1. Discover context:
- Use `connection_operations` (`ListLocalInstances`, `ListConnections`, `GetConnection`) to identify active instances and connection names.
- Use `table_operations` `LIST` and `column_operations` `LIST` for schema shape.
- If the user wants visuals/pages, require a PBIR/PBIP project path and open it with `report_project_operations`.

2. Pick the right tool:
- Use `references/operations-index.md` for tool-to-operation mapping.
- If uncertain, call `HELP` on the target tool:

```bash
node scripts/pbi_mcp_client.cjs help measure_operations
```

3. Execute operation:
- Use `scripts/pbi_mcp_client.cjs call <tool> '<json>'`.
- Keep payload shape aligned with `HELP` examples (`Definitions`, `References`, `RenameDefinitions`, `MoveDefinitions`).
- For report authoring, prefer explicit tool calls:
  - `report_page_operations` for page CRUD/reorder/duplicate
  - `report_visual_operations` for visual CRUD/move/rebind/basic formatting

4. Validate:
- Read back using `GET`/`LIST` operations.
- For DAX, use `dax_query_operations` with `Validate` before `Execute`.
- For PBIR projects, always run `report_project_operations` `ValidateProject` after writes.

## Safety Rules

- Prefer read operations first (`HELP`, `LIST`, `GET`) before writes.
- When applying multiple writes, use operation batch `Options` with transaction semantics where supported.
- Do not run destructive deletes without confirming scope (table, measure, relationship name, and dependencies).
- Re-query after writes to confirm model state.
- Do not attempt report visual authoring against `.pbix` directly. Require PBIR/PBIP inputs.
- Tell the user Power BI Desktop must be reopened or restarted after external PBIR file edits.

## Troubleshooting

- If native client MCP handshake fails, use `scripts/pbi_mcp_client.cjs` as transport fallback.
- If startup fails on first run, pre-warm package:

```bash
npx -y @microsoft/powerbi-modeling-mcp@latest --help
```

- If connection fails, verify local instance discovery:

```bash
node scripts/pbi_mcp_client.cjs call connection_operations "{\"request\":{\"operation\":\"ListLocalInstances\"}}"
```

- Cross-check official troubleshooting:
  `references/official-docs.md` -> `TROUBLESHOOTING.md`.

## Resources

- `scripts/pbi_mcp_client.cjs`: Local JSON-RPC client for the Power BI Modeling MCP server.
- `server/powerbi-report-authoring-server.js`: Local MCP server for PBIR project/page/visual operations.
- `references/official-docs.md`: Microsoft/GitHub/NPM official doc links and usage notes.
- `references/operations-catalog.json`: Full generated `HELP` payloads for all tools.
- `references/operations-index.md`: Human-readable tool/operation matrix.
