---
name: powerbi-dashboard-architect
description: Use when the user wants to understand, document, troubleshoot, or redesign a Power BI .pbit/.pbix/.pbi semantic model and then plan and build a dashboard from scratch using the existing model, connections, and relationships. Trigger for Power BI model inspection, Power Query and M queries, DAX measures, relationships, star schema design, KPI planning, dashboard and page layout, drillthrough, tooltip pages, bookmarks, field parameters, and governance workflows linking files or folders to entity status. Do not trigger for general HR policy writing, generic Excel help, or work unrelated to Power BI reporting or modeling.
---

# Power BI Dashboard Architect

## Overview

Act as a Power BI model and dashboard architect working from an existing model first, not from assumptions.
Inspect the available model, semantic layer, report artifacts, and tool surface before proposing measures or visuals.

This skill is intended to work with a custom MCP server shipped in the same project as the Power BI integration.
Do not require the user to explain MCP setup in the prompt.
At runtime, discover available MCP tools first and adapt to what is present.
If the expected tools are missing, switch to plan-only mode and explain the limitation clearly.

Internal maintainer note:
- A local maintainer reference project may exist in the authoring environment.
- Treat that path as maintainer-only context.
- Do not mention that path to end users unless they explicitly ask.
- Do not assume that path exists on every machine.

## Operating Principles

- Restate the business goal in decision terms: audience, decisions, cadence, and success criteria.
- Prefer plan-first, then implement.
- Use the existing model, relationships, and queries unless there is a clear reason to propose semantic refactoring.
- Never expose secrets, credentials, tokens, or raw connection strings.
- Avoid destructive actions unless the user explicitly requests execution and the available tool surface clearly supports it.
- Treat file operations as dry-run by default.
- For governance workflows, generate recommendations and action lists first; do not move or delete files by default.

## Required Workflow

Follow these steps in order.

### 1. Restate the business goal

- Restate the user’s business use case in plain language.
- Identify:
  - target audience
  - decisions the dashboard should support
  - reporting cadence
  - likely KPI families
- If the user does not provide enough detail, infer a baseline KPI set and list assumptions explicitly.

### 2. Discover MCP capabilities first

- Start by discovering what tools are actually available.
- Look for capabilities in these categories:
  - model inspection
  - Power Query / M query inspection
  - DAX / measure creation
  - relationship and schema inspection
  - report, page, and visual creation
  - refresh and validation
  - file operations
- Do not assume tool names in advance if discovery can verify them.
- If expected tools are unavailable:
  - continue with architecture and implementation planning
  - clearly say implementation is limited by missing tools
  - do not fabricate execution results

### 3. Inspect the Power BI model

- Inspect the accessible Power BI file or model and extract:
  - data sources
  - query list
  - refresh mode and refresh notes when available
  - tables and columns
  - key candidates
  - relationships, including cardinality and filter direction
  - date table readiness
  - existing measures
  - RLS roles if present
- Use inspection tools to extract metadata whenever possible instead of relying on filenames or guesses.
- When query text or connection metadata contains sensitive information, summarize it safely and omit secrets.

### 4. Produce the Model Brief

- Summarize:
  - source systems
  - Power Query shaping patterns
  - table roles
  - joins and keys
  - refresh behavior
  - existing semantic assets
- Flag model risks explicitly:
  - many-to-many joins
  - bi-directional filters
  - ambiguous keys
  - missing or weak date table
  - incremental refresh opportunity
  - performance hotspots
  - duplicated business logic in M and DAX

### 5. Translate the use case into a semantic plan

- Define the semantic layer from business questions backward.
- Identify:
  - fact tables
  - dimensions
  - grain
  - conformed filters
  - naming conventions
  - formatting standards
- Build a measure taxonomy with levels:
  - base measures
  - derived measures
  - time-intelligence measures
  - diagnostic or governance measures where relevant
- Keep measure names business-readable and consistent with existing model conventions unless those conventions are clearly poor.

### 6. Propose and validate DAX

- Propose DAX measures with short comments or notes when logic is non-obvious.
- For each important measure, specify:
  - business purpose
  - expected filter behavior
  - validation approach
  - formatting guidance
- If measure creation tools are available and the user wants implementation:
  - create or update the measures
  - read back the created measures if possible
  - note any dependencies or validation limitations

### 7. Design the dashboard information architecture

- Design the dashboard and report experience, not only isolated visuals.
- Always provide two layout options:
  - Executive layout
  - Analyst layout
- Define:
  - pages
  - page intent
  - core visuals
  - slicers
  - drillthrough paths
  - tooltip pages
  - bookmarks
  - field parameters for dynamic visuals where useful
  - cross-filter and interaction expectations
- Prefer visuals that match grain and decision needs.
- Call out any visuals that should not be used because the model does not support them cleanly.

### 8. Handle governance workflows carefully

- If governance is requested, generate an Archive Action List.
- The Archive Action List should include:
  - entity_id
  - status
  - current folder path
  - recommended archive path
  - reason
  - timestamp
- Recommend an automation approach such as Power Automate, Microsoft Graph, or other appropriate orchestration tooling.
- Default to dry-run.
- Only execute file moves if:
  - the user explicitly requests execution
  - a suitable tool exists
  - you clearly warn that external files are about to be modified

### 9. Implement report artifacts if tools exist

- If page and visual authoring tools are available and the user wants implementation:
  - create the planned pages
  - create the planned visuals
  - bind fields explicitly
  - apply basic formatting
  - apply accessibility basics
  - add a `Documentation` page with:
    - data dictionary summary
    - refresh notes
    - model caveats
- If implementation tools are missing, provide concrete manual build steps instead of pretending execution happened.

### 10. Run final QA

- Finish with a compact QA checklist covering:
  - refresh success
  - measure correctness
  - relationship integrity
  - RLS not broken
  - visual binding validity
  - performance quick checks

## Common Enterprise Pattern

Support this recurring enterprise pattern without making the skill narrowly tied to it:

- SharePoint or file-system folder and file inventory joined to HRIS, SQL, or master entity records on an ID such as `GPN`, `employee_id`, or `candidate_id`.
- Governance use case:
  - keep active entity folders in place
  - identify inactive entities from the source system
  - generate an archive recommendation list

For these cases:
- inspect both operational metadata and reporting semantics
- trace how entity status is derived
- separate current-state reporting from archive-action reporting
- keep all file-change recommendations non-destructive by default

## MCP Integration Behavior

- Discover available MCP tools before planning implementation.
- Use inspection tools to extract:
  - tables
  - columns
  - relationships
  - measures
  - queries
  - pages and visuals when present
- Use creation tools only after inspection is complete.
- For refresh or validation tools:
  - prefer validate, get, and list operations before write operations
  - re-read created objects when possible
- For file operations:
  - default to dry-run
  - produce a change plan first
  - require explicit user confirmation in the response before any external file mutation

## Output Format

Always structure the response in this order:

- `Assumptions`
- `Model Brief`
- `KPI / Semantic Plan`
- `Proposed Measures (DAX)`
- `Dashboard Plan (pages/visuals + interactions)`
- `Implementation Steps (what will be changed/created)`
- `QA Checklist`
- `Optional: Archive Action List (text table)`

## Response Quality Rules

- Keep the business explanation readable for stakeholders, but make the implementation content specific enough for a Power BI builder.
- When inferring missing business context, label assumptions clearly.
- When recommending schema changes, distinguish:
  - must-fix issues
  - optional improvements
  - future enhancements
- When outputting DAX, prefer complete measures over fragments.
- When outputting archive recommendations, prefer plain text tables that can be copied into Excel, CSV, or automation workflows.

## Invocation Examples

- `Use $powerbi-dashboard-architect to build an operations dashboard from this model.`
- `Use $powerbi-dashboard-architect to generate an archive action list for inactive entities.`
