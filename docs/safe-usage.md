# Safe Usage Guide

Use this repo in `Full` mode when you need both:

- the official semantic-model MCP for tables, measures, relationships, and DAX workflows
- the local PBIR report-authoring MCP for pages, visuals, bookmarks, and layouts

Use `PBIROnly` mode when you want a lower-noise report-authoring session focused on PBIR/PBIP files.

Recommended habits:

- Work on anonymized or non-production report copies when possible.
- Prefer PBIR/PBIP projects over PBIX when sharing context with an LLM.
- Review the `changes` payload returned by mutating report operations before issuing the next instruction.
- Reopen Power BI Desktop after external PBIR edits if the canvas does not refresh automatically.

What gets shared depends on your active MCP servers and the LLM client you use:

- The local `powerbi-report-authoring-mcp` operates on local report project files.
- The official `powerbi-modeling-mcp` can expose semantic-model metadata and query outputs to the connected LLM.

For the safest report-only workflow, install with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-local.ps1 -Mode PBIROnly
```
