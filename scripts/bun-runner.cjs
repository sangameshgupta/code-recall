#!/usr/bin/env node

/**
 * Bun Runner — finds and executes Bun even when not in PATH.
 * Buffers stdin from Claude Code hooks before passing to Bun.
 * Written in CommonJS for Node.js compatibility.
 *
 * Usage: node bun-runner.cjs <script> [args...]
 */

const { spawn, spawnSync } = require('child_process');
const { existsSync } = require('fs');
const { join, dirname, resolve } = require('path');
const { homedir } = require('os');

// Self-resolve plugin root when CLAUDE_PLUGIN_ROOT is not set.
// Known Claude Code bug: Stop hooks don't receive CLAUDE_PLUGIN_ROOT,
// causing paths to resolve to "/scripts/..." which doesn't exist.
const RESOLVED_PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || resolve(__dirname, '..');

/**
 * Fix script paths broken by empty CLAUDE_PLUGIN_ROOT.
 * "${CLAUDE_PLUGIN_ROOT}/scripts/foo.cjs" becomes "/scripts/foo.cjs" when env is empty.
 */
function fixBrokenScriptPath(argPath) {
  if (argPath.startsWith('/scripts/') && !existsSync(argPath)) {
    const fixedPath = join(RESOLVED_PLUGIN_ROOT, argPath);
    if (existsSync(fixedPath)) return fixedPath;
  }
  return argPath;
}

function findBun() {
  // Try PATH first
  const pathCheck = spawnSync('which', ['bun'], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (pathCheck.status === 0 && pathCheck.stdout.trim()) return 'bun';

  // Check common install locations
  const bunPaths = [
    join(homedir(), '.bun', 'bin', 'bun'),
    '/usr/local/bin/bun',
    '/usr/bin/bun',
    '/opt/homebrew/bin/bun',
    '/home/linuxbrew/.linuxbrew/bin/bun',
  ];
  for (const p of bunPaths) {
    if (existsSync(p)) return p;
  }

  // BUN_INSTALL env var
  const bunInstall = process.env.BUN_INSTALL;
  if (bunInstall) {
    const binPath = join(bunInstall, 'bin', 'bun');
    if (existsSync(binPath)) return binPath;
  }

  return null;
}

/**
 * Collect stdin data with timeout.
 * Claude Code pipes hook event JSON via stdin but doesn't close it immediately.
 */
function collectStdin() {
  return new Promise(function(resolve) {
    if (process.stdin.isTTY) {
      resolve(null);
      return;
    }

    const chunks = [];
    process.stdin.on('data', function(chunk) { chunks.push(chunk); });
    process.stdin.on('end', function() {
      resolve(chunks.length > 0 ? Buffer.concat(chunks) : null);
    });
    process.stdin.on('error', function() {
      resolve(null);
    });

    // Safety: if no data arrives within 5s, proceed without stdin
    setTimeout(function() {
      process.stdin.removeAllListeners();
      process.stdin.pause();
      resolve(chunks.length > 0 ? Buffer.concat(chunks) : null);
    }, 5000);
  });
}

// --- Main ---

const args = process.argv.slice(2);
if (args.length === 0) {
  process.stderr.write('Usage: node bun-runner.cjs <script> [args...]\n');
  process.exit(1);
}

// Fix broken paths from empty CLAUDE_PLUGIN_ROOT
args[0] = fixBrokenScriptPath(args[0]);

const bunPath = findBun();
if (!bunPath) {
  process.stderr.write('[code-recall] Bun not found. Install from https://bun.sh\n');
  process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }) + '\n');
  process.exit(0);
}

collectStdin().then(function(stdinData) {
  // Spawn bun with cwd set to plugin root so it can find node_modules
  const child = spawn(bunPath, args, {
    stdio: [stdinData ? 'pipe' : 'ignore', 'inherit', 'inherit'],
    cwd: RESOLVED_PLUGIN_ROOT,
    env: process.env,
  });

  // Write buffered stdin to child, then close so it sees EOF
  if (stdinData && child.stdin) {
    child.stdin.write(stdinData);
    child.stdin.end();
  }

  child.on('error', function(err) {
    process.stderr.write('[code-recall] Failed to start Bun: ' + err.message + '\n');
    process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }) + '\n');
    process.exit(0);
  });

  child.on('close', function(code) {
    process.exit(code || 0);
  });
});
