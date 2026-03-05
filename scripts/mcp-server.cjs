"use strict";

// src/servers/mcp-server.ts
var import_server = require("@modelcontextprotocol/sdk/server/index.js");
var import_stdio = require("@modelcontextprotocol/sdk/server/stdio.js");
var import_types = require("@modelcontextprotocol/sdk/types.js");

// src/shared/SettingsDefaultsManager.ts
var import_fs = require("fs");
var import_path2 = require("path");

// src/shared/paths.ts
var import_path = require("path");
var import_os = require("os");
var DATA_DIR_NAME = ".code-recall";
var PATHS = {
  /** Root data directory: ~/.code-recall/ */
  dataDir: (0, import_path.join)((0, import_os.homedir)(), DATA_DIR_NAME),
  /** SQLite database */
  database: (0, import_path.join)((0, import_os.homedir)(), DATA_DIR_NAME, "code-recall.db"),
  /** Worker PID file */
  pidFile: (0, import_path.join)((0, import_os.homedir)(), DATA_DIR_NAME, "worker.pid"),
  /** Settings file */
  settings: (0, import_path.join)((0, import_os.homedir)(), DATA_DIR_NAME, "settings.json"),
  /** Environment/credentials file */
  envFile: (0, import_path.join)((0, import_os.homedir)(), DATA_DIR_NAME, ".env"),
  /** Auth token for worker API */
  authToken: (0, import_path.join)((0, import_os.homedir)(), DATA_DIR_NAME, "auth.token"),
  /** Observer agent sessions directory (isolated from user's session list) */
  observerSessionsDir: (0, import_path.join)((0, import_os.homedir)(), DATA_DIR_NAME, "observer-sessions"),
  /** Log files */
  logDir: (0, import_path.join)((0, import_os.homedir)(), DATA_DIR_NAME, "logs"),
  workerLog: (0, import_path.join)((0, import_os.homedir)(), DATA_DIR_NAME, "logs", "worker.log")
};
var DEFAULT_WORKER_PORT = 37888;
var WORKER_HOST = "127.0.0.1";

// src/shared/SettingsDefaultsManager.ts
var DEFAULTS = {
  CODE_RECALL_WORKER_PORT: String(DEFAULT_WORKER_PORT),
  CODE_RECALL_PROVIDER: "claude",
  CODE_RECALL_OBSERVER_MODEL: "claude-sonnet-4-5",
  CODE_RECALL_MAX_CONCURRENT_AGENTS: "2",
  CODE_RECALL_CONTEXT_OBSERVATIONS: "50",
  CODE_RECALL_CONTEXT_TOKEN_BUDGET: "8000",
  CODE_RECALL_QUEUE_IDLE_TIMEOUT_MS: "180000",
  // 3 minutes
  CODE_RECALL_CHROMA_ENABLED: "true",
  CODE_RECALL_FTS5_ENABLED: "true",
  CODE_RECALL_PRIVACY_STRIP_TAGS: "true",
  CODE_RECALL_LOG_LEVEL: "info"
};
var SettingsDefaultsManager = class _SettingsDefaultsManager {
  settings;
  constructor() {
    this.settings = { ...DEFAULTS };
  }
  /**
   * Load settings with precedence: env vars > settings.json > defaults
   */
  static loadFromFile(path = PATHS.settings) {
    const manager = new _SettingsDefaultsManager();
    if ((0, import_fs.existsSync)(path)) {
      try {
        const raw = (0, import_fs.readFileSync)(path, "utf-8");
        const fileSettings = JSON.parse(raw);
        Object.assign(manager.settings, fileSettings);
      } catch {
      }
    }
    for (const key of Object.keys(DEFAULTS)) {
      const envVal = process.env[key];
      if (envVal !== void 0) {
        manager.settings[key] = envVal;
      }
    }
    return manager.settings;
  }
  /**
   * Create default settings file if it doesn't exist
   */
  static ensureSettingsFile(path = PATHS.settings) {
    if ((0, import_fs.existsSync)(path)) return;
    const dir = (0, import_path2.dirname)(path);
    if (!(0, import_fs.existsSync)(dir)) {
      (0, import_fs.mkdirSync)(dir, { recursive: true });
    }
    (0, import_fs.writeFileSync)(path, JSON.stringify(DEFAULTS, null, 2) + "\n", "utf-8");
  }
  static get defaults() {
    return { ...DEFAULTS };
  }
};

// src/servers/mcp-server.ts
console.log = (...args) => {
  process.stderr.write(args.map(String).join(" ") + "\n");
};
var settings = SettingsDefaultsManager.loadFromFile();
var WORKER_PORT = parseInt(settings.CODE_RECALL_WORKER_PORT, 10) || DEFAULT_WORKER_PORT;
var WORKER_BASE_URL = `http://${WORKER_HOST}:${WORKER_PORT}`;
var heartbeatTimer = null;
var parentPid = process.ppid;
function startParentHeartbeat() {
  heartbeatTimer = setInterval(() => {
    try {
      process.kill(parentPid, 0);
    } catch {
      console.log("[code-recall] Parent process gone, shutting down MCP server");
      cleanup();
    }
  }, 3e4);
}
async function callWorkerGet(endpoint, params) {
  try {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== void 0 && value !== null) {
        searchParams.append(key, String(value));
      }
    }
    const url = `${WORKER_BASE_URL}${endpoint}?${searchParams}`;
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Worker API error (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error calling Worker API: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}
async function callWorkerPost(endpoint, body) {
  try {
    const url = `${WORKER_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Worker API error (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error calling Worker API: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}
var tools = [
  {
    name: "__IMPORTANT",
    description: `3-LAYER WORKFLOW (ALWAYS FOLLOW):
1. search(query) \u2192 Get index with IDs (~50-100 tokens/result)
2. timeline(project) \u2192 Get context around results
3. get_observations([IDs]) \u2192 Fetch full details ONLY for filtered IDs
NEVER fetch full details without filtering first. 10x token savings.`,
    inputSchema: {
      type: "object",
      properties: {}
    },
    handler: async () => ({
      content: [{
        type: "text",
        text: `# Memory Search Workflow

**3-Layer Pattern (ALWAYS follow this):**

1. **Search** - Get index of results with IDs
   \`search(query="...", limit=20, project="...")\`
   Returns: Table with IDs, titles, dates (~50-100 tokens/result)

2. **Timeline** - Get chronological context
   \`timeline(project="...", limit=50)\`
   Returns: Recent observations showing what was happening

3. **Fetch** - Get full details ONLY for relevant IDs
   \`get_observations(ids=[...])\`
   Returns: Complete details (~500-1000 tokens/result)

**Why:** 10x token savings. Never fetch full details without filtering first.`
      }]
    })
  },
  {
    name: "search",
    description: "Step 1: Search memory. Returns index with IDs. Params: q (query string, required), limit, project",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string", description: "Search query (required)" },
        limit: { type: "number", description: "Max results (default: 20)" },
        project: { type: "string", description: "Filter by project name" }
      },
      required: ["q"]
    },
    handler: async (args) => {
      return await callWorkerGet("/api/search", args);
    }
  },
  {
    name: "timeline",
    description: "Step 2: Get chronological context. Params: project, limit",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string", description: "Filter by project name" },
        limit: { type: "number", description: "Max results (default: 50)" }
      }
    },
    handler: async (args) => {
      return await callWorkerGet("/api/timeline", args);
    }
  },
  {
    name: "get_observations",
    description: "Step 3: Fetch full details for filtered IDs. Always batch for 2+ items.",
    inputSchema: {
      type: "object",
      properties: {
        ids: {
          type: "array",
          items: { type: "number" },
          description: "Array of observation IDs to fetch (required)"
        }
      },
      required: ["ids"]
    },
    handler: async (args) => {
      return await callWorkerPost("/api/observations/batch", args);
    }
  }
];
var server = new import_server.Server(
  { name: "code-recall", version: "1.0.0" },
  { capabilities: { tools: {} } }
);
server.setRequestHandler(import_types.ListToolsRequestSchema, async () => ({
  tools: tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema
  }))
}));
server.setRequestHandler(import_types.CallToolRequestSchema, async (request) => {
  const tool = tools.find((t) => t.name === request.params.name);
  if (!tool) {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }
  try {
    return await tool.handler(request.params.arguments ?? {});
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
});
function cleanup() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  console.log("[code-recall] MCP server shutting down");
  process.exit(0);
}
process.on("SIGTERM", cleanup);
process.on("SIGINT", cleanup);
async function main() {
  const transport = new import_stdio.StdioServerTransport();
  await server.connect(transport);
  console.log("[code-recall] MCP search server started");
  startParentHeartbeat();
  setTimeout(async () => {
    try {
      const response = await fetch(`${WORKER_BASE_URL}/api/health`);
      if (response.ok) {
        console.log("[code-recall] Worker available");
      } else {
        console.log("[code-recall] Worker not ready yet");
      }
    } catch {
      console.log("[code-recall] Worker not available \u2014 tools will fail until worker starts");
    }
  }, 0);
}
main().catch((error) => {
  console.log("[code-recall] Fatal error:", error);
  process.exit(0);
});
