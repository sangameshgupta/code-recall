import { STDIN_PARSE_DELAY_MS, STDIN_TIMEOUT_MS } from '../shared/hook-constants.js';

/**
 * Read JSON from stdin with timeout.
 * Claude Code doesn't close stdin after writing — we must buffer with timeout.
 * Uses self-delimiting JSON detection: once we have valid JSON, stop reading.
 */
export async function readStdin(): Promise<unknown | undefined> {
  return new Promise((resolve) => {
    let buffer = '';
    let parseTimer: ReturnType<typeof setTimeout> | null = null;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (parseTimer) clearTimeout(parseTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      process.stdin.removeAllListeners('data');
      process.stdin.removeAllListeners('end');
      process.stdin.removeAllListeners('error');
      try { process.stdin.pause(); } catch { /* ignore */ }
    };

    const tryParse = () => {
      try {
        const parsed = JSON.parse(buffer);
        cleanup();
        resolve(parsed);
      } catch {
        // Not valid JSON yet, keep reading
      }
    };

    // Absolute timeout — give up after STDIN_TIMEOUT_MS
    timeoutTimer = setTimeout(() => {
      cleanup();
      // Try one last parse
      if (buffer.trim()) {
        try {
          resolve(JSON.parse(buffer));
          return;
        } catch { /* fall through */ }
      }
      resolve(undefined);
    }, STDIN_TIMEOUT_MS);

    process.stdin.setEncoding('utf-8');
    process.stdin.resume();

    process.stdin.on('data', (chunk: string) => {
      buffer += chunk;

      // Debounced parse attempt — wait STDIN_PARSE_DELAY_MS after last chunk
      if (parseTimer) clearTimeout(parseTimer);
      parseTimer = setTimeout(tryParse, STDIN_PARSE_DELAY_MS);
    });

    process.stdin.on('end', () => {
      cleanup();
      if (buffer.trim()) {
        try {
          resolve(JSON.parse(buffer));
          return;
        } catch { /* fall through */ }
      }
      resolve(undefined);
    });

    process.stdin.on('error', () => {
      cleanup();
      resolve(undefined);
    });

    // If stdin has nothing within 500ms, resolve with undefined
    setTimeout(() => {
      if (!buffer.trim()) {
        cleanup();
        resolve(undefined);
      }
    }, 500);
  });
}
