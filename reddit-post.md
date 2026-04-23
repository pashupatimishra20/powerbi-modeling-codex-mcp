# Reddit posting doc

Checked against subreddit rules on April 17, 2026.

Use this as a copy-paste sheet, not a blast template.

Check each subreddit's self-promo and tooling-post rules before posting. Tailor the intro slightly for each one instead of dropping the exact same text everywhere.

## Best targets

### r/SideProject -- post content

Suggested title:

Built a Codex-ready Power BI MCP on top of Microsoft's modeling MCP. Looking for early feedback.

Post:

Hi all,

I have been building a Power BI MCP for Codex because I wanted one workflow that could handle both semantic model work and local PBIR report authoring.

Microsoft's official `powerbi-modeling-mcp` was the base, but I used Codex to build the extra layer I needed around it.

Repo:

https://github.com/pashupatimishra20/powerbi-modeling-codex-mcp

What it does right now:

- connect to Power BI Desktop models
- inspect tables, columns, relationships, measures, and data sources
- create or update model objects through Microsoft's MCP
- work with PBIP/PBIR report projects locally
- create pages, visuals, bookmarks, tooltip pages, drillthrough, synced slicers, field parameters, mobile layouts, action buttons, and grouped layouts
- validate the generated PBIR project

The real workflow I had in mind was:

Start with a `.pbix` or `.pbit` in Power BI Desktop, inspect the model, update measures or DAX, then move into PBIP/PBIR and let Codex build report pages and interactions as files.

I am not posting this like it is finished. I would really like honest feedback from people who build side projects or automation tooling:

- is the problem worth solving?
- is the install/setup clear?
- does the feature surface make sense?
- what would you expect it to do that it still cannot do?

I used Codex heavily while building the whole thing, so this is also a real example of using Codex to extend an MCP-based workflow into a more complete tool.

If anyone wants to try it and be blunt, I would appreciate it.

### r/selfhosted -- post content

Suggested title:

Built a local Power BI MCP workflow for Codex. Looking for feedback from people who like self-hosted tooling.

Post:

Hi all,

I know this is not a classic self-hosted app, so I am posting it from the "local-first tooling" angle and happy to remove it if it is off base.

I built a Power BI MCP workflow for Codex that runs locally and works with local PBIP/PBIR report files.

Repo:

https://github.com/pashupatimishra20/powerbi-modeling-codex-mcp

Why I built it:

Microsoft's official `powerbi-modeling-mcp` covers semantic model operations, but I wanted a Codex-friendly setup that could also handle file-based report authoring locally.

So I used Codex to build:

- a Codex plugin/install flow
- local MCP wiring
- a fallback client
- a local PBIR report-authoring MCP for pages, visuals, bookmarks, drillthrough, tooltip pages, synced slicers, field parameters, mobile layout, controls, and grouped composition

The workflow is:

1. connect to a local Power BI Desktop model
2. inspect the model and update DAX or metadata
3. switch to PBIP/PBIR for file-based report authoring
4. generate report structure and validate the project output

I am mainly looking for feedback on whether this feels useful as a local automation tool and whether the setup/docs are clear enough for someone other than me.

If this is close enough to the kind of tooling people here like, I would appreciate feedback.

### r/MachineLearning -- post content

Suggested title:

Looking for technical feedback on a Codex-built MCP workflow for Power BI modeling and PBIR authoring

Post:

Hi,

I built a Power BI MCP workflow for Codex and wanted feedback from people who care about agent tooling more than product marketing.

Repo:

https://github.com/pashupatimishra20/powerbi-modeling-codex-mcp

The short version is:

Microsoft's `powerbi-modeling-mcp` gives model-level access. I used Codex to build a second layer around it so the same workflow can also author local PBIR report files.

That means the tool can:

- inspect Power BI semantic models
- create or update model objects
- open PBIP/PBIR projects
- generate pages, visuals, bookmarks, tooltip pages, drillthrough, controls, field parameters, mobile layouts, and grouped compositions
- validate the resulting PBIR project

I am not trying to pitch a paid product here. I am trying to get technical feedback on the interface and the workflow design.

The part I am most interested in feedback on:

- does the split between Microsoft's model MCP and the local report-authoring MCP make sense?
- does the PBIR authoring surface feel too broad or still incomplete?
- what would you want from an agent-first BI workflow that this still does not cover?

I used Codex to build the whole thing, so I am also curious whether this feels like a good example of "LLM as implementation partner" versus just a wrapper around existing tools.

### r/artificial -- post content

Suggested title:

I used Codex to build a Power BI MCP workflow on top of Microsoft's MCP. Looking for feedback.

Post:

Hi all,

Sharing this as a text post because I know direct self-promotional link drops are not the right fit here.

I built a Codex-ready Power BI MCP workflow because I wanted one setup that could:

- talk to Microsoft's official `powerbi-modeling-mcp`
- work well inside Codex
- and also handle local PBIR report authoring

Repo:

https://github.com/pashupatimishra20/powerbi-modeling-codex-mcp

I used Codex heavily to build the project itself.

What it does:

- semantic model inspection and updates
- PBIP/PBIR report authoring
- pages and visuals
- bookmarks, drillthrough, tooltip pages, synced slicers, controls
- field parameters
- mobile layout
- grouped composition and layout operations
- PBIR validation

I am posting because I would genuinely like feedback, not because I think it is done.

If you work on AI coding tools, MCP tooling, or BI automation, I would appreciate thoughts on:

- whether this is a useful MCP shape
- whether the Codex angle is actually meaningful
- where the workflow still feels awkward

If this kind of post is still too promotional for the sub, I understand. I tried to keep it focused on the tooling design and the implementation approach.

### r/OpenAI -- post content

Suggested title:

Built a Codex-based Power BI MCP workflow and would like feedback on the setup and tool design

Post:

Hi all,

I used Codex to build a Power BI MCP workflow on top of Microsoft's official `powerbi-modeling-mcp`, and I would like feedback from people here who are experimenting with Codex or MCP-based tooling.

Repo:

https://github.com/pashupatimishra20/powerbi-modeling-codex-mcp

The reason I built it:

Microsoft's MCP covered semantic model operations, but I wanted a Codex-friendly setup that could also author local PBIR report files instead of stopping at the model layer.

So the repo now covers:

- Codex plugin/install flow
- MCP wiring
- model operations through Microsoft's server
- local PBIR report authoring for pages, visuals, bookmarks, drillthrough, tooltip pages, slicer sync, field parameters, controls, mobile layout, and grouped composition

I am not looking to sell anything here. I mostly want feedback on whether this feels like a useful Codex workflow and where the friction still is.

If anyone tries it, I would especially appreciate feedback on:

- install/setup
- promptability from Codex
- missing tool operations
- docs clarity

### r/dataengineering -- post content

Suggested title:

Brand affiliate disclosure: I built a Codex-ready Power BI MCP workflow and would like technical feedback

Post:

Brand affiliate disclosure: I built this project and I am linking my own repo for feedback.

Hi all,

Posting this here because part of the workflow touches model inspection, metadata work, and file-based BI/report automation that may overlap with how some data engineers work with downstream analytics.

Repo:

https://github.com/pashupatimishra20/powerbi-modeling-codex-mcp

I started with Microsoft's official `powerbi-modeling-mcp` and then used Codex to build a broader workflow around it:

- semantic model inspection and updates
- local PBIP/PBIR report authoring
- bookmarks, drillthrough, tooltip pages, slicers, controls, field parameters, mobile layout, and grouped composition

The practical flow is:

connect to a Desktop model, inspect data sources/model structure, update logic where needed, then switch to PBIP/PBIR and automate parts of the report layer as files.

I know self-promo rules are strict here, so I am being explicit about affiliation and I am posting for technical feedback, not lead gen.

If this is still not appropriate for the sub, fair enough. If it is, I would appreciate blunt feedback on whether this is actually useful for real data workflows or whether it is solving a niche problem badly.

## Conditional targets

### r/OpenAI

Use the post below only if your account already has normal participation there.

Why:

- the rules require relevance to OpenAI or AI discussion
- they use a 1/10 self-promo guideline
- direct self-promotional link posts are not allowed
- project posts need context in a text post

### r/artificial

Use the post below only if you already participate there, or ask mods first.

Why:

- the rules say your first post or comment cannot be promo
- they explicitly use a 10% self-promo rule
- they say participation should come first
- they use moderator discretion heavily on promo

## Probably skip or ask mods first

### r/PowerBI

I would not post the current feedback-request version there without mod approval.

Why:

- the rules say contributions must be free of promotional content
- sales activity is prohibited
- customer discovery and paid product validation are explicitly prohibited
- excessive self-promotion is treated as spam

Inference: even a polite "please test this and give feedback" post is risky there because it can look like product validation or solicitation.

### r/BusinessIntelligence

I would skip this one.

Why:

- the rules say no vendor content
- the rules also say no bot or AI content

That is a direct mismatch for this project.

## Final reminder

Check each subreddit's self-promo and tooling-post rules before posting. Tailor the intro slightly for each one instead of dropping the exact same text everywhere.
