#!/usr/bin/env node

/**
 * Smart dependency installer.
 * Checks if node_modules are present, installs if missing.
 * Written in CommonJS for maximum Node.js compatibility.
 */

const { existsSync } = require('fs');
const { execSync } = require('child_process');
const { join } = require('path');

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT
  || join(process.env.HOME || '', '.claude', 'plugins', 'marketplaces', 'code-recall-marketplace');

function main() {
  const nodeModules = join(PLUGIN_ROOT, 'node_modules');
  if (existsSync(nodeModules)) {
    outputResponse();
    return;
  }

  // Try bun first, then npm
  try {
    execSync('bun install --frozen-lockfile', {
      cwd: PLUGIN_ROOT,
      encoding: 'utf-8',
      timeout: 120000,
      stdio: 'pipe',
    });
  } catch (e) {
    try {
      execSync('npm install --production', {
        cwd: PLUGIN_ROOT,
        encoding: 'utf-8',
        timeout: 120000,
        stdio: 'pipe',
      });
    } catch (err) {
      process.stderr.write('[code-recall] Failed to install dependencies: ' + err.message + '\n');
    }
  }

  outputResponse();
}

function outputResponse() {
  process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }) + '\n');
}

main();
