# code-recall

Persistent memory system for Claude Code. Automatically observes your coding sessions — tool usage, file changes, discoveries, decisions — and injects relevant context into new sessions.

## How It Works

```
┌─────────────┐     hooks.json      ┌──────────────┐     HTTP API     ┌─────────────────┐
│ Claude Code  │ ──────────────────> │  Hook System  │ ──────────────> │  Worker Daemon   │
│  (your IDE)  │  lifecycle events   │  (stdin/out)  │  enqueue msgs   │  (port 37888)    │
└─────────────┘                     └──────────────┘                  └────────┬────────┘
                                                                               │
                                          ┌────────────────────────────────────┤
                                          │                                    │
                                    ┌─────▼──────┐                    ┌────────▼────────┐
                                    │  SQLite DB  │                    │  SDK Observer    │
                                    │  WAL + FTS5 │                    │  Agent (Claude)  │
                                    └─────▲──────┘                    └────────┬────────┘
                                          │                                    │
                                          │        XML observations            │
                                          └────────────────────────────────────┘
```

1. **Hooks** intercept Claude Code lifecycle events (session start, tool use, stop)
2. **Worker daemon** manages a background SQLite database and spawns observer agents
3. **Observer agent** (a secondary Claude instance) watches tool usage and produces structured XML observations
4. **Context injection** feeds relevant observations back into new sessions via `<code-recall-context>` blocks
5. **MCP tools** let Claude search memory with a 3-layer progressive pattern

## Installation

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0 or Node.js >= 18
- Claude Code CLI installed and authenticated

### Install as Claude Code Plugin

```bash
# Clone the repo
git clone https://github.com/sangameshgupta/code-recall.git
cd code-recall

# Install dependencies
bun install

# Build the plugin bundles
bun run build

# Install the plugin into Claude Code
claude plugin add ./plugin
```

### Manual Setup

If you prefer manual setup:

```bash
# 1. Install dependencies
bun install

# 2. Build
bun run build

# 3. Copy plugin/ directory to your Claude Code plugins location
# 4. Or add the MCP server manually to your .mcp.json:
```

```json
{
  "mcpServers": {
    "code-recall": {
      "command": "node",
      "args": ["/path/to/code-recall/plugin/scripts/bun-runner.js", "/path/to/code-recall/plugin/scripts/mcp-server.cjs"],
      "env": {}
    }
  }
}
```

## Configuration

Settings are stored in `~/.code-recall/settings.json` and auto-created on first run:

| Setting | Default | Description |
|---------|---------|-------------|
| `CODE_RECALL_WORKER_PORT` | `37888` | Worker daemon port |
| `CODE_RECALL_PROVIDER` | `claude` | AI provider (claude/gemini/openrouter) |
| `CODE_RECALL_OBSERVER_MODEL` | `claude-sonnet-4-5` | Model for observer agent |
| `CODE_RECALL_MAX_CONCURRENT_AGENTS` | `2` | Max parallel observer agents |
| `CODE_RECALL_CONTEXT_OBSERVATIONS` | `50` | Observations injected per session |
| `CODE_RECALL_CONTEXT_TOKEN_BUDGET` | `8000` | Max tokens for context block |
| `CODE_RECALL_QUEUE_IDLE_TIMEOUT_MS` | `180000` | Agent idle timeout (3 min) |
| `CODE_RECALL_FTS5_ENABLED` | `true` | Full-text search |
| `CODE_RECALL_CHROMA_ENABLED` | `false` | ChromaDB vector search |
| `CODE_RECALL_PRIVACY_MODE` | `false` | Strip all tool output |
| `CODE_RECALL_LOG_LEVEL` | `info` | Log verbosity |

## Architecture

### Dual Session ID System

- **contentSessionId** — From Claude Code hooks. Used for **storage** (links observations to the coding session)
- **memorySessionId** — From SDK agent response. Used for **resume** (continues the observer agent's conversation)

These are never mixed. Confusing them would inject observations into wrong sessions or corrupt the user's Claude Code transcript.

### Hook Lifecycle

| Hook Event | Action |
|------------|--------|
| `SessionStart` | Start worker, inject context from prior observations |
| `UserPromptSubmit` | Initialize session tracking |
| `PostToolUse` | Enqueue tool event for observer agent |
| `Stop` | Request session summary, mark complete |

### Observation Types

| Type | Description |
|------|-------------|
| `bugfix` | Bug identification and fix |
| `feature` | New functionality added |
| `refactor` | Code restructuring |
| `change` | General modification |
| `discovery` | Something learned about the codebase |
| `decision` | Architectural or design choice |

### MCP Tools (3-Layer Search)

```
1. search(q="query")          → Index with IDs (~50-100 tokens/result)
2. timeline(project="name")   → Chronological context
3. get_observations(ids=[..]) → Full details (~500-1000 tokens/result)
```

Always filter before fetching. 10x token savings.

## Data Storage

All data lives in `~/.code-recall/`:

```
~/.code-recall/
├── code-recall.db          # SQLite database (WAL mode)
├── settings.json           # Configuration
├── .env                    # API keys (optional)
├── worker.pid              # Daemon PID file
├── observer-sessions/      # SDK agent session data
└── logs/                   # Log files
```

### SQLite Tables

- `sdk_sessions` — Session tracking with dual ID mapping
- `observations` — Structured observations with content-hash dedup
- `session_summaries` — End-of-session summaries
- `pending_messages` — Claim-confirm message queue
- `observations_fts` — FTS5 full-text search index
- `session_summaries_fts` — FTS5 summary search index

## Development

```bash
# Type check
bun run typecheck

# Run worker in dev mode
bun run dev

# Build plugin bundles
bun run build

# Run tests
bun test
```

## Privacy

- Tool output is truncated to 4000 chars before sending to observer
- `<private>` tags in tool output are stripped (including nested tags)
- Observer agent runs with ALL tools disabled — it can only read and respond
- API keys are isolated via `EnvManager` — the observer never sees your project's `.env`
- All data stays local in `~/.code-recall/`

## License

MIT
