#!/usr/bin/env node

/**
 * Bun runtime locator and executor.
 * Finds the Bun executable and runs the target script with it.
 * Written in CommonJS for maximum Node.js compatibility.
 */

const { execFileSync, execSync } = require('child_process');
const { existsSync } = require('fs');
const { join } = require('path');
const { homedir } = require('os');

const KNOWN_BUN_PATHS = [
  join(homedir(), '.bun', 'bin', 'bun'),
  '/usr/local/bin/bun',
  '/usr/bin/bun',
  '/opt/homebrew/bin/bun',
];

function findBun() {
  try {
    const bunPath = execSync('which bun', { encoding: 'utf-8', timeout: 5000 }).trim();
    if (bunPath && existsSync(bunPath)) return bunPath;
  } catch (e) { /* not in PATH */ }

  for (const p of KNOWN_BUN_PATHS) {
    if (existsSync(p)) return p;
  }

  const bunInstall = process.env.BUN_INSTALL;
  if (bunInstall) {
    const binPath = join(bunInstall, 'bin', 'bun');
    if (existsSync(binPath)) return binPath;
  }

  return null;
}

const bunPath = findBun();
if (!bunPath) {
  process.stderr.write('[code-recall] Bun not found. Install from https://bun.sh\n');
  process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }) + '\n');
  process.exit(0);
}

const args = process.argv.slice(2);

try {
  // Buffer stdin if available
  let stdinData = undefined;
  if (!process.stdin.isTTY) {
    try {
      stdinData = execSync('cat', {
        input: '',
        encoding: 'utf-8',
        timeout: 100,
        stdio: ['inherit', 'pipe', 'pipe'],
      });
    } catch (e) { /* no stdin data or timeout */ }
  }

  const result = execFileSync(bunPath, ['run', ...args], {
    cwd: process.cwd(),
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env,
    input: stdinData || undefined,
    timeout: 120000,
  });

  if (result) process.stdout.write(result);
} catch (err) {
  if (err.stderr) process.stderr.write(err.stderr);
  if (err.stdout) process.stdout.write(err.stdout);
  process.exit(0);
}
