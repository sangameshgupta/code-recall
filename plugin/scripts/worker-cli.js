#!/usr/bin/env node

/**
 * Worker daemon management CLI.
 * Handles start/stop/status commands for the worker service.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const DATA_DIR = join(homedir(), '.code-recall');
const PID_FILE = join(DATA_DIR, 'worker.pid');
const DEFAULT_PORT = 37888;

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getStatus() {
  if (!existsSync(PID_FILE)) return { running: false };

  const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim(), 10);
  if (isNaN(pid)) return { running: false };

  return { running: isRunning(pid), pid };
}

const command = process.argv[2];

switch (command) {
  case 'status': {
    const status = getStatus();
    console.log(JSON.stringify(status));
    break;
  }
  case 'stop': {
    const status = getStatus();
    if (status.running && status.pid) {
      process.kill(status.pid, 'SIGTERM');
      console.log(`Stopped worker (pid: ${status.pid})`);
    } else {
      console.log('Worker not running');
    }
    break;
  }
  default:
    console.log('Usage: worker-cli.js [status|stop]');
}
