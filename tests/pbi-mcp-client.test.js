import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(".");
const skillScriptSource = path.join(
  repoRoot,
  "skills",
  "powerbi-modeling-mcp",
  "scripts",
  "pbi_mcp_client.cjs"
);
const runtimeSource = path.join(
  repoRoot,
  "src",
  "report-authoring",
  "modeling-mcp-client.js"
);

function buildMockServerProgram() {
  return [
    "const readline = require('node:readline');",
    "const rl = readline.createInterface({ input: process.stdin });",
    "rl.on('line', (line) => {",
    "  if (!line.trim()) return;",
    "  const message = JSON.parse(line);",
    "  if (message.method === 'initialize') {",
    "    process.stdout.write(JSON.stringify({",
    "      jsonrpc: '2.0',",
    "      id: message.id,",
    "      result: {",
    "        protocolVersion: '2024-11-05',",
    "        capabilities: {},",
    "        serverInfo: { name: 'mock-powerbi-modeling-mcp', version: '1.0.0' }",
    "      }",
    "    }) + '\\n');",
    "    return;",
    "  }",
    "  if (message.method === 'tools/list') {",
    "    process.stdout.write(JSON.stringify({",
    "      jsonrpc: '2.0',",
    "      id: message.id,",
    "      result: { tools: [{ name: 'connection_operations', description: 'mock tool' }] }",
    "    }) + '\\n');",
    "  }",
    "});"
  ].join("\n");
}

test("standalone mirrored skill resolves runtime from installed plugin path", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "powerbi-mcp-home-"));
  const mirroredSkillRoot = path.join(
    tempHome,
    ".codex",
    "skills",
    "powerbi-modeling-mcp"
  );
  const mirroredPluginRoot = path.join(
    tempHome,
    "plugins",
    "powerbi-modeling-codex",
    "src",
    "report-authoring"
  );

  fs.mkdirSync(path.join(mirroredSkillRoot, "scripts"), { recursive: true });
  fs.mkdirSync(mirroredPluginRoot, { recursive: true });
  fs.copyFileSync(
    skillScriptSource,
    path.join(mirroredSkillRoot, "scripts", "pbi_mcp_client.cjs")
  );
  fs.copyFileSync(
    runtimeSource,
    path.join(mirroredPluginRoot, "modeling-mcp-client.js")
  );

  const result = spawnSync(
    process.execPath,
    [path.join(mirroredSkillRoot, "scripts", "pbi_mcp_client.cjs"), "list-tools"],
    {
      env: {
        ...process.env,
        HOME: tempHome,
        USERPROFILE: tempHome,
        PBI_MCP_COMMAND: process.execPath,
        PBI_MCP_ARGS: JSON.stringify(["-e", buildMockServerProgram()])
      },
      encoding: "utf8"
    }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /connection_operations/);
});
