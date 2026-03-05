"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/shared/paths.ts
var import_path, import_os, DATA_DIR_NAME, PATHS, DEFAULT_WORKER_PORT, WORKER_HOST;
var init_paths = __esm({
  "src/shared/paths.ts"() {
    "use strict";
    import_path = require("path");
    import_os = require("os");
    DATA_DIR_NAME = ".code-recall";
    PATHS = {
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
    DEFAULT_WORKER_PORT = 37888;
    WORKER_HOST = "127.0.0.1";
  }
});

// src/shared/SettingsDefaultsManager.ts
var import_fs5, import_path4, DEFAULTS, SettingsDefaultsManager;
var init_SettingsDefaultsManager = __esm({
  "src/shared/SettingsDefaultsManager.ts"() {
    "use strict";
    import_fs5 = require("fs");
    import_path4 = require("path");
    init_paths();
    DEFAULTS = {
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
    SettingsDefaultsManager = class _SettingsDefaultsManager {
      settings;
      constructor() {
        this.settings = { ...DEFAULTS };
      }
      /**
       * Load settings with precedence: env vars > settings.json > defaults
       */
      static loadFromFile(path = PATHS.settings) {
        const manager = new _SettingsDefaultsManager();
        if ((0, import_fs5.existsSync)(path)) {
          try {
            const raw = (0, import_fs5.readFileSync)(path, "utf-8");
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
        if ((0, import_fs5.existsSync)(path)) return;
        const dir = (0, import_path4.dirname)(path);
        if (!(0, import_fs5.existsSync)(dir)) {
          (0, import_fs5.mkdirSync)(dir, { recursive: true });
        }
        (0, import_fs5.writeFileSync)(path, JSON.stringify(DEFAULTS, null, 2) + "\n", "utf-8");
      }
      static get defaults() {
        return { ...DEFAULTS };
      }
    };
  }
});

// src/shared/hook-constants.ts
var STANDARD_HOOK_RESPONSE, STDIN_PARSE_DELAY_MS, STDIN_TIMEOUT_MS;
var init_hook_constants = __esm({
  "src/shared/hook-constants.ts"() {
    "use strict";
    STANDARD_HOOK_RESPONSE = JSON.stringify({
      continue: true,
      suppressOutput: true
    });
    STDIN_PARSE_DELAY_MS = 50;
    STDIN_TIMEOUT_MS = 3e4;
  }
});

// src/cli/stdin-reader.ts
async function readStdin() {
  return new Promise((resolve) => {
    let buffer = "";
    let parseTimer = null;
    let timeoutTimer = null;
    const cleanup = () => {
      if (parseTimer) clearTimeout(parseTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      process.stdin.removeAllListeners("data");
      process.stdin.removeAllListeners("end");
      process.stdin.removeAllListeners("error");
      try {
        process.stdin.pause();
      } catch {
      }
    };
    const tryParse = () => {
      try {
        const parsed = JSON.parse(buffer);
        cleanup();
        resolve(parsed);
      } catch {
      }
    };
    timeoutTimer = setTimeout(() => {
      cleanup();
      if (buffer.trim()) {
        try {
          resolve(JSON.parse(buffer));
          return;
        } catch {
        }
      }
      resolve(void 0);
    }, STDIN_TIMEOUT_MS);
    process.stdin.setEncoding("utf-8");
    process.stdin.resume();
    process.stdin.on("data", (chunk) => {
      buffer += chunk;
      if (parseTimer) clearTimeout(parseTimer);
      parseTimer = setTimeout(tryParse, STDIN_PARSE_DELAY_MS);
    });
    process.stdin.on("end", () => {
      cleanup();
      if (buffer.trim()) {
        try {
          resolve(JSON.parse(buffer));
          return;
        } catch {
        }
      }
      resolve(void 0);
    });
    process.stdin.on("error", () => {
      cleanup();
      resolve(void 0);
    });
    setTimeout(() => {
      if (!buffer.trim()) {
        cleanup();
        resolve(void 0);
      }
    }, 500);
  });
}
var init_stdin_reader = __esm({
  "src/cli/stdin-reader.ts"() {
    "use strict";
    init_hook_constants();
  }
});

// src/cli/adapters/claude-code.ts
function adaptClaudeCodeEvent(raw) {
  if (!raw || typeof raw !== "object") return null;
  const data = raw;
  return {
    hook_event: data.hook_event,
    tool_name: data.tool_name,
    tool_input: data.tool_input,
    tool_output: typeof data.tool_output === "string" ? data.tool_output : void 0,
    session_id: data.session_id,
    project_dir: data.project_dir,
    stop_reason: data.stop_reason,
    prompt: data.prompt,
    ...data
  };
}
function extractContentSessionId(event) {
  return event.session_id ?? null;
}
function extractProject(event) {
  if (event.project_dir) {
    const parts = event.project_dir.split("/");
    return parts[parts.length - 1] || null;
  }
  return null;
}
var init_claude_code = __esm({
  "src/cli/adapters/claude-code.ts"() {
    "use strict";
  }
});

// src/utils/project-name.ts
function getProjectName(cwd) {
  const dir = cwd ?? process.cwd();
  try {
    const remote = (0, import_child_process.execSync)("git remote get-url origin", { cwd: dir, encoding: "utf-8", timeout: 5e3 }).trim();
    if (remote) {
      const match = remote.match(/\/([^/]+?)(?:\.git)?$/);
      if (match) return match[1];
    }
  } catch {
  }
  try {
    const gitRoot = (0, import_child_process.execSync)("git rev-parse --show-toplevel", { cwd: dir, encoding: "utf-8", timeout: 5e3 }).trim();
    if (gitRoot) return (0, import_path5.basename)(gitRoot);
  } catch {
  }
  return (0, import_path5.basename)(dir);
}
var import_child_process, import_path5;
var init_project_name = __esm({
  "src/utils/project-name.ts"() {
    "use strict";
    import_child_process = require("child_process");
    import_path5 = require("path");
  }
});

// src/cli/handlers/context.ts
async function handleContext(event) {
  const settings = SettingsDefaultsManager.loadFromFile();
  const port = parseInt(settings.CODE_RECALL_WORKER_PORT, 10) || DEFAULT_WORKER_PORT;
  const project = extractProject(event) ?? getProjectName(event.project_dir);
  const limit = parseInt(settings.CODE_RECALL_CONTEXT_OBSERVATIONS, 10) || 50;
  try {
    const healthRes = await fetch(`http://${WORKER_HOST}:${port}/api/health`);
    if (!healthRes.ok) {
      return { continue: true, suppressOutput: true };
    }
    const health = await healthRes.json();
    if (health.observations === 0) {
      return {
        continue: true,
        suppressOutput: true,
        message: `<code-recall-context>
[code-recall] Memory system active. No prior observations for project "${project}" yet.
</code-recall-context>`
      };
    }
    const obsRes = await fetch(
      `http://${WORKER_HOST}:${port}/api/observations/recent?project=${encodeURIComponent(project)}&limit=${limit}`
    );
    if (!obsRes.ok) {
      return { continue: true, suppressOutput: true };
    }
    const { observations } = await obsRes.json();
    if (!observations || observations.length === 0) {
      return {
        continue: true,
        suppressOutput: true,
        message: `<code-recall-context>
[code-recall] Memory active. No observations for "${project}" yet.
</code-recall-context>`
      };
    }
    const contextLines = [
      `<code-recall-context>`,
      `# Code Recall \u2014 Session Context`,
      `**Project:** ${project}`,
      `**Observations:** ${observations.length} most recent`,
      ``
    ];
    try {
      const summRes = await fetch(
        `http://${WORKER_HOST}:${port}/api/timeline?project=${encodeURIComponent(project)}&limit=5`
      );
      if (summRes.ok) {
        const { timeline } = await summRes.json();
        if (timeline && timeline.length > 0) {
          contextLines.push(`## Recent Activity`);
          for (const obs of timeline.slice(0, 10)) {
            const type = obs.type ?? "change";
            const title = obs.title ?? "Untitled";
            const created = obs.created_at ?? "";
            contextLines.push(`- [${type}] ${title} (${created.split("T")[0]})`);
          }
          contextLines.push("");
        }
      }
    } catch {
    }
    contextLines.push(`## Key Observations`);
    for (const obs of observations.slice(0, 20)) {
      const type = obs.type ?? "change";
      const title = obs.title ?? "Observation";
      const narrative = obs.narrative;
      const facts = obs.facts;
      contextLines.push(`### [${type}] ${title}`);
      if (narrative) contextLines.push(narrative);
      if (facts) {
        try {
          const factsList = JSON.parse(facts);
          for (const fact of factsList.slice(0, 5)) {
            contextLines.push(`- ${fact}`);
          }
        } catch {
          contextLines.push(facts);
        }
      }
      contextLines.push("");
    }
    contextLines.push(`</code-recall-context>`);
    const tokenBudget = parseInt(settings.CODE_RECALL_CONTEXT_TOKEN_BUDGET, 10) || 8e3;
    let contextText = contextLines.join("\n");
    const estimatedTokens = Math.ceil(contextText.length / 4);
    if (estimatedTokens > tokenBudget) {
      const maxChars = tokenBudget * 4;
      contextText = contextText.slice(0, maxChars);
      const lastNewline = contextText.lastIndexOf("\n###");
      if (lastNewline > 0) {
        contextText = contextText.slice(0, lastNewline);
      }
      contextText += "\n\n[...truncated for token budget]\n</code-recall-context>";
    }
    return {
      continue: true,
      suppressOutput: true,
      message: contextText
    };
  } catch {
    return { continue: true, suppressOutput: true };
  }
}
var init_context = __esm({
  "src/cli/handlers/context.ts"() {
    "use strict";
    init_paths();
    init_SettingsDefaultsManager();
    init_claude_code();
    init_project_name();
  }
});

// src/cli/handlers/session-init.ts
async function handleSessionInit(event) {
  const contentSessionId = extractContentSessionId(event);
  if (!contentSessionId) {
    return { continue: true, suppressOutput: true };
  }
  const project = extractProject(event) ?? getProjectName(event.project_dir);
  const userPrompt = event.prompt;
  const settings = SettingsDefaultsManager.loadFromFile();
  const port = parseInt(settings.CODE_RECALL_WORKER_PORT, 10) || DEFAULT_WORKER_PORT;
  try {
    const res = await fetch(`http://${WORKER_HOST}:${port}/api/sessions/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentSessionId, project, userPrompt })
    });
    if (!res.ok) {
      console.error(`[code-recall] session-init failed: ${res.status}`);
    }
  } catch {
  }
  return { continue: true, suppressOutput: true };
}
var init_session_init = __esm({
  "src/cli/handlers/session-init.ts"() {
    "use strict";
    init_paths();
    init_SettingsDefaultsManager();
    init_claude_code();
    init_project_name();
  }
});

// src/utils/tag-stripping.ts
function stripPrivateTags(text) {
  if (!text) return text;
  let result = text;
  let prevResult = "";
  while (result !== prevResult) {
    prevResult = result;
    result = result.replace(/<private>([^<]*(?:(?!<private>)<[^<]*)*)<\/private>/gi, "");
  }
  return result.trim();
}
var init_tag_stripping = __esm({
  "src/utils/tag-stripping.ts"() {
    "use strict";
  }
});

// src/cli/handlers/observation.ts
async function handleObservation(event) {
  const contentSessionId = extractContentSessionId(event);
  if (!contentSessionId) {
    return { continue: true, suppressOutput: true };
  }
  const settings = SettingsDefaultsManager.loadFromFile();
  const port = parseInt(settings.CODE_RECALL_WORKER_PORT, 10) || DEFAULT_WORKER_PORT;
  let toolOutput = event.tool_output ?? "";
  if (settings.CODE_RECALL_PRIVACY_STRIP_TAGS === "true") {
    toolOutput = stripPrivateTags(toolOutput);
  }
  if (toolOutput.length > MAX_TOOL_OUTPUT_CHARS) {
    toolOutput = toolOutput.slice(0, MAX_TOOL_OUTPUT_CHARS) + "\n[...truncated]";
  }
  const payload = {
    tool_name: event.tool_name,
    tool_input: event.tool_input,
    tool_output: toolOutput,
    project_dir: event.project_dir
  };
  try {
    const res = await fetch(`http://${WORKER_HOST}:${port}/api/messages/enqueue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentSessionId,
        messageType: "observation",
        payload
      })
    });
    if (!res.ok) {
      console.error(`[code-recall] observation enqueue failed: ${res.status}`);
    }
  } catch {
  }
  return { continue: true, suppressOutput: true };
}
var MAX_TOOL_OUTPUT_CHARS;
var init_observation = __esm({
  "src/cli/handlers/observation.ts"() {
    "use strict";
    init_paths();
    init_SettingsDefaultsManager();
    init_claude_code();
    init_tag_stripping();
    MAX_TOOL_OUTPUT_CHARS = 4e3;
  }
});

// src/cli/handlers/summarize.ts
async function handleSummarize(event) {
  const contentSessionId = extractContentSessionId(event);
  if (!contentSessionId) {
    return { continue: true, suppressOutput: true };
  }
  const settings = SettingsDefaultsManager.loadFromFile();
  const port = parseInt(settings.CODE_RECALL_WORKER_PORT, 10) || DEFAULT_WORKER_PORT;
  try {
    const drainStart = Date.now();
    while (Date.now() - drainStart < DRAIN_TIMEOUT_MS) {
      const res = await fetch(`http://${WORKER_HOST}:${port}/api/messages/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentSessionId })
      });
      if (res.ok) {
        const { message } = await res.json();
        if (!message) break;
      } else {
        break;
      }
      await new Promise((r) => setTimeout(r, DRAIN_POLL_INTERVAL_MS));
    }
    await fetch(`http://${WORKER_HOST}:${port}/api/messages/enqueue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentSessionId,
        messageType: "summarize",
        payload: {
          stop_reason: event.stop_reason,
          project_dir: event.project_dir
        }
      })
    });
  } catch {
  }
  return { continue: true, suppressOutput: true };
}
var DRAIN_TIMEOUT_MS, DRAIN_POLL_INTERVAL_MS;
var init_summarize = __esm({
  "src/cli/handlers/summarize.ts"() {
    "use strict";
    init_paths();
    init_SettingsDefaultsManager();
    init_claude_code();
    DRAIN_TIMEOUT_MS = 3e4;
    DRAIN_POLL_INTERVAL_MS = 500;
  }
});

// src/cli/handlers/session-complete.ts
async function handleSessionComplete(event) {
  const contentSessionId = extractContentSessionId(event);
  if (!contentSessionId) {
    return { continue: true, suppressOutput: true };
  }
  const settings = SettingsDefaultsManager.loadFromFile();
  const port = parseInt(settings.CODE_RECALL_WORKER_PORT, 10) || DEFAULT_WORKER_PORT;
  try {
    const res = await fetch(`http://${WORKER_HOST}:${port}/api/sessions/${contentSessionId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    if (!res.ok) {
      console.error(`[code-recall] session-complete failed: ${res.status}`);
    }
  } catch {
  }
  return { continue: true, suppressOutput: true };
}
var init_session_complete = __esm({
  "src/cli/handlers/session-complete.ts"() {
    "use strict";
    init_paths();
    init_SettingsDefaultsManager();
    init_claude_code();
  }
});

// src/cli/hook-command.ts
var hook_command_exports = {};
__export(hook_command_exports, {
  runHookCommand: () => runHookCommand
});
async function runHookCommand(adapter, action) {
  try {
    const handler = HANDLERS[action];
    if (!handler) {
      console.error(`[code-recall] Unknown hook action: ${action}`);
      console.log(STANDARD_HOOK_RESPONSE);
      process.exit(0);
      return;
    }
    const rawInput = await readStdin();
    let event;
    switch (adapter) {
      case "claude-code":
        event = adaptClaudeCodeEvent(rawInput) ?? {};
        break;
      case "cursor":
        event = adaptClaudeCodeEvent(rawInput) ?? {};
        break;
      default:
        event = rawInput ?? {};
    }
    const response = await handler(event);
    console.log(JSON.stringify(response));
  } catch (err) {
    console.error(`[code-recall] Hook error (${action}):`, err.message);
    console.log(STANDARD_HOOK_RESPONSE);
  }
  process.exit(0);
}
var HANDLERS;
var init_hook_command = __esm({
  "src/cli/hook-command.ts"() {
    "use strict";
    init_stdin_reader();
    init_claude_code();
    init_context();
    init_session_init();
    init_observation();
    init_summarize();
    init_session_complete();
    init_hook_constants();
    HANDLERS = {
      "context": handleContext,
      "session-init": handleSessionInit,
      "observation": handleObservation,
      "summarize": handleSummarize,
      "session-complete": handleSessionComplete
    };
  }
});

// src/services/worker-service.ts
var worker_service_exports = {};
__export(worker_service_exports, {
  WorkerService: () => WorkerService
});
module.exports = __toCommonJS(worker_service_exports);

// src/services/server/Server.ts
var import_express = __toESM(require("express"), 1);
function createServer() {
  const app = (0, import_express.default)();
  app.use(import_express.default.json({ limit: "10mb" }));
  app.use(import_express.default.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && !origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)) {
      res.status(403).json({ error: "Forbidden: non-localhost origin" });
      return;
    }
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.use((err, _req, res, _next) => {
    console.error("[code-recall] Server error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  });
  return app;
}

// src/services/sqlite/Database.ts
var import_bun_sqlite = require("bun:sqlite");
var import_fs = require("fs");
var import_path2 = require("path");
init_paths();

// src/services/sqlite/migrations.ts
var MIGRATIONS = [
  {
    version: 1,
    name: "core_tables",
    up: [
      `CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        project TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        source TEXT NOT NULL DEFAULT 'compress',
        archive_path TEXT,
        archive_bytes INTEGER,
        archive_checksum TEXT,
        archived_at TEXT,
        metadata_json TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        text TEXT NOT NULL,
        document_id TEXT UNIQUE,
        keywords TEXT,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        project TEXT NOT NULL,
        archive_basename TEXT,
        origin TEXT NOT NULL DEFAULT 'transcript',
        FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS overviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        project TEXT NOT NULL,
        origin TEXT NOT NULL DEFAULT 'claude',
        FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS diagnostics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        message TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'info',
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        project TEXT NOT NULL,
        origin TEXT NOT NULL DEFAULT 'system'
      )`,
      `CREATE TABLE IF NOT EXISTS transcript_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        project TEXT,
        event_index INTEGER NOT NULL,
        event_type TEXT,
        raw_json TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        captured_at_epoch INTEGER NOT NULL,
        UNIQUE(session_id, event_index)
      )`
    ]
  },
  {
    version: 2,
    name: "hierarchical_memory_fields",
    up: [
      `ALTER TABLE memories ADD COLUMN title TEXT`,
      `ALTER TABLE memories ADD COLUMN subtitle TEXT`,
      `ALTER TABLE memories ADD COLUMN facts TEXT`,
      `ALTER TABLE memories ADD COLUMN concepts TEXT`,
      `ALTER TABLE memories ADD COLUMN files_touched TEXT`
    ]
  },
  {
    version: 3,
    name: "pending_messages",
    up: [
      `CREATE TABLE IF NOT EXISTS pending_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_session_id TEXT NOT NULL,
        message_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'claimed', 'processed', 'failed')),
        claimed_at TEXT,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_pending_messages_status ON pending_messages(status, created_at_epoch)`
    ]
  },
  {
    version: 4,
    name: "sdk_agent_architecture",
    up: [
      `CREATE TABLE IF NOT EXISTS sdk_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_session_id TEXT UNIQUE NOT NULL,
        memory_session_id TEXT UNIQUE,
        project TEXT NOT NULL,
        user_prompt TEXT,
        started_at TEXT NOT NULL,
        started_at_epoch INTEGER NOT NULL,
        completed_at TEXT,
        completed_at_epoch INTEGER,
        status TEXT CHECK(status IN ('active', 'completed', 'failed')) NOT NULL DEFAULT 'active'
      )`,
      `CREATE TABLE IF NOT EXISTS observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_session_id TEXT NOT NULL,
        project TEXT NOT NULL,
        text TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT,
        subtitle TEXT,
        narrative TEXT,
        facts TEXT,
        concepts TEXT,
        files_read TEXT,
        files_modified TEXT,
        content_hash TEXT,
        discovery_tokens INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_observations_session ON observations(memory_session_id)`,
      `CREATE INDEX IF NOT EXISTS idx_observations_project ON observations(project)`,
      `CREATE INDEX IF NOT EXISTS idx_observations_hash ON observations(content_hash)`,
      `CREATE TABLE IF NOT EXISTS session_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_session_id TEXT UNIQUE NOT NULL,
        project TEXT NOT NULL,
        request TEXT,
        investigated TEXT,
        learned TEXT,
        completed TEXT,
        next_steps TEXT,
        files_read TEXT,
        files_edited TEXT,
        notes TEXT,
        discovery_tokens INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id)
      )`
    ]
  },
  {
    version: 5,
    name: "user_prompts",
    up: [
      `CREATE TABLE IF NOT EXISTS user_prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_session_id TEXT NOT NULL,
        prompt_number INTEGER NOT NULL,
        prompt_text TEXT NOT NULL,
        project TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        UNIQUE(content_session_id, prompt_number)
      )`
    ]
  },
  {
    version: 6,
    name: "fts5_full_text_search",
    up: [
      // FTS5 virtual tables — created conditionally (see Database.ts probe)
      `CREATE VIRTUAL TABLE IF NOT EXISTS observations_fts USING fts5(
        title, subtitle, narrative, text, facts, concepts,
        content='observations', content_rowid='id'
      )`,
      `CREATE VIRTUAL TABLE IF NOT EXISTS session_summaries_fts USING fts5(
        request, investigated, learned, completed, next_steps, notes,
        content='session_summaries', content_rowid='id'
      )`,
      // Auto-sync triggers for observations
      `CREATE TRIGGER IF NOT EXISTS observations_ai AFTER INSERT ON observations BEGIN
        INSERT INTO observations_fts(rowid, title, subtitle, narrative, text, facts, concepts)
        VALUES (new.id, new.title, new.subtitle, new.narrative, new.text, new.facts, new.concepts);
      END`,
      `CREATE TRIGGER IF NOT EXISTS observations_ad AFTER DELETE ON observations BEGIN
        INSERT INTO observations_fts(observations_fts, rowid, title, subtitle, narrative, text, facts, concepts)
        VALUES ('delete', old.id, old.title, old.subtitle, old.narrative, old.text, old.facts, old.concepts);
      END`,
      `CREATE TRIGGER IF NOT EXISTS observations_au AFTER UPDATE ON observations BEGIN
        INSERT INTO observations_fts(observations_fts, rowid, title, subtitle, narrative, text, facts, concepts)
        VALUES ('delete', old.id, old.title, old.subtitle, old.narrative, old.text, old.facts, old.concepts);
        INSERT INTO observations_fts(rowid, title, subtitle, narrative, text, facts, concepts)
        VALUES (new.id, new.title, new.subtitle, new.narrative, new.text, new.facts, new.concepts);
      END`,
      // Auto-sync triggers for session_summaries
      `CREATE TRIGGER IF NOT EXISTS summaries_ai AFTER INSERT ON session_summaries BEGIN
        INSERT INTO session_summaries_fts(rowid, request, investigated, learned, completed, next_steps, notes)
        VALUES (new.id, new.request, new.investigated, new.learned, new.completed, new.next_steps, new.notes);
      END`,
      `CREATE TRIGGER IF NOT EXISTS summaries_ad AFTER DELETE ON session_summaries BEGIN
        INSERT INTO session_summaries_fts(session_summaries_fts, rowid, request, investigated, learned, completed, next_steps, notes)
        VALUES ('delete', old.id, old.request, old.investigated, old.learned, old.completed, old.next_steps, old.notes);
      END`,
      `CREATE TRIGGER IF NOT EXISTS summaries_au AFTER UPDATE ON session_summaries BEGIN
        INSERT INTO session_summaries_fts(session_summaries_fts, rowid, request, investigated, learned, completed, next_steps, notes)
        VALUES ('delete', old.id, old.request, old.investigated, old.learned, old.completed, old.next_steps, old.notes);
        INSERT INTO session_summaries_fts(rowid, request, investigated, learned, completed, next_steps, notes)
        VALUES (new.id, new.request, new.investigated, new.learned, new.completed, new.next_steps, new.notes);
      END`
    ]
  },
  {
    version: 7,
    name: "migration_tracking",
    up: [
      // discovery_tokens already added in migration 4 table definitions
      // This migration exists for forward compat if columns were added later
      `SELECT 1`
      // no-op
    ]
  }
];

// src/services/sqlite/Database.ts
var CodeRecallDatabase = class {
  db;
  fts5Available = false;
  constructor(dbPath = PATHS.database) {
    const dir = (0, import_path2.dirname)(dbPath);
    if (!(0, import_fs.existsSync)(dir)) {
      (0, import_fs.mkdirSync)(dir, { recursive: true });
    }
    this.db = new import_bun_sqlite.Database(dbPath);
    this.configurePragmas();
    this.probeFts5();
    this.runMigrations();
  }
  configurePragmas() {
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run("PRAGMA synchronous = NORMAL");
    this.db.run("PRAGMA foreign_keys = ON");
    this.db.run("PRAGMA temp_store = memory");
    this.db.run("PRAGMA mmap_size = 268435456");
    this.db.run("PRAGMA cache_size = 10000");
    this.db.run("PRAGMA busy_timeout = 5000");
  }
  /**
   * Probe FTS5 availability — some Bun builds (Windows) lack it.
   */
  probeFts5() {
    try {
      this.db.run("CREATE VIRTUAL TABLE _fts5_probe USING fts5(test_column)");
      this.db.run("DROP TABLE _fts5_probe");
      this.fts5Available = true;
    } catch {
      this.fts5Available = false;
      console.error("[code-recall] FTS5 not available \u2014 search will use LIKE queries");
    }
  }
  runMigrations() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `);
    const applied = new Set(
      this.db.query("SELECT version FROM _migrations").all().map((r) => r.version)
    );
    for (const migration of MIGRATIONS) {
      if (applied.has(migration.version)) continue;
      if (migration.version === 6 && !this.fts5Available) {
        this.recordMigration(migration, true);
        continue;
      }
      this.applyMigration(migration);
    }
  }
  applyMigration(migration) {
    const transaction = this.db.transaction(() => {
      for (const sql of migration.up) {
        try {
          this.db.run(sql);
        } catch (err) {
          console.error(`[migration ${migration.version}] ${err.message}`);
        }
      }
      this.recordMigration(migration, false);
    });
    transaction();
  }
  recordMigration(migration, skipped) {
    this.db.run(
      "INSERT OR REPLACE INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)",
      [migration.version, `${migration.name}${skipped ? " (skipped)" : ""}`, (/* @__PURE__ */ new Date()).toISOString()]
    );
  }
  /** Get the raw bun:sqlite Database instance */
  get raw() {
    return this.db;
  }
  get hasFts5() {
    return this.fts5Available;
  }
  /**
   * Execute a function within a transaction
   */
  transaction(fn) {
    const txn = this.db.transaction(fn);
    return txn();
  }
  /**
   * Run a SQL statement
   */
  run(sql, params) {
    if (params) {
      this.db.run(sql, params);
    } else {
      this.db.run(sql);
    }
  }
  /**
   * Query and return all results
   */
  queryAll(sql, params) {
    const stmt = this.db.query(sql);
    return params ? stmt.all(...params) : stmt.all();
  }
  /**
   * Query and return first result
   */
  queryOne(sql, params) {
    const stmt = this.db.query(sql);
    return (params ? stmt.get(...params) : stmt.get()) ?? null;
  }
  close() {
    this.db.close();
  }
};

// src/services/sqlite/Sessions.ts
var SessionsStore = class {
  constructor(db) {
    this.db = db;
  }
  /**
   * Create a new SDK session.
   * contentSessionId comes from the Claude Code hook context.
   * memorySessionId starts as NULL — captured from first SDK agent response.
   */
  create(contentSessionId, project, userPrompt) {
    const now = /* @__PURE__ */ new Date();
    this.db.run(
      `INSERT OR IGNORE INTO sdk_sessions
       (content_session_id, project, user_prompt, started_at, started_at_epoch, status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [contentSessionId, project, userPrompt ?? null, now.toISOString(), Math.floor(now.getTime() / 1e3)]
    );
    return this.getByContentSessionId(contentSessionId);
  }
  getByContentSessionId(contentSessionId) {
    return this.db.queryOne(
      "SELECT * FROM sdk_sessions WHERE content_session_id = ?",
      [contentSessionId]
    );
  }
  getByMemorySessionId(memorySessionId) {
    return this.db.queryOne(
      "SELECT * FROM sdk_sessions WHERE memory_session_id = ?",
      [memorySessionId]
    );
  }
  /**
   * Capture the memorySessionId from the SDK agent's first response.
   * This is the ONLY time memorySessionId should be set.
   */
  setMemorySessionId(contentSessionId, memorySessionId) {
    this.db.run(
      "UPDATE sdk_sessions SET memory_session_id = ? WHERE content_session_id = ? AND memory_session_id IS NULL",
      [memorySessionId, contentSessionId]
    );
  }
  /**
   * Mark session as completed
   */
  complete(contentSessionId) {
    const now = /* @__PURE__ */ new Date();
    this.db.run(
      `UPDATE sdk_sessions SET status = 'completed', completed_at = ?, completed_at_epoch = ?
       WHERE content_session_id = ?`,
      [now.toISOString(), Math.floor(now.getTime() / 1e3), contentSessionId]
    );
  }
  /**
   * Mark session as failed
   */
  fail(contentSessionId) {
    const now = /* @__PURE__ */ new Date();
    this.db.run(
      `UPDATE sdk_sessions SET status = 'failed', completed_at = ?, completed_at_epoch = ?
       WHERE content_session_id = ?`,
      [now.toISOString(), Math.floor(now.getTime() / 1e3), contentSessionId]
    );
  }
  /**
   * Get active sessions (for stale session reaping)
   */
  getActiveSessions() {
    return this.db.queryAll(
      "SELECT * FROM sdk_sessions WHERE status = 'active' ORDER BY started_at_epoch DESC"
    );
  }
  /**
   * Get recent sessions for a project
   */
  getRecentByProject(project, limit = 10) {
    return this.db.queryAll(
      "SELECT * FROM sdk_sessions WHERE project = ? ORDER BY started_at_epoch DESC LIMIT ?",
      [project, limit]
    );
  }
};

// src/services/sqlite/Observations.ts
var import_crypto = require("crypto");
var ObservationsStore = class {
  constructor(db) {
    this.db = db;
  }
  /**
   * Store an observation with content-hash deduplication.
   * Returns the observation ID, or null if it was a duplicate.
   */
  insert(obs) {
    const hashInput = `${obs.type}|${obs.title ?? ""}|${obs.narrative ?? ""}|${(obs.facts ?? []).join(",")}`;
    const contentHash = (0, import_crypto.createHash)("sha256").update(hashInput).digest("hex");
    const existing = this.db.queryOne(
      "SELECT id FROM observations WHERE content_hash = ?",
      [contentHash]
    );
    if (existing) return null;
    const now = /* @__PURE__ */ new Date();
    this.db.run(
      `INSERT INTO observations
       (memory_session_id, project, text, type, title, subtitle, narrative, facts, concepts,
        files_read, files_modified, content_hash, created_at, created_at_epoch)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        obs.memorySessionId,
        obs.project,
        obs.text,
        obs.type,
        obs.title ?? null,
        obs.subtitle ?? null,
        obs.narrative ?? null,
        obs.facts ? JSON.stringify(obs.facts) : null,
        obs.concepts ? JSON.stringify(obs.concepts) : null,
        obs.filesRead ? JSON.stringify(obs.filesRead) : null,
        obs.filesModified ? JSON.stringify(obs.filesModified) : null,
        contentHash,
        now.toISOString(),
        Math.floor(now.getTime() / 1e3)
      ]
    );
    const inserted = this.db.queryOne(
      "SELECT id FROM observations WHERE content_hash = ?",
      [contentHash]
    );
    return inserted?.id ?? null;
  }
  getById(id) {
    return this.db.queryOne("SELECT * FROM observations WHERE id = ?", [id]);
  }
  getByIds(ids) {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(",");
    return this.db.queryAll(
      `SELECT * FROM observations WHERE id IN (${placeholders}) ORDER BY created_at_epoch DESC`,
      ids
    );
  }
  getByMemorySessionId(memorySessionId) {
    return this.db.queryAll(
      "SELECT * FROM observations WHERE memory_session_id = ? ORDER BY created_at_epoch ASC",
      [memorySessionId]
    );
  }
  /**
   * Get recent observations for a project (for context injection)
   */
  getRecentByProject(project, limit = 50) {
    return this.db.queryAll(
      "SELECT * FROM observations WHERE project = ? ORDER BY created_at_epoch DESC LIMIT ?",
      [project, limit]
    );
  }
  /**
   * Full-text search via FTS5
   */
  searchFts(query2, project, limit = 20) {
    if (!this.db.hasFts5) {
      return this.searchLike(query2, project, limit);
    }
    const baseQuery = `
      SELECT o.* FROM observations o
      JOIN observations_fts fts ON o.id = fts.rowid
      WHERE observations_fts MATCH ?
      ${project ? "AND o.project = ?" : ""}
      ORDER BY rank
      LIMIT ?
    `;
    const params = project ? [query2, project, limit] : [query2, limit];
    return this.db.queryAll(baseQuery, params);
  }
  /**
   * Fallback LIKE search when FTS5 is unavailable
   */
  searchLike(query2, project, limit = 20) {
    const pattern = `%${query2}%`;
    const baseQuery = `
      SELECT * FROM observations
      WHERE (text LIKE ? OR title LIKE ? OR narrative LIKE ? OR facts LIKE ?)
      ${project ? "AND project = ?" : ""}
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `;
    const params = project ? [pattern, pattern, pattern, pattern, project, limit] : [pattern, pattern, pattern, pattern, limit];
    return this.db.queryAll(baseQuery, params);
  }
  /**
   * Count observations per project
   */
  countByProject(project) {
    const result = this.db.queryOne(
      "SELECT COUNT(*) as count FROM observations WHERE project = ?",
      [project]
    );
    return result?.count ?? 0;
  }
  /**
   * Get total observation count
   */
  countAll() {
    const result = this.db.queryOne("SELECT COUNT(*) as count FROM observations");
    return result?.count ?? 0;
  }
};

// src/services/sqlite/Summaries.ts
var SummariesStore = class {
  constructor(db) {
    this.db = db;
  }
  insert(summary) {
    const now = /* @__PURE__ */ new Date();
    this.db.run(
      `INSERT OR REPLACE INTO session_summaries
       (memory_session_id, project, request, investigated, learned, completed,
        next_steps, files_read, files_edited, notes, created_at, created_at_epoch)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        summary.memorySessionId,
        summary.project,
        summary.request ?? null,
        summary.investigated ?? null,
        summary.learned ?? null,
        summary.completed ?? null,
        summary.nextSteps ?? null,
        summary.filesRead ?? null,
        summary.filesEdited ?? null,
        summary.notes ?? null,
        now.toISOString(),
        Math.floor(now.getTime() / 1e3)
      ]
    );
    const inserted = this.db.queryOne(
      "SELECT id FROM session_summaries WHERE memory_session_id = ?",
      [summary.memorySessionId]
    );
    return inserted?.id ?? 0;
  }
  getByMemorySessionId(memorySessionId) {
    return this.db.queryOne(
      "SELECT * FROM session_summaries WHERE memory_session_id = ?",
      [memorySessionId]
    );
  }
  getRecentByProject(project, limit = 10) {
    return this.db.queryAll(
      "SELECT * FROM session_summaries WHERE project = ? ORDER BY created_at_epoch DESC LIMIT ?",
      [project, limit]
    );
  }
  searchFts(query2, project, limit = 20) {
    if (!this.db.hasFts5) {
      return this.searchLike(query2, project, limit);
    }
    const baseQuery = `
      SELECT s.* FROM session_summaries s
      JOIN session_summaries_fts fts ON s.id = fts.rowid
      WHERE session_summaries_fts MATCH ?
      ${project ? "AND s.project = ?" : ""}
      ORDER BY rank
      LIMIT ?
    `;
    const params = project ? [query2, project, limit] : [query2, limit];
    return this.db.queryAll(baseQuery, params);
  }
  searchLike(query2, project, limit = 20) {
    const pattern = `%${query2}%`;
    const baseQuery = `
      SELECT * FROM session_summaries
      WHERE (request LIKE ? OR investigated LIKE ? OR learned LIKE ? OR completed LIKE ? OR notes LIKE ?)
      ${project ? "AND project = ?" : ""}
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `;
    const params = project ? [pattern, pattern, pattern, pattern, pattern, project, limit] : [pattern, pattern, pattern, pattern, pattern, limit];
    return this.db.queryAll(baseQuery, params);
  }
};

// src/services/sqlite/PendingMessageStore.ts
var PendingMessageStore = class {
  constructor(db) {
    this.db = db;
  }
  /**
   * Enqueue a new pending message
   */
  enqueue(contentSessionId, messageType, payload) {
    const now = /* @__PURE__ */ new Date();
    this.db.run(
      `INSERT INTO pending_messages (content_session_id, message_type, payload, status, created_at, created_at_epoch)
       VALUES (?, ?, ?, 'pending', ?, ?)`,
      [contentSessionId, messageType, payload, now.toISOString(), Math.floor(now.getTime() / 1e3)]
    );
    const inserted = this.db.queryOne(
      "SELECT last_insert_rowid() as id"
    );
    return inserted?.id ?? 0;
  }
  /**
   * Claim the next pending message for processing.
   * Uses atomic UPDATE + SELECT to prevent race conditions.
   */
  claimNext(contentSessionId) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.db.run(
      `UPDATE pending_messages
       SET status = 'claimed', claimed_at = ?
       WHERE id = (
         SELECT id FROM pending_messages
         WHERE content_session_id = ? AND status = 'pending'
         ORDER BY created_at_epoch ASC
         LIMIT 1
       )`,
      [now, contentSessionId]
    );
    return this.db.queryOne(
      `SELECT * FROM pending_messages
       WHERE content_session_id = ? AND status = 'claimed'
       ORDER BY claimed_at DESC
       LIMIT 1`,
      [contentSessionId]
    );
  }
  /**
   * Confirm a message was successfully processed
   */
  confirm(messageId) {
    this.db.run(
      "UPDATE pending_messages SET status = 'processed' WHERE id = ?",
      [messageId]
    );
  }
  /**
   * Mark a message as failed
   */
  fail(messageId) {
    this.db.run(
      "UPDATE pending_messages SET status = 'failed' WHERE id = ?",
      [messageId]
    );
  }
  /**
   * Re-queue stale claimed messages (claimed > 5 minutes ago but not confirmed)
   */
  requeueStale(staleThresholdMs = 5 * 60 * 1e3) {
    const cutoff = new Date(Date.now() - staleThresholdMs).toISOString();
    this.db.run(
      `UPDATE pending_messages
       SET status = 'pending', claimed_at = NULL
       WHERE status = 'claimed' AND claimed_at < ?`,
      [cutoff]
    );
    const result = this.db.queryOne(
      "SELECT changes() as count"
    );
    return result?.count ?? 0;
  }
  /**
   * Count pending messages for a session
   */
  countPending(contentSessionId) {
    const result = this.db.queryOne(
      "SELECT COUNT(*) as count FROM pending_messages WHERE content_session_id = ? AND status = 'pending'",
      [contentSessionId]
    );
    return result?.count ?? 0;
  }
  /**
   * Check if any messages are pending or being processed for a session
   */
  hasUnprocessed(contentSessionId) {
    const result = this.db.queryOne(
      "SELECT COUNT(*) as count FROM pending_messages WHERE content_session_id = ? AND status IN ('pending', 'claimed')",
      [contentSessionId]
    );
    return (result?.count ?? 0) > 0;
  }
};

// src/services/worker/SSEBroadcaster.ts
var SSEBroadcaster = class {
  clients = [];
  /**
   * Add a new SSE client connection
   */
  addClient(res) {
    const id = `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
      // Nginx compat
    });
    res.write(": keepalive\n\n");
    const client = { id, res };
    this.clients.push(client);
    res.on("close", () => {
      this.clients = this.clients.filter((c) => c.id !== id);
    });
    return id;
  }
  /**
   * Broadcast an event to all connected clients
   */
  broadcast(event, data) {
    const payload = `event: ${event}
data: ${JSON.stringify(data)}

`;
    for (const client of this.clients) {
      try {
        client.res.write(payload);
      } catch {
      }
    }
  }
  /**
   * Number of connected clients
   */
  get clientCount() {
    return this.clients.length;
  }
  /**
   * Disconnect all clients
   */
  disconnectAll() {
    for (const client of this.clients) {
      try {
        client.res.end();
      } catch {
      }
    }
    this.clients = [];
  }
};

// src/services/worker/SDKAgent.ts
var import_claude_agent_sdk = require("@anthropic-ai/claude-agent-sdk");

// src/constants/observation-metadata.ts
var OBSERVATION_TYPES = [
  "bugfix",
  "feature",
  "refactor",
  "change",
  "discovery",
  "decision"
];
var OBSERVATION_CONCEPTS = [
  "how-it-works",
  "why-it-exists",
  "what-changed",
  "problem-solution",
  "gotcha",
  "pattern",
  "trade-off"
];

// src/sdk/prompts.ts
var TYPES_LIST = OBSERVATION_TYPES.join(", ");
var CONCEPTS_LIST = OBSERVATION_CONCEPTS.join(", ");
function buildInitPrompt(project, mode) {
  return `You are an observation agent for the code-recall memory system. Your role is to watch developer tool usage and extract structured observations.

## Your Task
When you receive tool usage events, analyze them and produce structured XML observations. Each observation captures what happened, why it matters, and what was learned.

## Project Context
Project: ${project}
${mode ? `Mode: ${mode}` : ""}

## Observation Format
Respond ONLY with XML observation blocks. Do not include any other text.

<observation type="TYPE">
  <title>Short descriptive title</title>
  <subtitle>One-line context</subtitle>
  <narrative>2-3 sentence description of what happened and why it matters</narrative>
  <facts>
    <fact>Specific, concrete fact learned</fact>
    <fact>Another fact</fact>
  </facts>
  <concepts>
    <concept>Applicable concept</concept>
  </concepts>
  <files_read>
    <file>path/to/file.ts</file>
  </files_read>
  <files_modified>
    <file>path/to/changed/file.ts</file>
  </files_modified>
</observation>

## Observation Types
${TYPES_LIST}

## Concept Categories
${CONCEPTS_LIST}

## Rules
1. ALWAYS produce at least one observation per tool event
2. Use the most specific type that fits
3. Keep titles under 80 characters
4. Narratives should capture the "why", not just the "what"
5. Facts should be specific and actionable (file paths, function names, error messages)
6. Include ALL files referenced in the tool event
7. Never refuse to observe \u2014 if unsure, use type "change" and concept "what-changed"
8. Do NOT use any tools \u2014 you are an observer only`;
}
function buildObservationPrompt(toolEvent) {
  const parts = ["<tool_event>"];
  if (toolEvent.tool_name) {
    parts.push(`  <tool_name>${toolEvent.tool_name}</tool_name>`);
  }
  if (toolEvent.tool_input) {
    const inputStr = JSON.stringify(toolEvent.tool_input, null, 0);
    parts.push(`  <tool_input>${inputStr}</tool_input>`);
  }
  if (toolEvent.tool_output) {
    parts.push(`  <tool_output>${toolEvent.tool_output}</tool_output>`);
  }
  if (toolEvent.project_dir) {
    parts.push(`  <project_dir>${toolEvent.project_dir}</project_dir>`);
  }
  parts.push("</tool_event>");
  parts.push("");
  parts.push("Analyze this tool event and produce observation XML.");
  return parts.join("\n");
}
function buildSummaryPrompt() {
  return `The session is ending. Summarize all the work done in this session using this format:

<summary>
  <request>What the user asked for / the main goal</request>
  <investigated>What was explored or researched</investigated>
  <learned>Key things learned during this session</learned>
  <completed>What was actually accomplished</completed>
  <next_steps>Suggested follow-up work</next_steps>
  <files_read>Comma-separated list of files that were read</files_read>
  <files_edited>Comma-separated list of files that were modified</files_edited>
  <notes>Any additional context for future sessions</notes>
</summary>

Produce ONLY the summary XML block based on all the observations you've made during this session.`;
}
function buildContinuationPrompt(project) {
  return `Session resumed for project: ${project}. Continue observing tool events and producing observation XML as before.`;
}

// src/sdk/parser.ts
function extractTag(xml, tagName) {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}
function extractAttribute(xml, tagName, attrName) {
  const regex = new RegExp(`<${tagName}[^>]*\\s${attrName}="([^"]*)"`, "i");
  const match = xml.match(regex);
  return match ? match[1] : null;
}
function extractList(xml, containerTag, itemTag) {
  const container = extractTag(xml, containerTag);
  if (!container) return [];
  const regex = new RegExp(`<${itemTag}>([\\s\\S]*?)</${itemTag}>`, "gi");
  const items = [];
  let match;
  while ((match = regex.exec(container)) !== null) {
    const item = match[1].trim();
    if (item) items.push(item);
  }
  return items;
}
function validateType(type) {
  if (!type) return OBSERVATION_TYPES[0];
  const normalized = type.toLowerCase().trim();
  if (OBSERVATION_TYPES.includes(normalized)) return normalized;
  return OBSERVATION_TYPES[0];
}
function parseObservations(text) {
  if (!text) return [];
  const observations = [];
  const obsRegex = /<observation[^>]*>([\s\S]*?)<\/observation>/gi;
  let match;
  while ((match = obsRegex.exec(text)) !== null) {
    const block = match[0];
    const inner = match[1];
    const type = extractAttribute(block, "observation", "type");
    const title = extractTag(inner, "title");
    const subtitle = extractTag(inner, "subtitle");
    const narrative = extractTag(inner, "narrative");
    const facts = extractList(inner, "facts", "fact");
    const concepts = extractList(inner, "concepts", "concept");
    const filesRead = extractList(inner, "files_read", "file");
    const filesModified = extractList(inner, "files_modified", "file");
    observations.push({
      type: validateType(type),
      title,
      subtitle,
      narrative,
      facts,
      concepts,
      files_read: filesRead,
      files_modified: filesModified
    });
  }
  return observations;
}
function parseSummary(text) {
  if (!text) return null;
  const summaryBlock = extractTag(text, "summary");
  if (!summaryBlock) return null;
  return {
    request: extractTag(summaryBlock, "request"),
    investigated: extractTag(summaryBlock, "investigated"),
    learned: extractTag(summaryBlock, "learned"),
    completed: extractTag(summaryBlock, "completed"),
    next_steps: extractTag(summaryBlock, "next_steps"),
    files_read: extractTag(summaryBlock, "files_read"),
    files_edited: extractTag(summaryBlock, "files_edited"),
    notes: extractTag(summaryBlock, "notes")
  };
}

// src/shared/EnvManager.ts
var import_fs2 = require("fs");
init_paths();
var EnvManager = class {
  envVars = {};
  constructor() {
    this.loadEnvFile();
  }
  loadEnvFile() {
    if (!(0, import_fs2.existsSync)(PATHS.envFile)) return;
    try {
      const content = (0, import_fs2.readFileSync)(PATHS.envFile, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }
        this.envVars[key] = value;
      }
    } catch {
    }
  }
  /**
   * Build isolated environment for observer subprocess.
   * Includes env file vars but BLOCKS sensitive keys from parent process.
   */
  getIsolatedEnv() {
    const env = {};
    const safeKeys = ["PATH", "HOME", "USER", "SHELL", "TERM", "LANG", "LC_ALL", "TMPDIR"];
    for (const key of safeKeys) {
      if (process.env[key]) {
        env[key] = process.env[key];
      }
    }
    Object.assign(env, this.envVars);
    delete env["ANTHROPIC_API_KEY"];
    return env;
  }
  get(key) {
    return this.envVars[key] ?? process.env[key];
  }
};

// src/services/worker/SDKAgent.ts
init_paths();
var import_fs3 = require("fs");
var DEFAULT_MAX_CONCURRENT = 2;
var MAX_EVENTS_PER_SESSION = 100;
var activeAgents = 0;
var waitQueue = [];
async function waitForSlot(maxConcurrent) {
  if (activeAgents < maxConcurrent) {
    activeAgents++;
    return;
  }
  return new Promise((resolve) => {
    waitQueue.push(() => {
      activeAgents++;
      resolve();
    });
  });
}
function releaseSlot() {
  activeAgents--;
  const next = waitQueue.shift();
  if (next) next();
}
async function runSDKAgent(opts) {
  const {
    session,
    project,
    queueProcessor,
    maxConcurrent = DEFAULT_MAX_CONCURRENT,
    model = "claude-sonnet-4-5",
    confirmMessageFn,
    onObservations,
    onSummary,
    onMemorySessionId
  } = opts;
  if (!(0, import_fs3.existsSync)(PATHS.observerSessionsDir)) {
    (0, import_fs3.mkdirSync)(PATHS.observerSessionsDir, { recursive: true });
  }
  const envManager = new EnvManager();
  const isolatedEnv = envManager.getIsolatedEnv();
  const hasRealMemorySessionId = !!session.memory_session_id;
  const shouldResume = hasRealMemorySessionId && !!session.lastPromptNumber && session.lastPromptNumber > 1;
  const allObservations = [];
  let capturedSummary = null;
  let capturedMemorySessionId = session.memory_session_id;
  let eventCount = 0;
  await waitForSlot(maxConcurrent);
  try {
    const messages = createMessageGenerator(
      session,
      project,
      queueProcessor,
      shouldResume,
      confirmMessageFn,
      (obs, msgId) => {
        allObservations.push(...obs);
        if (onObservations) onObservations(obs, msgId);
      },
      (summary) => {
        capturedSummary = summary;
        if (onSummary) onSummary(summary);
      },
      () => eventCount++
    );
    const agentStream = (0, import_claude_agent_sdk.query)({
      prompt: messages,
      options: {
        model,
        cwd: PATHS.observerSessionsDir,
        ...shouldResume && session.memory_session_id ? { resume: session.memory_session_id } : {},
        disallowedTools: [
          "Bash",
          "Read",
          "Write",
          "Edit",
          "Grep",
          "Glob",
          "WebFetch",
          "WebSearch",
          "Task",
          "NotebookEdit",
          "AskUserQuestion",
          "TodoWrite"
        ],
        abortController: new AbortController(),
        env: isolatedEnv
      }
    });
    for await (const message of agentStream) {
      if (!capturedMemorySessionId && message.sessionId) {
        capturedMemorySessionId = message.sessionId;
        if (onMemorySessionId) onMemorySessionId(capturedMemorySessionId);
      }
      if (message.type === "assistant" || message.content) {
        const text = typeof message.content === "string" ? message.content : JSON.stringify(message.content);
        const obs = parseObservations(text);
        if (obs.length > 0) {
          allObservations.push(...obs);
        }
        const summary = parseSummary(text);
        if (summary) {
          capturedSummary = summary;
          if (onSummary) onSummary(summary);
        }
      }
      if (message.type === "result" && message.sessionId) {
        if (!capturedMemorySessionId) {
          capturedMemorySessionId = message.sessionId;
          if (onMemorySessionId) onMemorySessionId(capturedMemorySessionId);
        }
      }
    }
  } catch (err) {
    console.error(`[code-recall] SDK agent error:`, err.message);
  } finally {
    releaseSlot();
  }
  return {
    observations: allObservations,
    summary: capturedSummary,
    memorySessionId: capturedMemorySessionId,
    eventCount
  };
}
function makeUserMessage(content, contentSessionId) {
  return {
    type: "user",
    message: { role: "user", content },
    session_id: contentSessionId,
    parent_tool_use_id: null,
    isSynthetic: true
  };
}
async function* createMessageGenerator(session, project, queueProcessor, shouldResume, confirmMessageFn, onObservations, onSummary, onEvent) {
  const contentSessionId = session.content_session_id;
  if (shouldResume) {
    yield makeUserMessage(buildContinuationPrompt(project), contentSessionId);
  } else {
    yield makeUserMessage(buildInitPrompt(project), contentSessionId);
  }
  let eventCount = 0;
  for await (const message of queueProcessor) {
    if (message.message_type === "summarize") {
      confirmMessageFn(message.id);
      yield makeUserMessage(buildSummaryPrompt(), contentSessionId);
      break;
    }
    if (message.message_type === "observation") {
      try {
        const payload = JSON.parse(message.payload);
        yield makeUserMessage(buildObservationPrompt(payload), contentSessionId);
        confirmMessageFn(message.id);
        onEvent();
        eventCount++;
        if (eventCount >= MAX_EVENTS_PER_SESSION) {
          yield makeUserMessage(buildSummaryPrompt(), contentSessionId);
          break;
        }
      } catch (err) {
        console.error(`[code-recall] Failed to parse message payload:`, err.message);
        confirmMessageFn(message.id);
      }
    }
  }
}
function getAgentPoolStatus() {
  return { active: activeAgents, waiting: waitQueue.length };
}

// src/services/queue/SessionQueueProcessor.ts
var import_events = require("events");
var DEFAULT_IDLE_TIMEOUT_MS = 18e4;
var SessionQueueProcessor = class {
  emitter = new import_events.EventEmitter();
  contentSessionId;
  claimFn;
  idleTimeoutMs;
  abortController;
  _done = false;
  constructor(opts) {
    this.contentSessionId = opts.contentSessionId;
    this.claimFn = opts.claimFn;
    this.idleTimeoutMs = opts.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
    this.abortController = opts.abortController ?? new AbortController();
  }
  /**
   * Signal that a new message is available.
   * Called by the worker when a new pending_message is enqueued.
   */
  wake() {
    this.emitter.emit("wake");
  }
  /**
   * Signal that processing should stop (e.g., session complete or summary requested).
   */
  finish() {
    this._done = true;
    this.emitter.emit("wake");
  }
  get done() {
    return this._done;
  }
  async *[Symbol.asyncIterator]() {
    while (!this._done && !this.abortController.signal.aborted) {
      const message = this.claimFn(this.contentSessionId);
      if (message) {
        yield message;
        continue;
      }
      const woken = await this.waitForWake();
      if (!woken) {
        break;
      }
    }
  }
  waitForWake() {
    return new Promise((resolve) => {
      if (this._done || this.abortController.signal.aborted) {
        resolve(false);
        return;
      }
      let idleTimer = null;
      let abortHandler = null;
      let wakeHandler = null;
      const cleanup = () => {
        if (idleTimer) clearTimeout(idleTimer);
        if (wakeHandler) this.emitter.removeListener("wake", wakeHandler);
        if (abortHandler) this.abortController.signal.removeEventListener("abort", abortHandler);
      };
      wakeHandler = () => {
        cleanup();
        resolve(true);
      };
      abortHandler = () => {
        cleanup();
        resolve(false);
      };
      idleTimer = setTimeout(() => {
        cleanup();
        resolve(false);
      }, this.idleTimeoutMs);
      this.emitter.once("wake", wakeHandler);
      this.abortController.signal.addEventListener("abort", abortHandler, { once: true });
    });
  }
};

// src/services/worker/SessionManager.ts
var SessionManager = class {
  constructor(db, sessions, observations, summaries, pendingMessages, sseBroadcaster, settings) {
    this.db = db;
    this.sessions = sessions;
    this.observations = observations;
    this.summaries = summaries;
    this.pendingMessages = pendingMessages;
    this.sseBroadcaster = sseBroadcaster;
    this.settings = settings;
  }
  activeSessions = /* @__PURE__ */ new Map();
  /**
   * Ensure a session has an active agent processing its queue.
   * Called when new messages are enqueued for a session.
   */
  async ensureAgentRunning(contentSessionId) {
    if (this.activeSessions.has(contentSessionId)) {
      this.activeSessions.get(contentSessionId).queueProcessor.wake();
      return;
    }
    const session = this.sessions.getByContentSessionId(contentSessionId);
    if (!session || session.status !== "active") return;
    await this.startAgent(session);
  }
  async startAgent(session) {
    const contentSessionId = session.content_session_id;
    const abortController = new AbortController();
    const queueProcessor = new SessionQueueProcessor({
      contentSessionId,
      claimFn: (id) => this.pendingMessages.claimNext(id),
      idleTimeoutMs: this.settings.idleTimeoutMs,
      abortController
    });
    const state = {
      queueProcessor,
      abortController,
      agentPromise: null,
      eventCount: 0
    };
    this.activeSessions.set(contentSessionId, state);
    state.agentPromise = runSDKAgent({
      session,
      project: session.project,
      queueProcessor,
      maxConcurrent: this.settings.maxConcurrentAgents,
      model: this.settings.model,
      // Called when queue processor confirms a message
      confirmMessageFn: (messageId) => {
        this.pendingMessages.confirm(messageId);
      },
      // Called when observations are parsed from agent response
      onObservations: (obs, messageId) => {
        this.storeObservations(contentSessionId, session.project, obs);
        state.eventCount += obs.length;
      },
      // Called when a summary is parsed
      onSummary: (summary) => {
        const memSessionId = session.memory_session_id ?? contentSessionId;
        this.summaries.insert({
          memorySessionId: memSessionId,
          project: session.project,
          request: summary.request ?? void 0,
          investigated: summary.investigated ?? void 0,
          learned: summary.learned ?? void 0,
          completed: summary.completed ?? void 0,
          nextSteps: summary.next_steps ?? void 0,
          filesRead: summary.files_read ?? void 0,
          filesEdited: summary.files_edited ?? void 0,
          notes: summary.notes ?? void 0
        });
        this.sseBroadcaster.broadcast("summary_created", {
          memorySessionId: memSessionId,
          project: session.project
        });
      },
      // Called when SDK agent returns its session ID
      onMemorySessionId: (memorySessionId) => {
        this.sessions.setMemorySessionId(contentSessionId, memorySessionId);
      }
    });
    state.agentPromise.then((result) => {
      console.error(
        `[code-recall] Agent finished for ${contentSessionId}: ${result.observations.length} observations, ${result.summary ? "with" : "no"} summary`
      );
    }).catch((err) => {
      console.error(`[code-recall] Agent error for ${contentSessionId}:`, err.message);
    }).finally(() => {
      this.activeSessions.delete(contentSessionId);
    });
  }
  /**
   * Store parsed observations atomically.
   */
  storeObservations(contentSessionId, project, parsed) {
    const session = this.sessions.getByContentSessionId(contentSessionId);
    const memSessionId = session?.memory_session_id ?? contentSessionId;
    for (const obs of parsed) {
      const id = this.observations.insert({
        memorySessionId: memSessionId,
        project,
        text: obs.narrative ?? obs.title ?? "",
        type: obs.type,
        title: obs.title ?? void 0,
        subtitle: obs.subtitle ?? void 0,
        narrative: obs.narrative ?? void 0,
        facts: obs.facts.length > 0 ? obs.facts : void 0,
        concepts: obs.concepts.length > 0 ? obs.concepts : void 0,
        filesRead: obs.files_read.length > 0 ? obs.files_read : void 0,
        filesModified: obs.files_modified.length > 0 ? obs.files_modified : void 0
      });
      if (id !== null) {
        this.sseBroadcaster.broadcast("observation_created", {
          id,
          type: obs.type,
          title: obs.title,
          project
        });
      }
    }
  }
  /**
   * Notify a session's queue processor that new messages are available.
   */
  wakeSession(contentSessionId) {
    const state = this.activeSessions.get(contentSessionId);
    if (state) {
      state.queueProcessor.wake();
    }
  }
  /**
   * Signal a session to produce its summary and finish.
   */
  requestSummary(contentSessionId) {
    const state = this.activeSessions.get(contentSessionId);
    if (state) {
      state.queueProcessor.finish();
    }
  }
  /**
   * Abort a session's agent
   */
  abortSession(contentSessionId) {
    const state = this.activeSessions.get(contentSessionId);
    if (state) {
      state.abortController.abort();
      this.activeSessions.delete(contentSessionId);
    }
  }
  /**
   * Get status of all active sessions
   */
  getStatus() {
    return {
      activeSessions: this.activeSessions.size,
      agentPool: getAgentPoolStatus(),
      sessions: Array.from(this.activeSessions.entries()).map(([id, state]) => ({
        contentSessionId: id,
        eventCount: state.eventCount
      }))
    };
  }
};

// src/services/infrastructure/ProcessManager.ts
var import_fs4 = require("fs");
var import_path3 = require("path");
init_paths();
var PID_MTIME_GUARD_MS = 5e3;
var ProcessManager = class {
  /**
   * Write PID file with current process ID
   */
  static writePid(pidPath = PATHS.pidFile) {
    const dir = (0, import_path3.dirname)(pidPath);
    if (!(0, import_fs4.existsSync)(dir)) {
      (0, import_fs4.mkdirSync)(dir, { recursive: true });
    }
    (0, import_fs4.writeFileSync)(pidPath, String(process.pid), "utf-8");
  }
  /**
   * Remove PID file on shutdown
   */
  static removePid(pidPath = PATHS.pidFile) {
    try {
      if ((0, import_fs4.existsSync)(pidPath)) {
        (0, import_fs4.unlinkSync)(pidPath);
      }
    } catch {
    }
  }
  /**
   * Read PID from file. Returns null if file doesn't exist or is stale.
   */
  static readPid(pidPath = PATHS.pidFile) {
    if (!(0, import_fs4.existsSync)(pidPath)) return null;
    try {
      const pid = parseInt((0, import_fs4.readFileSync)(pidPath, "utf-8").trim(), 10);
      if (isNaN(pid)) return null;
      return pid;
    } catch {
      return null;
    }
  }
  /**
   * Check if a process is running by PID
   */
  static isProcessRunning(pid) {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }
  /**
   * Check if worker is already running.
   * Uses mtime guard to prevent restart cascades.
   */
  static isWorkerRunning(pidPath = PATHS.pidFile) {
    const pid = this.readPid(pidPath);
    if (pid === null) return false;
    try {
      const stat = (0, import_fs4.statSync)(pidPath);
      const age = Date.now() - stat.mtimeMs;
      if (age < PID_MTIME_GUARD_MS) {
        return true;
      }
    } catch {
      return false;
    }
    return this.isProcessRunning(pid);
  }
  /**
   * Kill the worker process if running
   */
  static killWorker(pidPath = PATHS.pidFile) {
    const pid = this.readPid(pidPath);
    if (pid === null) return false;
    try {
      process.kill(pid, "SIGTERM");
      this.removePid(pidPath);
      return true;
    } catch {
      this.removePid(pidPath);
      return false;
    }
  }
  /**
   * Register signal handlers for graceful shutdown
   */
  static registerShutdownHandlers(cleanup) {
    const handler = () => {
      cleanup();
      process.exit(0);
    };
    process.on("SIGINT", handler);
    process.on("SIGTERM", handler);
    process.on("uncaughtException", (err) => {
      console.error("[code-recall] Uncaught exception:", err);
      cleanup();
      process.exit(1);
    });
  }
};

// src/services/worker-service.ts
init_SettingsDefaultsManager();
init_paths();
var WorkerService = class {
  db;
  sessions;
  observations;
  summaries;
  pendingMessages;
  sseBroadcaster = new SSEBroadcaster();
  sessionManager;
  isReady = false;
  isShuttingDown = false;
  staleReaperInterval = null;
  async start() {
    const settings = SettingsDefaultsManager.loadFromFile();
    const port = parseInt(settings.CODE_RECALL_WORKER_PORT, 10) || DEFAULT_WORKER_PORT;
    if (ProcessManager.isWorkerRunning()) {
      console.log(`[code-recall] Worker already running`);
      process.exit(0);
    }
    const app = createServer();
    this.registerRoutes(app);
    const server = app.listen(port, WORKER_HOST, () => {
      console.log(`[code-recall] Worker listening on ${WORKER_HOST}:${port}`);
    });
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`[code-recall] Port ${port} already in use`);
        process.exit(0);
      }
      throw err;
    });
    ProcessManager.writePid();
    ProcessManager.registerShutdownHandlers(() => {
      this.shutdown();
    });
    await this.initialize(settings);
    console.log(`[code-recall] Worker ready (pid: ${process.pid})`);
  }
  async initialize(settings) {
    SettingsDefaultsManager.ensureSettingsFile();
    this.db = new CodeRecallDatabase();
    this.sessions = new SessionsStore(this.db);
    this.observations = new ObservationsStore(this.db);
    this.summaries = new SummariesStore(this.db);
    this.pendingMessages = new PendingMessageStore(this.db);
    this.sessionManager = new SessionManager(
      this.db,
      this.sessions,
      this.observations,
      this.summaries,
      this.pendingMessages,
      this.sseBroadcaster,
      {
        maxConcurrentAgents: parseInt(settings.CODE_RECALL_MAX_CONCURRENT_AGENTS, 10) || 2,
        model: settings.CODE_RECALL_OBSERVER_MODEL || "claude-sonnet-4-5",
        idleTimeoutMs: parseInt(settings.CODE_RECALL_QUEUE_IDLE_TIMEOUT_MS, 10) || 18e4
      }
    );
    this.staleReaperInterval = setInterval(() => {
      this.reapStaleSessions();
    }, 5 * 60 * 1e3);
    const requeued = this.pendingMessages.requeueStale();
    if (requeued > 0) {
      console.log(`[code-recall] Re-queued ${requeued} stale messages`);
    }
    this.isReady = true;
  }
  registerRoutes(app) {
    app.get("/", (_req, res) => {
      const status = this.isReady ? "ready" : "starting";
      const obsCount = this.isReady ? this.observations.countAll() : 0;
      const agentStatus = this.isReady ? this.sessionManager.getStatus() : { activeSessions: 0, agentPool: { active: 0, waiting: 0 }, sessions: [] };
      res.setHeader("Content-Type", "text/html");
      res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>code-recall</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; background: #0d1117; color: #c9d1d9; padding: 2rem; }
    h1 { color: #58a6ff; margin-bottom: 0.5rem; font-size: 1.8rem; }
    .subtitle { color: #8b949e; margin-bottom: 2rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1.2rem; }
    .card .label { color: #8b949e; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .card .value { color: #f0f6fc; font-size: 2rem; font-weight: bold; margin-top: 0.3rem; }
    .card .value.green { color: #3fb950; }
    .card .value.blue { color: #58a6ff; }
    .card .value.yellow { color: #d29922; }
    .section { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem; }
    .section h2 { color: #58a6ff; font-size: 1.1rem; margin-bottom: 1rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.5rem 1rem; border-bottom: 1px solid #21262d; }
    th { color: #8b949e; font-size: 0.8rem; text-transform: uppercase; }
    td { color: #c9d1d9; font-size: 0.9rem; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; }
    .badge.ready { background: #238636; color: #fff; }
    .badge.starting { background: #d29922; color: #fff; }
    #observations { max-height: 400px; overflow-y: auto; }
    .obs-item { padding: 0.8rem 0; border-bottom: 1px solid #21262d; }
    .obs-type { color: #58a6ff; font-weight: 600; font-size: 0.8rem; }
    .obs-title { color: #f0f6fc; margin-top: 0.2rem; }
    .obs-narrative { color: #8b949e; font-size: 0.85rem; margin-top: 0.2rem; }
    .empty { color: #484f58; font-style: italic; padding: 2rem; text-align: center; }
    footer { color: #484f58; font-size: 0.8rem; margin-top: 2rem; text-align: center; }
    a { color: #58a6ff; text-decoration: none; }
  </style>
</head>
<body>
  <h1>code-recall</h1>
  <p class="subtitle">Persistent memory system for Claude Code</p>

  <div class="grid">
    <div class="card">
      <div class="label">Status</div>
      <div class="value green"><span class="badge ${status}">${status}</span></div>
    </div>
    <div class="card">
      <div class="label">Observations</div>
      <div class="value blue">${obsCount}</div>
    </div>
    <div class="card">
      <div class="label">Active Agents</div>
      <div class="value yellow">${agentStatus.agentPool.active}</div>
    </div>
    <div class="card">
      <div class="label">SSE Clients</div>
      <div class="value">${this.sseBroadcaster.clientCount}</div>
    </div>
    <div class="card">
      <div class="label">PID</div>
      <div class="value" style="font-size:1.2rem">${process.pid}</div>
    </div>
    <div class="card">
      <div class="label">Uptime</div>
      <div class="value" style="font-size:1.2rem">${Math.floor(process.uptime())}s</div>
    </div>
  </div>

  <div class="section">
    <h2>Recent Observations</h2>
    <div id="observations"></div>
  </div>

  <div class="section">
    <h2>API Endpoints</h2>
    <table>
      <tr><th>Method</th><th>Path</th><th>Description</th></tr>
      <tr><td>GET</td><td><a href="/api/health">/api/health</a></td><td>Health check</td></tr>
      <tr><td>GET</td><td><a href="/api/search?q=test">/api/search</a></td><td>Search observations &amp; summaries</td></tr>
      <tr><td>GET</td><td><a href="/api/timeline">/api/timeline</a></td><td>Recent timeline</td></tr>
      <tr><td>GET</td><td><a href="/api/observations/recent">/api/observations/recent</a></td><td>Recent observations</td></tr>
      <tr><td>GET</td><td><a href="/api/memory/stats">/api/memory/stats</a></td><td>Memory statistics</td></tr>
      <tr><td>GET</td><td><a href="/api/agents/status">/api/agents/status</a></td><td>Agent pool status</td></tr>
      <tr><td>GET</td><td><a href="/api/settings">/api/settings</a></td><td>Current settings</td></tr>
      <tr><td>GET</td><td>/stream</td><td>SSE event stream</td></tr>
    </table>
  </div>

  <footer>code-recall v1.0.0 &middot; <a href="https://github.com/sangameshgupta/code-recall">GitHub</a></footer>

  <script>
    fetch('/api/observations/recent?limit=20')
      .then(r => r.json())
      .then(data => {
        const el = document.getElementById('observations');
        if (!data.observations || data.observations.length === 0) {
          el.innerHTML = '<div class="empty">No observations yet. Start a Claude Code session to begin recording.</div>';
          return;
        }
        el.innerHTML = data.observations.map(o => \`
          <div class="obs-item">
            <span class="obs-type">\${o.type || 'change'}</span>
            <div class="obs-title">\${o.title || 'Untitled'}</div>
            \${o.narrative ? \`<div class="obs-narrative">\${o.narrative}</div>\` : ''}
          </div>
        \`).join('');
      })
      .catch(() => {
        document.getElementById('observations').innerHTML = '<div class="empty">Failed to load observations.</div>';
      });
  </script>
</body>
</html>`);
    });
    app.get("/api/health", (_req, res) => {
      res.json({
        status: this.isReady ? "ready" : "starting",
        pid: process.pid,
        uptime: process.uptime(),
        observations: this.isReady ? this.observations.countAll() : 0
      });
    });
    app.get("/stream", (req, res) => {
      const clientId = this.sseBroadcaster.addClient(res);
      console.log(`[code-recall] SSE client connected: ${clientId}`);
    });
    app.post("/api/sessions/init", (req, res) => {
      if (!this.isReady) {
        res.status(503).json({ error: "Worker not ready" });
        return;
      }
      const { contentSessionId, project, userPrompt } = req.body;
      if (!contentSessionId || !project) {
        res.status(400).json({ error: "contentSessionId and project required" });
        return;
      }
      const session = this.sessions.create(contentSessionId, project, userPrompt);
      res.json({ session });
    });
    app.post("/api/sessions/:contentSessionId/memory-session-id", (req, res) => {
      if (!this.isReady) {
        res.status(503).json({ error: "Worker not ready" });
        return;
      }
      const { contentSessionId } = req.params;
      const { memorySessionId } = req.body;
      this.sessions.setMemorySessionId(contentSessionId, memorySessionId);
      res.json({ ok: true });
    });
    app.post("/api/sessions/:contentSessionId/complete", (req, res) => {
      if (!this.isReady) {
        res.status(503).json({ error: "Worker not ready" });
        return;
      }
      const { contentSessionId } = req.params;
      this.sessionManager.requestSummary(contentSessionId);
      this.sessions.complete(contentSessionId);
      res.json({ ok: true });
    });
    app.post("/api/messages/enqueue", (req, res) => {
      if (!this.isReady) {
        res.status(503).json({ error: "Worker not ready" });
        return;
      }
      const { contentSessionId, messageType, payload } = req.body;
      const id = this.pendingMessages.enqueue(contentSessionId, messageType, JSON.stringify(payload));
      this.sseBroadcaster.broadcast("message_enqueued", { id, contentSessionId, messageType });
      this.sessionManager.ensureAgentRunning(contentSessionId).catch((err) => {
        console.error(`[code-recall] Failed to ensure agent running:`, err.message);
      });
      res.json({ id });
    });
    app.post("/api/messages/claim", (req, res) => {
      if (!this.isReady) {
        res.status(503).json({ error: "Worker not ready" });
        return;
      }
      const { contentSessionId } = req.body;
      const message = this.pendingMessages.claimNext(contentSessionId);
      res.json({ message });
    });
    app.post("/api/messages/:id/confirm", (req, res) => {
      if (!this.isReady) {
        res.status(503).json({ error: "Worker not ready" });
        return;
      }
      this.pendingMessages.confirm(parseInt(req.params.id, 10));
      res.json({ ok: true });
    });
    app.post("/api/observations", (req, res) => {
      if (!this.isReady) {
        res.status(503).json({ error: "Worker not ready" });
        return;
      }
      const id = this.observations.insert(req.body);
      if (id !== null) {
        this.sseBroadcaster.broadcast("observation_created", { id });
      }
      res.json({ id, duplicate: id === null });
    });
    app.post("/api/observations/batch", (req, res) => {
      if (!this.isReady) {
        res.status(503).json({ error: "Worker not ready" });
        return;
      }
      const { ids } = req.body;
      const results = this.observations.getByIds(ids ?? []);
      res.json({ observations: results });
    });
    app.get("/api/observations/recent", (req, res) => {
      if (!this.isReady) {
        res.status(503).json({ error: "Worker not ready" });
        return;
      }
      const project = req.query.project;
      const limit = parseInt(req.query.limit, 10) || 50;
      const results = project ? this.observations.getRecentByProject(project, limit) : this.observations.getRecentByProject("", limit);
      res.json({ observations: results });
    });
    app.get("/api/search", (req, res) => {
      if (!this.isReady) {
        res.status(503).json({ error: "Worker not ready" });
        return;
      }
      const query2 = req.query.q;
      const project = req.query.project;
      const limit = parseInt(req.query.limit, 10) || 20;
      if (!query2) {
        res.status(400).json({ error: "Query parameter q required" });
        return;
      }
      const observations = this.observations.searchFts(query2, project, limit);
      const summaries = this.summaries.searchFts(query2, project, limit);
      res.json({
        observations: observations.map((o) => ({
          id: o.id,
          type: o.type,
          title: o.title,
          subtitle: o.subtitle,
          project: o.project,
          created_at: o.created_at
        })),
        summaries: summaries.map((s) => ({
          id: s.id,
          request: s.request,
          project: s.project,
          created_at: s.created_at
        }))
      });
    });
    app.get("/api/timeline", (req, res) => {
      if (!this.isReady) {
        res.status(503).json({ error: "Worker not ready" });
        return;
      }
      const project = req.query.project;
      const limit = parseInt(req.query.limit, 10) || 50;
      const observations = project ? this.observations.getRecentByProject(project, limit) : this.observations.getRecentByProject("", limit);
      res.json({ timeline: observations });
    });
    app.post("/api/summaries", (req, res) => {
      if (!this.isReady) {
        res.status(503).json({ error: "Worker not ready" });
        return;
      }
      const id = this.summaries.insert(req.body);
      this.sseBroadcaster.broadcast("summary_created", { id });
      res.json({ id });
    });
    app.get("/api/settings", (_req, res) => {
      const settings = SettingsDefaultsManager.loadFromFile();
      res.json({ settings });
    });
    app.get("/api/memory/stats", (_req, res) => {
      if (!this.isReady) {
        res.status(503).json({ error: "Worker not ready" });
        return;
      }
      res.json({
        totalObservations: this.observations.countAll(),
        fts5Available: this.db.hasFts5,
        sseClients: this.sseBroadcaster.clientCount,
        pid: process.pid,
        uptime: process.uptime()
      });
    });
    app.get("/api/agents/status", (_req, res) => {
      if (!this.isReady) {
        res.status(503).json({ error: "Worker not ready" });
        return;
      }
      res.json(this.sessionManager.getStatus());
    });
  }
  reapStaleSessions() {
    if (!this.isReady) return;
    const activeSessions = this.sessions.getActiveSessions();
    const staleThreshold = Date.now() / 1e3 - 24 * 60 * 60;
    for (const session of activeSessions) {
      if (session.started_at_epoch < staleThreshold) {
        this.sessions.fail(session.content_session_id);
        console.log(`[code-recall] Reaped stale session: ${session.content_session_id}`);
      }
    }
  }
  shutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    console.log("[code-recall] Shutting down worker...");
    if (this.staleReaperInterval) {
      clearInterval(this.staleReaperInterval);
    }
    this.sseBroadcaster.disconnectAll();
    if (this.db) {
      this.db.close();
    }
    ProcessManager.removePid();
  }
};
var command = process.argv[2];
if (command === "start") {
  const worker = new WorkerService();
  worker.start().catch((err) => {
    console.error("[code-recall] Worker failed to start:", err);
    process.exit(0);
  });
} else if (command === "hook") {
  const adapter = process.argv[3];
  const action = process.argv[4];
  Promise.resolve().then(() => (init_hook_command(), hook_command_exports)).then(({ runHookCommand: runHookCommand2 }) => {
    runHookCommand2(adapter, action);
  }).catch((err) => {
    console.error("[code-recall] Hook command failed:", err);
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
    process.exit(0);
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  WorkerService
});
