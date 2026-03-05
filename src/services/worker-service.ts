import { createServer } from './server/Server.js';
import { CodeRecallDatabase } from './sqlite/Database.js';
import { SessionsStore } from './sqlite/Sessions.js';
import { ObservationsStore } from './sqlite/Observations.js';
import { SummariesStore } from './sqlite/Summaries.js';
import { PendingMessageStore } from './sqlite/PendingMessageStore.js';
import { SSEBroadcaster } from './worker/SSEBroadcaster.js';
import { SessionManager } from './worker/SessionManager.js';
import { ProcessManager } from './infrastructure/ProcessManager.js';
import { SettingsDefaultsManager } from '../shared/SettingsDefaultsManager.js';
import { PATHS, DEFAULT_WORKER_PORT, WORKER_HOST } from '../shared/paths.js';
import type { Request, Response } from 'express';

export class WorkerService {
  private db!: CodeRecallDatabase;
  private sessions!: SessionsStore;
  private observations!: ObservationsStore;
  private summaries!: SummariesStore;
  private pendingMessages!: PendingMessageStore;
  private sseBroadcaster = new SSEBroadcaster();
  private sessionManager!: SessionManager;
  private isReady = false;
  private isShuttingDown = false;
  private staleReaperInterval: ReturnType<typeof setInterval> | null = null;

  async start(): Promise<void> {
    const settings = SettingsDefaultsManager.loadFromFile();
    const port = parseInt(settings.CODE_RECALL_WORKER_PORT, 10) || DEFAULT_WORKER_PORT;

    // Check if already running
    if (ProcessManager.isWorkerRunning()) {
      console.log(`[code-recall] Worker already running`);
      process.exit(0);
    }

    // Create Express server
    const app = createServer();

    // Register routes BEFORE initialization (so health check works immediately)
    this.registerRoutes(app);

    // Start listening immediately
    const server = app.listen(port, WORKER_HOST, () => {
      console.log(`[code-recall] Worker listening on ${WORKER_HOST}:${port}`);
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[code-recall] Port ${port} already in use`);
        process.exit(0); // Exit 0 to prevent Windows terminal tab accumulation
      }
      throw err;
    });

    // Write PID file
    ProcessManager.writePid();

    // Register graceful shutdown
    ProcessManager.registerShutdownHandlers(() => {
      this.shutdown();
    });

    // Background initialization
    await this.initialize(settings);

    console.log(`[code-recall] Worker ready (pid: ${process.pid})`);
  }

  private async initialize(settings: Record<string, string>): Promise<void> {
    // Ensure data directory exists
    SettingsDefaultsManager.ensureSettingsFile();

    // Initialize database
    this.db = new CodeRecallDatabase();
    this.sessions = new SessionsStore(this.db);
    this.observations = new ObservationsStore(this.db);
    this.summaries = new SummariesStore(this.db);
    this.pendingMessages = new PendingMessageStore(this.db);

    // Initialize session manager (SDK agent orchestrator)
    this.sessionManager = new SessionManager(
      this.db,
      this.sessions,
      this.observations,
      this.summaries,
      this.pendingMessages,
      this.sseBroadcaster,
      {
        maxConcurrentAgents: parseInt(settings.CODE_RECALL_MAX_CONCURRENT_AGENTS, 10) || 2,
        model: settings.CODE_RECALL_OBSERVER_MODEL || 'claude-sonnet-4-5',
        idleTimeoutMs: parseInt(settings.CODE_RECALL_QUEUE_IDLE_TIMEOUT_MS, 10) || 180000,
      },
    );

    // Start stale session reaper (every 5 minutes)
    this.staleReaperInterval = setInterval(() => {
      this.reapStaleSessions();
    }, 5 * 60 * 1000);

    // Re-queue stale pending messages
    const requeued = this.pendingMessages.requeueStale();
    if (requeued > 0) {
      console.log(`[code-recall] Re-queued ${requeued} stale messages`);
    }

    this.isReady = true;
  }

  private registerRoutes(app: ReturnType<typeof createServer>): void {
    // Dashboard
    app.get('/', (_req: Request, res: Response) => {
      const status = this.isReady ? 'ready' : 'starting';
      const obsCount = this.isReady ? this.observations.countAll() : 0;
      const agentStatus = this.isReady ? this.sessionManager.getStatus() : { activeSessions: 0, agentPool: { active: 0, waiting: 0 }, sessions: [] };

      res.setHeader('Content-Type', 'text/html');
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

    // Health check — always available
    app.get('/api/health', (_req: Request, res: Response) => {
      res.json({
        status: this.isReady ? 'ready' : 'starting',
        pid: process.pid,
        uptime: process.uptime(),
        observations: this.isReady ? this.observations.countAll() : 0,
      });
    });

    // SSE stream
    app.get('/stream', (req: Request, res: Response) => {
      const clientId = this.sseBroadcaster.addClient(res);
      console.log(`[code-recall] SSE client connected: ${clientId}`);
    });

    // Session management
    app.post('/api/sessions/init', (req: Request, res: Response) => {
      if (!this.isReady) {
        res.status(503).json({ error: 'Worker not ready' });
        return;
      }

      const { contentSessionId, project, userPrompt } = req.body;
      if (!contentSessionId || !project) {
        res.status(400).json({ error: 'contentSessionId and project required' });
        return;
      }

      const session = this.sessions.create(contentSessionId, project, userPrompt);
      res.json({ session });
    });

    app.post('/api/sessions/:contentSessionId/memory-session-id', (req: Request, res: Response) => {
      if (!this.isReady) { res.status(503).json({ error: 'Worker not ready' }); return; }

      const { contentSessionId } = req.params;
      const { memorySessionId } = req.body;
      this.sessions.setMemorySessionId(contentSessionId, memorySessionId);
      res.json({ ok: true });
    });

    app.post('/api/sessions/:contentSessionId/complete', (req: Request, res: Response) => {
      if (!this.isReady) { res.status(503).json({ error: 'Worker not ready' }); return; }

      const { contentSessionId } = req.params;

      // Signal agent to produce summary before completing
      this.sessionManager.requestSummary(contentSessionId);

      this.sessions.complete(contentSessionId);
      res.json({ ok: true });
    });

    // Observation queue
    app.post('/api/messages/enqueue', (req: Request, res: Response) => {
      if (!this.isReady) { res.status(503).json({ error: 'Worker not ready' }); return; }

      const { contentSessionId, messageType, payload } = req.body;
      const id = this.pendingMessages.enqueue(contentSessionId, messageType, JSON.stringify(payload));

      // Broadcast to SSE clients
      this.sseBroadcaster.broadcast('message_enqueued', { id, contentSessionId, messageType });

      // Trigger agent to process the enqueued message
      this.sessionManager.ensureAgentRunning(contentSessionId).catch((err) => {
        console.error(`[code-recall] Failed to ensure agent running:`, (err as Error).message);
      });

      res.json({ id });
    });

    app.post('/api/messages/claim', (req: Request, res: Response) => {
      if (!this.isReady) { res.status(503).json({ error: 'Worker not ready' }); return; }

      const { contentSessionId } = req.body;
      const message = this.pendingMessages.claimNext(contentSessionId);
      res.json({ message });
    });

    app.post('/api/messages/:id/confirm', (req: Request, res: Response) => {
      if (!this.isReady) { res.status(503).json({ error: 'Worker not ready' }); return; }

      this.pendingMessages.confirm(parseInt(req.params.id, 10));
      res.json({ ok: true });
    });

    // Observations
    app.post('/api/observations', (req: Request, res: Response) => {
      if (!this.isReady) { res.status(503).json({ error: 'Worker not ready' }); return; }

      const id = this.observations.insert(req.body);
      if (id !== null) {
        this.sseBroadcaster.broadcast('observation_created', { id });
      }
      res.json({ id, duplicate: id === null });
    });

    app.post('/api/observations/batch', (req: Request, res: Response) => {
      if (!this.isReady) { res.status(503).json({ error: 'Worker not ready' }); return; }

      const { ids } = req.body;
      const results = this.observations.getByIds(ids ?? []);
      res.json({ observations: results });
    });

    app.get('/api/observations/recent', (req: Request, res: Response) => {
      if (!this.isReady) { res.status(503).json({ error: 'Worker not ready' }); return; }

      const project = req.query.project as string;
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const results = project
        ? this.observations.getRecentByProject(project, limit)
        : this.observations.getRecentByProject('', limit);
      res.json({ observations: results });
    });

    // Search
    app.get('/api/search', (req: Request, res: Response) => {
      if (!this.isReady) { res.status(503).json({ error: 'Worker not ready' }); return; }

      const query = req.query.q as string;
      const project = req.query.project as string | undefined;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      if (!query) {
        res.status(400).json({ error: 'Query parameter q required' });
        return;
      }

      const observations = this.observations.searchFts(query, project, limit);
      const summaries = this.summaries.searchFts(query, project, limit);

      res.json({
        observations: observations.map(o => ({
          id: o.id,
          type: o.type,
          title: o.title,
          subtitle: o.subtitle,
          project: o.project,
          created_at: o.created_at,
        })),
        summaries: summaries.map(s => ({
          id: s.id,
          request: s.request,
          project: s.project,
          created_at: s.created_at,
        })),
      });
    });

    // Timeline
    app.get('/api/timeline', (req: Request, res: Response) => {
      if (!this.isReady) { res.status(503).json({ error: 'Worker not ready' }); return; }

      const project = req.query.project as string | undefined;
      const limit = parseInt(req.query.limit as string, 10) || 50;

      const observations = project
        ? this.observations.getRecentByProject(project, limit)
        : this.observations.getRecentByProject('', limit);

      res.json({ timeline: observations });
    });

    // Summaries
    app.post('/api/summaries', (req: Request, res: Response) => {
      if (!this.isReady) { res.status(503).json({ error: 'Worker not ready' }); return; }

      const id = this.summaries.insert(req.body);
      this.sseBroadcaster.broadcast('summary_created', { id });
      res.json({ id });
    });

    // Settings
    app.get('/api/settings', (_req: Request, res: Response) => {
      const settings = SettingsDefaultsManager.loadFromFile();
      res.json({ settings });
    });

    // Memory stats
    app.get('/api/memory/stats', (_req: Request, res: Response) => {
      if (!this.isReady) { res.status(503).json({ error: 'Worker not ready' }); return; }

      res.json({
        totalObservations: this.observations.countAll(),
        fts5Available: this.db.hasFts5,
        sseClients: this.sseBroadcaster.clientCount,
        pid: process.pid,
        uptime: process.uptime(),
      });
    });

    // Agent status
    app.get('/api/agents/status', (_req: Request, res: Response) => {
      if (!this.isReady) { res.status(503).json({ error: 'Worker not ready' }); return; }

      res.json(this.sessionManager.getStatus());
    });
  }

  private reapStaleSessions(): void {
    if (!this.isReady) return;

    const activeSessions = this.sessions.getActiveSessions();
    const staleThreshold = Date.now() / 1000 - (24 * 60 * 60); // 24 hours

    for (const session of activeSessions) {
      if (session.started_at_epoch < staleThreshold) {
        this.sessions.fail(session.content_session_id);
        console.log(`[code-recall] Reaped stale session: ${session.content_session_id}`);
      }
    }
  }

  private shutdown(): void {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    console.log('[code-recall] Shutting down worker...');

    if (this.staleReaperInterval) {
      clearInterval(this.staleReaperInterval);
    }

    this.sseBroadcaster.disconnectAll();

    if (this.db) {
      this.db.close();
    }

    ProcessManager.removePid();
  }
}

// CLI entry point
const command = process.argv[2];

if (command === 'start') {
  const worker = new WorkerService();
  worker.start().catch((err) => {
    console.error('[code-recall] Worker failed to start:', err);
    process.exit(0); // Exit 0 to prevent terminal tab accumulation
  });
} else if (command === 'hook') {
  // Hook command routing — delegates to CLI handlers
  const adapter = process.argv[3] as 'claude-code' | 'cursor' | 'raw';
  const action = process.argv[4] as 'context' | 'session-init' | 'observation' | 'summarize' | 'session-complete';

  import('../cli/hook-command.js').then(({ runHookCommand }) => {
    runHookCommand(adapter, action);
  }).catch((err) => {
    console.error('[code-recall] Hook command failed:', err);
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
    process.exit(0);
  });
}
