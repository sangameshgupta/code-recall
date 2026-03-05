#!/usr/bin/env node

/**
 * Build script — produces CJS bundles for plugin distribution.
 *
 * Outputs:
 * - plugin/scripts/worker-service.cjs  — Worker daemon
 * - plugin/scripts/mcp-server.cjs      — MCP search server
 */

import { build } from 'esbuild';
import { mkdirSync } from 'fs';

const COMMON_OPTIONS = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  sourcemap: false,
  minify: false,
  // External packages that should not be bundled
  external: [
    '@anthropic-ai/claude-agent-sdk',
    '@modelcontextprotocol/sdk',
    'express',
    'better-sqlite3',
    'bun:sqlite',
  ],
};

async function main() {
  // Ensure output directories exist
  mkdirSync('plugin/scripts', { recursive: true });

  console.log('[build] Building worker-service.cjs...');
  await build({
    ...COMMON_OPTIONS,
    entryPoints: ['src/services/worker-service.ts'],
    outfile: 'plugin/scripts/worker-service.cjs',
    define: {
      '__DEFAULT_PACKAGE_VERSION__': '"1.0.0"',
    },
  });

  console.log('[build] Building mcp-server.cjs...');
  await build({
    ...COMMON_OPTIONS,
    entryPoints: ['src/servers/mcp-server.ts'],
    outfile: 'plugin/scripts/mcp-server.cjs',
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
