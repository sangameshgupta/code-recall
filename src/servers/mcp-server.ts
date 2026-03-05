/**
 * Code-Recall MCP Search Server — Thin HTTP Wrapper
 *
 * Delegates all business logic to Worker HTTP API at localhost:37888
 * Maintains MCP protocol handling and tool schemas
 */

// CRITICAL: Redirect console.log to stderr BEFORE other imports
// MCP uses stdio transport where stdout is reserved for JSON-RPC protocol messages.
const _originalLog = console.log;
console.log = (...args: unknown[]) => {
  process.stderr.write(args.map(String).join(' ') + '\n');
};

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SettingsDefaultsManager } from '../shared/SettingsDefaultsManager.js';
import { DEFAULT_WORKER_PORT, WORKER_HOST } from '../shared/paths.js';

// Worker HTTP API configuration
const settings = SettingsDefaultsManager.loadFromFile();
const WORKER_PORT = parseInt(settings.CODE_RECALL_WORKER_PORT, 10) || DEFAULT_WORKER_PORT;
const WORKER_BASE_URL = `http://${WORKER_HOST}:${WORKER_PORT}`;

// Parent heartbeat — detect orphaned MCP servers
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
const parentPid = process.ppid;

function startParentHeartbeat(): void {
  heartbeatTimer = setInterval(() => {
    try {
      process.kill(parentPid, 0); // Signal 0 = existence check
    } catch {
      console.log('[code-recall] Parent process gone, shutting down MCP server');
      cleanup();
    }
  }, 30_000);
}

/**
 * Call Worker HTTP API with GET (query params)
 */
async function callWorkerGet(
  endpoint: string,
  params: Record<string, unknown>,
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
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
      content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text' as const,
        text: `Error calling Worker API: ${error instanceof Error ? error.message : String(error)}`,
      }],
      isError: true,
    };
  }
}

/**
 * Call Worker HTTP API with POST body
 */
async function callWorkerPost(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const url = `${WORKER_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Worker API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text' as const,
        text: `Error calling Worker API: ${error instanceof Error ? error.message : String(error)}`,
      }],
      isError: true,
    };
  }
}

/**
 * Tool definitions
 */
const tools = [
  {
    name: '__IMPORTANT',
    description: `3-LAYER WORKFLOW (ALWAYS FOLLOW):
1. search(query) → Get index with IDs (~50-100 tokens/result)
2. timeline(project) → Get context around results
3. get_observations([IDs]) → Fetch full details ONLY for filtered IDs
NEVER fetch full details without filtering first. 10x token savings.`,
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: async () => ({
      content: [{
        type: 'text' as const,
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

**Why:** 10x token savings. Never fetch full details without filtering first.`,
      }],
    }),
  },
  {
    name: 'search',
    description: 'Step 1: Search memory. Returns index with IDs. Params: q (query string, required), limit, project',
    inputSchema: {
      type: 'object' as const,
      properties: {
        q: { type: 'string' as const, description: 'Search query (required)' },
        limit: { type: 'number' as const, description: 'Max results (default: 20)' },
        project: { type: 'string' as const, description: 'Filter by project name' },
      },
      required: ['q'],
    },
    handler: async (args: Record<string, unknown>) => {
      return await callWorkerGet('/api/search', args);
    },
  },
  {
    name: 'timeline',
    description: 'Step 2: Get chronological context. Params: project, limit',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project: { type: 'string' as const, description: 'Filter by project name' },
        limit: { type: 'number' as const, description: 'Max results (default: 50)' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      return await callWorkerGet('/api/timeline', args);
    },
  },
  {
    name: 'get_observations',
    description: 'Step 3: Fetch full details for filtered IDs. Always batch for 2+ items.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        ids: {
          type: 'array' as const,
          items: { type: 'number' as const },
          description: 'Array of observation IDs to fetch (required)',
        },
      },
      required: ['ids'],
    },
    handler: async (args: Record<string, unknown>) => {
      return await callWorkerPost('/api/observations/batch', args);
    },
  },
];

// Create MCP server
const server = new Server(
  { name: 'code-recall', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

// Register tools/list handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}));

// Register tools/call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = tools.find((t) => t.name === request.params.name);

  if (!tool) {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  try {
    return await tool.handler((request.params.arguments ?? {}) as Record<string, unknown>);
  } catch (error) {
    return {
      content: [{
        type: 'text' as const,
        text: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
      }],
      isError: true,
    };
  }
});

function cleanup() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  console.log('[code-recall] MCP server shutting down');
  process.exit(0);
}

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('[code-recall] MCP search server started');

  startParentHeartbeat();

  // Check Worker availability in background
  setTimeout(async () => {
    try {
      const response = await fetch(`${WORKER_BASE_URL}/api/health`);
      if (response.ok) {
        console.log('[code-recall] Worker available');
      } else {
        console.log('[code-recall] Worker not ready yet');
      }
    } catch {
      console.log('[code-recall] Worker not available — tools will fail until worker starts');
    }
  }, 0);
}

main().catch((error) => {
  console.log('[code-recall] Fatal error:', error);
  process.exit(0);
});
