#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'unknown';
  }
}

const shortHash = run('git rev-parse --short HEAD');
const branch = run('git rev-parse --abbrev-ref HEAD');
const buildTime = new Date().toISOString();

const versionData = {
  shortHash,
  branch,
  buildTime
};

const clientPublicDir = path.resolve(__dirname, '../client/public');
if (!fs.existsSync(clientPublicDir)) {
  fs.mkdirSync(clientPublicDir, { recursive: true });
}

fs.writeFileSync(
  path.join(clientPublicDir, 'version.json'),
  JSON.stringify(versionData, null, 2) + '\n'
);

console.log(`[generate_version] version.json written: ${shortHash} (${branch}) at ${buildTime}`);
