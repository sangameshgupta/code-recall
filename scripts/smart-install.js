#!/usr/bin/env node

/**
 * Smart dependency installer.
 * Checks if Bun and node_modules are present, installs if missing.
 */

import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT
  || join(process.env.HOME || '', '.claude', 'plugins', 'marketplaces', 'code-recall', 'plugin');

function main() {
  // Check if node_modules exists in plugin root
  const nodeModules = join(PLUGIN_ROOT, 'node_modules');
  if (existsSync(nodeModules)) {
    // Dependencies already installed
    outputResponse();
    return;
  }

  // Try to install with bun
  try {
    execSync('bun install --frozen-lockfile', {
      cwd: PLUGIN_ROOT,
      encoding: 'utf-8',
      timeout: 120000,
      stdio: 'pipe',
    });
  } catch {
    // Try npm as fallback
    try {
      execSync('npm install --production', {
        cwd: PLUGIN_ROOT,
        encoding: 'utf-8',
        timeout: 120000,
        stdio: 'pipe',
      });
    } catch (err) {
      console.error('[code-recall] Failed to install dependencies:', err.message);
    }
  }

  outputResponse();
}

function outputResponse() {
  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
}

main();
