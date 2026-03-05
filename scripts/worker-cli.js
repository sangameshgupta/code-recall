#!/usr/bin/env node

/**
 * Worker daemon management CLI.
 * Written in CommonJS for maximum Node.js compatibility.
 */

const { existsSync, readFileSync } = require('fs');
const { join } = require('path');
const { homedir } = require('os');

const DATA_DIR = join(homedir(), '.code-recall');
const PID_FILE = join(DATA_DIR, 'worker.pid');

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
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
      console.log('Stopped worker (pid: ' + status.pid + ')');
    } else {
      console.log('Worker not running');
    }
    break;
  }
  default:
    console.log('Usage: worker-cli.js [status|stop]');
}
