#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

import {
  REPORT_PROJECT_SERVER_NAME,
  REPORT_PROJECT_SERVER_VERSION,
  TOOL_DEFINITIONS,
  TOOL_SCHEMAS
} from "../src/report-authoring/constants.js";
import {
  handlePageOperation,
  handleProjectOperation,
  handleVisualOperation
} from "../src/report-authoring/tool-handlers.js";

function createToolList() {
  return Object.entries(TOOL_DEFINITIONS).map(([name, definition]) => ({
    name,
    description: definition.description,
    inputSchema: TOOL_SCHEMAS[name]
  }));
}

async function dispatchTool(name, args) {
  const request = args?.request || {};
  switch (name) {
    case "report_project_operations":
      return handleProjectOperation(request);
    case "report_page_operations":
      return handlePageOperation(request);
    case "report_visual_operations":
      return handleVisualOperation(request);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

const server = new Server(
  {
    name: REPORT_PROJECT_SERVER_NAME,
    version: REPORT_PROJECT_SERVER_VERSION
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: createToolList()
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const result = await dispatchTool(request.params.name, request.params.arguments || {});
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: false,
              error: error instanceof Error ? error.message : String(error)
            },
            null,
            2
          )
        }
      ]
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
