import { readFileSync, writeFileSync, unlinkSync, existsSync, statSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { PATHS } from '../../shared/paths.js';

const PID_MTIME_GUARD_MS = 5000; // 5 seconds — prevent restart cascades

export class ProcessManager {
  /**
   * Write PID file with current process ID
   */
  static writePid(pidPath: string = PATHS.pidFile): void {
    const dir = dirname(pidPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(pidPath, String(process.pid), 'utf-8');
  }

  /**
   * Remove PID file on shutdown
   */
  static removePid(pidPath: string = PATHS.pidFile): void {
    try {
      if (existsSync(pidPath)) {
        unlinkSync(pidPath);
      }
    } catch {
      // Ignore errors on cleanup
    }
  }

  /**
   * Read PID from file. Returns null if file doesn't exist or is stale.
   */
  static readPid(pidPath: string = PATHS.pidFile): number | null {
    if (!existsSync(pidPath)) return null;

    try {
      const pid = parseInt(readFileSync(pidPath, 'utf-8').trim(), 10);
      if (isNaN(pid)) return null;
      return pid;
    } catch {
      return null;
    }
  }

  /**
   * Check if a process is running by PID
   */
  static isProcessRunning(pid: number): boolean {
    try {
      process.kill(pid, 0); // Signal 0 = test if process exists
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if worker is already running.
   * Uses mtime guard to prevent restart cascades.
   */
  static isWorkerRunning(pidPath: string = PATHS.pidFile): boolean {
    const pid = this.readPid(pidPath);
    if (pid === null) return false;

    // Check mtime guard — if PID file was written very recently, assume starting
    try {
      const stat = statSync(pidPath);
      const age = Date.now() - stat.mtimeMs;
      if (age < PID_MTIME_GUARD_MS) {
        return true; // Recently written, assume starting up
      }
    } catch {
      return false;
    }

    return this.isProcessRunning(pid);
  }

  /**
   * Kill the worker process if running
   */
  static killWorker(pidPath: string = PATHS.pidFile): boolean {
    const pid = this.readPid(pidPath);
    if (pid === null) return false;

    try {
      process.kill(pid, 'SIGTERM');
      this.removePid(pidPath);
      return true;
    } catch {
      this.removePid(pidPath); // Clean up stale PID file
      return false;
    }
  }

  /**
   * Register signal handlers for graceful shutdown
   */
  static registerShutdownHandlers(cleanup: () => void): void {
    const handler = () => {
      cleanup();
      process.exit(0);
    };

    process.on('SIGINT', handler);
    process.on('SIGTERM', handler);
    process.on('uncaughtException', (err) => {
      console.error('[code-recall] Uncaught exception:', err);
      cleanup();
      process.exit(1);
    });
  }
}
