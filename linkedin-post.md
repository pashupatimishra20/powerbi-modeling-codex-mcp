I built this because Microsoft's official `powerbi-modeling-mcp` gave me a strong starting point for semantic-model automation, but my actual Codex workflow still had a gap: I wanted one setup that could handle both model work and local PBIR report authoring.

So I used Codex to build a Codex-focused layer on top of Microsoft's MCP:

- Codex plugin + MCP wiring
- bootstrap install / local install scripts
- Codex skills + fallback client
- a local PBIR report-authoring MCP for pages, visuals, bookmarks, drillthrough, tooltip pages, field parameters, mobile layouts, interactive controls, and grouped composition

The flow I wanted was simple:

Start with a Power BI Desktop `.pbit` or `.pbix`, inspect the model and data sources, create or update measures, validate DAX, then switch to PBIP/PBIR and let Codex generate report pages, visuals, bookmarks, tooltip pages, drillthrough targets, synced slicers, field parameters, mobile layouts, page navigation, web URL / Q&A buttons, grouped layouts, and visibility states, then validate the project.

It works, but I still think the most useful part now is feedback.

If you work with Power BI, MCPs, or Codex, I would genuinely appreciate people trying it and telling me what feels useful, what feels awkward, and what is still missing.

Repo: https://github.com/pashupatimishra20/powerbi-modeling-codex-mcp

#PowerBI #MicrosoftFabric #MCP #ModelContextProtocol #Codex #OpenAI #AIEngineering #BusinessIntelligence #AnalyticsEngineering #DataAnalytics #PowerBIDesktop #PBIR #PBIP #SemanticModel #DAX #DataEngineering #DeveloperTools #AIAgents
