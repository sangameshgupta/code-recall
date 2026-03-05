import { EventEmitter } from 'events';
import type { PendingMessage } from '../../types/database.js';

const DEFAULT_IDLE_TIMEOUT_MS = 180_000; // 3 minutes

/**
 * Async iterator that yields pending messages from the queue.
 * Uses EventEmitter-based waking (not polling).
 * Aborts after idle timeout if no new messages arrive.
 */
export class SessionQueueProcessor implements AsyncIterable<PendingMessage> {
  private emitter = new EventEmitter();
  private contentSessionId: string;
  private claimFn: (contentSessionId: string) => PendingMessage | null;
  private idleTimeoutMs: number;
  private abortController: AbortController;
  private _done = false;

  constructor(opts: {
    contentSessionId: string;
    claimFn: (contentSessionId: string) => PendingMessage | null;
    idleTimeoutMs?: number;
    abortController?: AbortController;
  }) {
    this.contentSessionId = opts.contentSessionId;
    this.claimFn = opts.claimFn;
    this.idleTimeoutMs = opts.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
    this.abortController = opts.abortController ?? new AbortController();
  }

  /**
   * Signal that a new message is available.
   * Called by the worker when a new pending_message is enqueued.
   */
  wake(): void {
    this.emitter.emit('wake');
  }

  /**
   * Signal that processing should stop (e.g., session complete or summary requested).
   */
  finish(): void {
    this._done = true;
    this.emitter.emit('wake');
  }

  get done(): boolean {
    return this._done;
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<PendingMessage> {
    while (!this._done && !this.abortController.signal.aborted) {
      // Try to claim a message
      const message = this.claimFn(this.contentSessionId);

      if (message) {
        yield message;
        continue; // Immediately try to claim another
      }

      // No message available — wait for wake signal or timeout
      const woken = await this.waitForWake();
      if (!woken) {
        // Idle timeout reached — no new messages for idleTimeoutMs
        break;
      }
    }
  }

  private waitForWake(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      if (this._done || this.abortController.signal.aborted) {
        resolve(false);
        return;
      }

      let idleTimer: ReturnType<typeof setTimeout> | null = null;
      let abortHandler: (() => void) | null = null;
      let wakeHandler: (() => void) | null = null;

      const cleanup = () => {
        if (idleTimer) clearTimeout(idleTimer);
        if (wakeHandler) this.emitter.removeListener('wake', wakeHandler);
        if (abortHandler) this.abortController.signal.removeEventListener('abort', abortHandler);
      };

      wakeHandler = () => {
        cleanup();
        resolve(true);
      };

      abortHandler = () => {
        cleanup();
        resolve(false);
      };

      // Idle timeout
      idleTimer = setTimeout(() => {
        cleanup();
        resolve(false);
      }, this.idleTimeoutMs);

      this.emitter.once('wake', wakeHandler);
      this.abortController.signal.addEventListener('abort', abortHandler, { once: true });
    });
  }
}
