import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { PATHS, DEFAULT_WORKER_PORT } from './paths.js';

export interface CodeRecallSettings {
  CODE_RECALL_WORKER_PORT: string;
  CODE_RECALL_PROVIDER: string;
  CODE_RECALL_OBSERVER_MODEL: string;
  CODE_RECALL_MAX_CONCURRENT_AGENTS: string;
  CODE_RECALL_CONTEXT_OBSERVATIONS: string;
  CODE_RECALL_CONTEXT_TOKEN_BUDGET: string;
  CODE_RECALL_QUEUE_IDLE_TIMEOUT_MS: string;
  CODE_RECALL_CHROMA_ENABLED: string;
  CODE_RECALL_FTS5_ENABLED: string;
  CODE_RECALL_PRIVACY_STRIP_TAGS: string;
  CODE_RECALL_LOG_LEVEL: string;
  [key: string]: string;
}

const DEFAULTS: CodeRecallSettings = {
  CODE_RECALL_WORKER_PORT: String(DEFAULT_WORKER_PORT),
  CODE_RECALL_PROVIDER: 'claude',
  CODE_RECALL_OBSERVER_MODEL: 'claude-sonnet-4-5',
  CODE_RECALL_MAX_CONCURRENT_AGENTS: '2',
  CODE_RECALL_CONTEXT_OBSERVATIONS: '50',
  CODE_RECALL_CONTEXT_TOKEN_BUDGET: '8000',
  CODE_RECALL_QUEUE_IDLE_TIMEOUT_MS: '180000', // 3 minutes
  CODE_RECALL_CHROMA_ENABLED: 'true',
  CODE_RECALL_FTS5_ENABLED: 'true',
  CODE_RECALL_PRIVACY_STRIP_TAGS: 'true',
  CODE_RECALL_LOG_LEVEL: 'info',
};

export class SettingsDefaultsManager {
  private settings: CodeRecallSettings;

  constructor() {
    this.settings = { ...DEFAULTS };
  }

  /**
   * Load settings with precedence: env vars > settings.json > defaults
   */
  static loadFromFile(path: string = PATHS.settings): CodeRecallSettings {
    const manager = new SettingsDefaultsManager();

    // Layer 1: Load from file if it exists
    if (existsSync(path)) {
      try {
        const raw = readFileSync(path, 'utf-8');
        const fileSettings = JSON.parse(raw);
        Object.assign(manager.settings, fileSettings);
      } catch {
        // Ignore malformed settings file
      }
    }

    // Layer 2: Override with env vars
    for (const key of Object.keys(DEFAULTS)) {
      const envVal = process.env[key];
      if (envVal !== undefined) {
        manager.settings[key] = envVal;
      }
    }

    return manager.settings;
  }

  /**
   * Create default settings file if it doesn't exist
   */
  static ensureSettingsFile(path: string = PATHS.settings): void {
    if (existsSync(path)) return;

    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(path, JSON.stringify(DEFAULTS, null, 2) + '\n', 'utf-8');
  }

  static get defaults(): CodeRecallSettings {
    return { ...DEFAULTS };
  }
}
