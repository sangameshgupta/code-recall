import { readFileSync, existsSync } from 'fs';
import { PATHS } from './paths.js';

/**
 * Manages credential isolation.
 * Loads env vars from ~/.code-recall/.env
 * Blocks ANTHROPIC_API_KEY from being passed to subprocess env.
 */
export class EnvManager {
  private envVars: Record<string, string> = {};

  constructor() {
    this.loadEnvFile();
  }

  private loadEnvFile(): void {
    if (!existsSync(PATHS.envFile)) return;

    try {
      const content = readFileSync(PATHS.envFile, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;

        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();

        // Strip quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        this.envVars[key] = value;
      }
    } catch {
      // Ignore errors reading .env
    }
  }

  /**
   * Build isolated environment for observer subprocess.
   * Includes env file vars but BLOCKS sensitive keys from parent process.
   */
  getIsolatedEnv(): Record<string, string> {
    const env: Record<string, string> = {};

    // Start with minimal parent env (PATH, HOME, etc.)
    const safeKeys = ['PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'LANG', 'LC_ALL', 'TMPDIR'];
    for (const key of safeKeys) {
      if (process.env[key]) {
        env[key] = process.env[key]!;
      }
    }

    // Add env file vars (may include provider API keys)
    Object.assign(env, this.envVars);

    // CRITICAL: Never pass ANTHROPIC_API_KEY to observer subprocess
    delete env['ANTHROPIC_API_KEY'];

    return env;
  }

  get(key: string): string | undefined {
    return this.envVars[key] ?? process.env[key];
  }
}
