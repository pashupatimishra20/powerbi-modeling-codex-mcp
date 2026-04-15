---
name: powerbi-modeling-mcp
description: Operate Power BI semantic models through the official `@microsoft/powerbi-modeling-mcp` server across all tool families (connection, database, model, table, column, measure, relationship, DAX query, partition, perspective, hierarchy, calculation groups, roles, culture, translations, functions, query groups, transactions, and traces). Use when a user asks to connect to PBIX/PBIP/BIM/TMDL models, inspect model metadata, or create/update/delete modeling objects from Codex.
---

# Power BI Modeling MCP

## Overview

Use this skill to run Power BI Modeling MCP operations from Codex even when native MCP handshake in the host client is unreliable.
This skill includes a Node-based MCP client and a generated operation catalog covering all currently exposed operations.

## Quick Start

1. Check official references:
- `references/official-docs.md`
- `references/operations-index.md`

2. List tools exposed by the current MCP build:

```bash
node scripts/pbi_mcp_client.js list-tools
```

3. Generate or refresh operation catalog from live `HELP` endpoints:

```bash
node scripts/pbi_mcp_client.js catalog --out references/operations-catalog.json
```

4. Connect to a local Power BI Desktop instance:

```bash
node scripts/pbi_mcp_client.js call connection_operations "{\"request\":{\"operation\":\"ListLocalInstances\"}}"
node scripts/pbi_mcp_client.js call connection_operations "{\"request\":{\"operation\":\"Connect\",\"ConnectionString\":\"Data Source=localhost:<port>;Application Name=MCP-PBIModeling\"}}"
```

## Core Workflow

1. Discover context:
- Use `connection_operations` (`ListLocalInstances`, `ListConnections`, `GetConnection`) to identify active instances and connection names.
- Use `table_operations` `LIST` and `column_operations` `LIST` for schema shape.

2. Pick the right tool:
- Use `references/operations-index.md` for tool-to-operation mapping.
- If uncertain, call `HELP` on the target tool:

```bash
node scripts/pbi_mcp_client.js help measure_operations
```

3. Execute operation:
- Use `scripts/pbi_mcp_client.js call <tool> '<json>'`.
- Keep payload shape aligned with `HELP` examples (`Definitions`, `References`, `RenameDefinitions`, `MoveDefinitions`).

4. Validate:
- Read back using `GET`/`LIST` operations.
- For DAX, use `dax_query_operations` with `Validate` before `Execute`.

## Safety Rules

- Prefer read operations first (`HELP`, `LIST`, `GET`) before writes.
- When applying multiple writes, use operation batch `Options` with transaction semantics where supported.
- Do not run destructive deletes without confirming scope (table, measure, relationship name, and dependencies).
- Re-query after writes to confirm model state.

## Troubleshooting

- If native client MCP handshake fails, use `scripts/pbi_mcp_client.js` as transport fallback.
- If startup fails on first run, pre-warm package:

```bash
npx -y @microsoft/powerbi-modeling-mcp@latest --help
```

- If connection fails, verify local instance discovery:

```bash
node scripts/pbi_mcp_client.js call connection_operations "{\"request\":{\"operation\":\"ListLocalInstances\"}}"
```

- Cross-check official troubleshooting:
  `references/official-docs.md` -> `TROUBLESHOOTING.md`.

## Resources

- `scripts/pbi_mcp_client.js`: Local JSON-RPC client for the Power BI Modeling MCP server.
- `references/official-docs.md`: Microsoft/GitHub/NPM official doc links and usage notes.
- `references/operations-catalog.json`: Full generated `HELP` payloads for all tools.
- `references/operations-index.md`: Human-readable tool/operation matrix.
