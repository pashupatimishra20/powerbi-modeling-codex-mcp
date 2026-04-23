#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const options = {
    mode: "Full",
    out: ".mcp.json"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--mode") {
      options.mode = argv[index + 1] || options.mode;
      index += 1;
      continue;
    }
    if (token === "--out") {
      options.out = argv[index + 1] || options.out;
      index += 1;
    }
  }

  return options;
}

function buildConfig(mode) {
  const normalizedMode = String(mode || "Full").toLowerCase();
  const reportAuthoringServer = {
    type: "stdio",
    command: "node",
    args: ["./server/powerbi-report-authoring-server.js"],
    startupTimeoutMs: 120000
  };

  if (normalizedMode === "pbironly") {
    return {
      mcpServers: {
        "powerbi-report-authoring-mcp": reportAuthoringServer
      }
    };
  }

  return {
    mcpServers: {
      "powerbi-modeling-mcp": {
        type: "stdio",
        command: "npx",
        args: ["-y", "@microsoft/powerbi-modeling-mcp@latest", "--start"],
        startupTimeoutMs: 120000
      },
      "powerbi-report-authoring-mcp": reportAuthoringServer
    }
  };
}

const options = parseArgs(process.argv.slice(2));
const outputPath = path.resolve(options.out);
const config = buildConfig(options.mode);

fs.writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
