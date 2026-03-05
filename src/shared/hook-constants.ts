/** Hook timeout values in seconds */
export const HOOK_TIMEOUTS = {
  setup: 300,
  smartInstall: 300,
  workerStart: 60,
  context: 60,
  sessionInit: 60,
  observation: 120,
  summarize: 120,
  sessionComplete: 30,
} as const;

/** Standard hook response — always continue, suppress output */
export const STANDARD_HOOK_RESPONSE = JSON.stringify({
  continue: true,
  suppressOutput: true,
});

/** Stdin reader config */
export const STDIN_PARSE_DELAY_MS = 50;
export const STDIN_TIMEOUT_MS = 30_000;
