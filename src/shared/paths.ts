import { join } from 'path';
import { homedir } from 'os';

const DATA_DIR_NAME = '.code-recall';

export const PATHS = {
  /** Root data directory: ~/.code-recall/ */
  dataDir: join(homedir(), DATA_DIR_NAME),

  /** SQLite database */
  database: join(homedir(), DATA_DIR_NAME, 'code-recall.db'),

  /** Worker PID file */
  pidFile: join(homedir(), DATA_DIR_NAME, 'worker.pid'),

  /** Settings file */
  settings: join(homedir(), DATA_DIR_NAME, 'settings.json'),

  /** Environment/credentials file */
  envFile: join(homedir(), DATA_DIR_NAME, '.env'),

  /** Auth token for worker API */
  authToken: join(homedir(), DATA_DIR_NAME, 'auth.token'),

  /** Observer agent sessions directory (isolated from user's session list) */
  observerSessionsDir: join(homedir(), DATA_DIR_NAME, 'observer-sessions'),

  /** Log files */
  logDir: join(homedir(), DATA_DIR_NAME, 'logs'),
  workerLog: join(homedir(), DATA_DIR_NAME, 'logs', 'worker.log'),
} as const;

/** Default worker port */
export const DEFAULT_WORKER_PORT = 37888;

/** Worker host (localhost only) */
export const WORKER_HOST = '127.0.0.1';
