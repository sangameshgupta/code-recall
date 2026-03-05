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
