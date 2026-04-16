#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = {};
  const positional = [];

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith("--")) {
        opts[key] = next;
        i += 1;
      } else {
        opts[key] = true;
      }
    } else {
      positional.push(token);
    }
  }

  return { command, positional, opts };
}

function printUsage() {
  console.log(`Usage:
  node pbi_mcp_client.cjs list-tools
  node pbi_mcp_client.cjs help <tool>
  node pbi_mcp_client.cjs call <tool> '<json-arguments>'
  node pbi_mcp_client.cjs catalog [--out <path>]

Environment overrides:
  PBI_MCP_COMMAND   command executable
  PBI_MCP_ARGS      JSON array or space-delimited args
`);
}

async function loadRuntime() {
  const runtimePath = path.resolve(
    __dirname,
    "../../../src/report-authoring/modeling-mcp-client.js"
  );
  return import(pathToFileURL(runtimePath).href);
}

async function run() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.command) {
    printUsage();
    process.exit(1);
  }

  const runtime = await loadRuntime();
  const client = new runtime.ModelingMcpClient(runtime.getServerCommand());
  client.start();

  try {
    await client.initialize();

    if (parsed.command === "list-tools") {
      const tools = await client.listTools();
      console.log(JSON.stringify(tools.tools || [], null, 2));
      return;
    }

    if (parsed.command === "help") {
      const tool = parsed.positional[0];
      if (!tool) {
        throw new Error("Missing tool name for help command.");
      }

      const result = await client.callTool(tool, { request: { operation: "HELP" } });
      console.log(JSON.stringify(runtime.extractPayload(result), null, 2));
      return;
    }

    if (parsed.command === "call") {
      const tool = parsed.positional[0];
      const argsRaw = parsed.positional[1];
      if (!tool || !argsRaw) {
        throw new Error("call requires: <tool> <json-arguments>");
      }

      const toolArgs = JSON.parse(argsRaw);
      const result = await client.callTool(tool, toolArgs);
      console.log(JSON.stringify(runtime.extractPayload(result), null, 2));
      return;
    }

    if (parsed.command === "catalog") {
      const outPath = parsed.opts.out
        ? path.resolve(parsed.opts.out)
        : path.resolve(process.cwd(), "operations-catalog.json");

      const tools = (await client.listTools()).tools || [];
      const catalog = {
        generatedAt: new Date().toISOString(),
        server: runtime.getServerCommand(),
        tools: []
      };

      for (const tool of tools) {
        let helpPayload = null;
        try {
          const helpResult = await client.callTool(tool.name, { request: { operation: "HELP" } });
          helpPayload = runtime.extractPayload(helpResult);
        } catch (error) {
          helpPayload = { error: String(error && error.message ? error.message : error) };
        }

        catalog.tools.push({
          name: tool.name,
          description: tool.description || "",
          inputSchema: tool.inputSchema || {},
          help: helpPayload
        });
      }

      fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2), "utf8");
      console.log(`Wrote catalog: ${outPath}`);
      return;
    }

    throw new Error(`Unknown command: ${parsed.command}`);
  } finally {
    client.stop();
  }
}

run().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exit(1);
});
