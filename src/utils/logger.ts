type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, ...args: unknown[]): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [code-recall] [${level.toUpperCase()}]`;
  return `${prefix} ${args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')}`;
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (shouldLog('debug')) console.error(formatMessage('debug', ...args));
  },
  info: (...args: unknown[]) => {
    if (shouldLog('info')) console.error(formatMessage('info', ...args));
  },
  warn: (...args: unknown[]) => {
    if (shouldLog('warn')) console.error(formatMessage('warn', ...args));
  },
  error: (...args: unknown[]) => {
    if (shouldLog('error')) console.error(formatMessage('error', ...args));
  },
};
