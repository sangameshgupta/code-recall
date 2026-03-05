#!/usr/bin/env node

/**
 * Build script — produces CJS bundles for plugin distribution.
 *
 * Outputs:
 * - scripts/worker-service.cjs  — Worker daemon
 * - scripts/mcp-server.cjs      — MCP search server
 */

import { build } from 'esbuild';

const COMMON_OPTIONS = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  sourcemap: false,
  minify: false,
  external: [
    '@anthropic-ai/claude-agent-sdk',
    '@modelcontextprotocol/sdk',
    'express',
    'better-sqlite3',
    'bun:sqlite',
  ],
};

async function main() {
  console.log('[build] Building worker-service.cjs...');
  await build({
    ...COMMON_OPTIONS,
    entryPoints: ['src/services/worker-service.ts'],
    outfile: 'scripts/worker-service.cjs',
    define: {
      '__DEFAULT_PACKAGE_VERSION__': '"1.0.0"',
    },
  });

  console.log('[build] Building mcp-server.cjs...');
  await build({
    ...COMMON_OPTIONS,
    entryPoints: ['src/servers/mcp-server.ts'],
    outfile: 'scripts/mcp-server.cjs',
    define: {
      '__DEFAULT_PACKAGE_VERSION__': '"1.0.0"',
    },
  });

  console.log('[build] Done.');
}

main().catch((err) => {
  console.error('[build] Build failed:', err);
  process.exit(1);
});
