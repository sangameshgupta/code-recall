#!/usr/bin/env node

/**
 * Bun runtime locator and executor.
 * Finds the Bun executable and runs the target script with it.
 * Buffers stdin for Bun compatibility on Linux.
 */

import { execFileSync, execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const KNOWN_BUN_PATHS = [
  join(homedir(), '.bun', 'bin', 'bun'),
  '/usr/local/bin/bun',
  '/usr/bin/bun',
  '/opt/homebrew/bin/bun',
];

function findBun() {
  // Check PATH first
  try {
    const bunPath = execSync('which bun', { encoding: 'utf-8', timeout: 5000 }).trim();
    if (bunPath && existsSync(bunPath)) return bunPath;
  } catch { /* not in PATH */ }

  // Check known locations
  for (const p of KNOWN_BUN_PATHS) {
    if (existsSync(p)) return p;
  }

  // Check BUN_INSTALL env var
  const bunInstall = process.env.BUN_INSTALL;
  if (bunInstall) {
    const binPath = join(bunInstall, 'bin', 'bun');
    if (existsSync(binPath)) return binPath;
  }

  return null;
}

const bunPath = findBun();
if (!bunPath) {
  console.error('[code-recall] Bun not found. Install from https://bun.sh');
  // Output standard hook response so Claude Code continues
  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  process.exit(0);
}

// Forward to Bun with remaining args
const args = process.argv.slice(2);

try {
  // Buffer stdin for Bun compatibility (Linux stdin handling differs)
  const chunks = [];
  if (!process.stdin.isTTY) {
    try {
      process.stdin.setEncoding('utf-8');
      // Sync read with short timeout
      const data = execSync('cat', {
        input: '',
        encoding: 'utf-8',
        timeout: 100,
        stdio: ['inherit', 'pipe', 'pipe'],
      });
      if (data) chunks.push(data);
    } catch { /* no stdin data or timeout — that's fine */ }
  }

  const result = execFileSync(bunPath, ['run', ...args], {
    cwd: process.cwd(),
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env,
    input: chunks.join('') || undefined,
    timeout: 120000, // 2 minute timeout
  });

  if (result) process.stdout.write(result);
} catch (err) {
  // Forward stderr but don't block Claude Code
  if (err.stderr) process.stderr.write(err.stderr);
  if (err.stdout) process.stdout.write(err.stdout);
  process.exit(0); // Always exit 0
}
