import { spawn } from "node:child_process";

const DEFAULT_SERVER = {
  command: "cmd",
  args: ["/c", "npx", "-y", "@microsoft/powerbi-modeling-mcp@latest", "--start"]
};

function parseArgs(rawArgs) {
  if (!rawArgs) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawArgs);
    if (Array.isArray(parsed)) {
      return parsed.map(String);
    }
  } catch {
    // Fall back to a simple split to keep compatibility with the existing CLI wrapper.
  }

  return String(rawArgs)
    .split(" ")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getServerCommand() {
  const command = process.env.PBI_MCP_COMMAND;
  if (!command) {
    return DEFAULT_SERVER;
  }

  return {
    command,
    args: parseArgs(process.env.PBI_MCP_ARGS)
  };
}

export class ModelingMcpClient {
  constructor(serverCmd = getServerCommand()) {
    this.serverCmd = serverCmd;
    this.child = null;
    this.buffer = "";
    this.nextId = 1;
    this.pending = new Map();
  }

  start() {
    if (this.child) {
      return;
    }

    this.child = spawn(this.serverCmd.command, this.serverCmd.args, {
      stdio: ["pipe", "pipe", "pipe"]
    });

    this.child.stdout.on("data", (chunk) => {
      this.buffer += chunk.toString("utf8");
      this.flushLines();
    });

    this.child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
    });

    this.child.on("exit", (code) => {
      for (const [, pending] of this.pending.entries()) {
        pending.reject(new Error(`MCP server exited early (code=${code})`));
      }
      this.pending.clear();
    });
  }

  flushLines() {
    while (true) {
      const index = this.buffer.indexOf("\n");
      if (index < 0) {
        return;
      }

      const line = this.buffer.slice(0, index).trim();
      this.buffer = this.buffer.slice(index + 1);
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
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        }
      });

      this.send({ jsonrpc: "2.0", id, method, params });
    });
  }

  async initialize() {
    await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "codex-powerbi-modeling-plugin",
        version: "0.6.0"
      }
    });

    this.send({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });
  }

  async callTool(name, argumentsPayload) {
    return this.request("tools/call", {
      name,
      arguments: argumentsPayload
    });
  }

  async listTools() {
    return this.request("tools/list", {});
  }

  stop() {
    if (this.child && !this.child.killed) {
      this.child.kill();
    }
    this.child = null;
  }
}

export function extractPayload(result) {
  const block =
    result?.content?.find((entry) => entry.type === "text") || null;

  if (!block || typeof block.text !== "string") {
    return result;
  }

  try {
    return JSON.parse(block.text);
  } catch {
    return block.text;
  }
}

let modelingClientFactory = async () => {
  const client = new ModelingMcpClient();
  client.start();
  await client.initialize();
  return client;
};

export function setModelingClientFactory(factory) {
  modelingClientFactory = factory;
}

export function resetModelingClientFactory() {
  modelingClientFactory = async () => {
    const client = new ModelingMcpClient();
    client.start();
    await client.initialize();
    return client;
  };
}

export async function withModelingClient(callback) {
  const client = await modelingClientFactory();
  let shouldStop = typeof client.stop === "function";

  try {
    return await callback(client);
  } finally {
    if (shouldStop) {
      client.stop();
    }
  }
}

export async function callModelingTool(client, toolName, request) {
  const result = await client.callTool(toolName, { request });
  const payload = extractPayload(result);
  if (payload?.success === false) {
    throw new Error(payload.error || `Modeling MCP ${toolName} call failed.`);
  }
  return payload;
}
