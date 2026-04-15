#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DEFAULT_SERVER = {
  command: 'cmd',
  args: ['/c', 'npx', '-y', '@microsoft/powerbi-modeling-mcp@latest', '--start']
};

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = {};
  const positional = [];

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith('--')) {
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

function getServerCommand() {
  const command = process.env.PBI_MCP_COMMAND;
  const rawArgs = process.env.PBI_MCP_ARGS;

  if (!command) {
    return DEFAULT_SERVER;
  }

  let args = [];
  if (rawArgs) {
    try {
      const parsed = JSON.parse(rawArgs);
      if (Array.isArray(parsed)) {
        args = parsed.map(String);
      }
    } catch {
      args = rawArgs.split(' ').filter(Boolean);
    }
  }

  return { command, args };
}

class McpClient {
  constructor(serverCmd) {
    this.serverCmd = serverCmd;
    this.child = null;
    this.buffer = '';
    this.nextId = 1;
    this.pending = new Map();
  }

  start() {
    this.child = spawn(this.serverCmd.command, this.serverCmd.args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.child.stdout.on('data', (chunk) => {
      this.buffer += chunk.toString('utf8');
      this._flushLines();
    });

    this.child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
    });

    this.child.on('exit', (code) => {
      for (const [, pending] of this.pending.entries()) {
        pending.reject(new Error(`MCP server exited early (code=${code})`));
      }
      this.pending.clear();
    });
  }

  _flushLines() {
    while (true) {
      const idx = this.buffer.indexOf('\n');
      if (idx < 0) {
        return;
      }

      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) {
        continue;
      }

      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }

      if (message.id !== undefined && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) {
          pending.reject(new Error(JSON.stringify(message.error)));
        } else {
          pending.resolve(message.result);
        }
      }
    }
  }

  send(message) {
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  request(method, params, timeoutMs = 120000) {
    const id = this.nextId;
    this.nextId += 1;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Timed out waiting for ${method}`));
        }
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        }
      });

      this.send({ jsonrpc: '2.0', id, method, params });
    });
  }

  async initialize() {
    await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'codex-powerbi-modeling-plugin',
        version: '0.1.0'
      }
    });

    this.send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
  }

  async callTool(name, argumentsPayload) {
    return this.request('tools/call', {
      name,
      arguments: argumentsPayload
    });
  }

  async listTools() {
    return this.request('tools/list', {});
  }

  stop() {
    if (this.child && !this.child.killed) {
      this.child.kill();
    }
  }
}

function extractPayload(result) {
  const block = (result && result.content && result.content.find((entry) => entry.type === 'text')) || null;
  if (!block || typeof block.text !== 'string') {
    return result;
  }

  try {
    return JSON.parse(block.text);
  } catch {
    return block.text;
  }
}

function printUsage() {
  console.log(`Usage:
  node pbi_mcp_client.js list-tools
  node pbi_mcp_client.js help <tool>
  node pbi_mcp_client.js call <tool> '<json-arguments>'
  node pbi_mcp_client.js catalog [--out <path>]

Environment overrides:
  PBI_MCP_COMMAND   command executable
  PBI_MCP_ARGS      JSON array or space-delimited args
`);
}

async function run() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.command) {
    printUsage();
    process.exit(1);
  }

  const client = new McpClient(getServerCommand());
  client.start();

  try {
    await client.initialize();

    if (parsed.command === 'list-tools') {
      const tools = await client.listTools();
      console.log(JSON.stringify(tools.tools || [], null, 2));
      return;
    }

    if (parsed.command === 'help') {
      const tool = parsed.positional[0];
      if (!tool) {
        throw new Error('Missing tool name for help command.');
      }

      const result = await client.callTool(tool, { request: { operation: 'HELP' } });
      console.log(JSON.stringify(extractPayload(result), null, 2));
      return;
    }

    if (parsed.command === 'call') {
      const tool = parsed.positional[0];
      const argsRaw = parsed.positional[1];
      if (!tool || !argsRaw) {
        throw new Error('call requires: <tool> <json-arguments>');
      }

      const toolArgs = JSON.parse(argsRaw);
      const result = await client.callTool(tool, toolArgs);
      console.log(JSON.stringify(extractPayload(result), null, 2));
      return;
    }

    if (parsed.command === 'catalog') {
      const outPath = parsed.opts.out
        ? path.resolve(parsed.opts.out)
        : path.resolve(process.cwd(), 'operations-catalog.json');

      const tools = (await client.listTools()).tools || [];
      const catalog = {
        generatedAt: new Date().toISOString(),
        server: getServerCommand(),
        tools: []
      };

      for (const tool of tools) {
        let helpPayload = null;
        try {
          const helpResult = await client.callTool(tool.name, { request: { operation: 'HELP' } });
          helpPayload = extractPayload(helpResult);
        } catch (error) {
          helpPayload = { error: String(error && error.message ? error.message : error) };
        }

        catalog.tools.push({
          name: tool.name,
          description: tool.description || '',
          inputSchema: tool.inputSchema || {},
          help: helpPayload
        });
      }

      fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2), 'utf8');
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
