#!/usr/bin/env node
/**
 * Branch Assertion Guard
 * Ensures work happens strictly on main, integration/local-all or its children,
 * and verifies that commit 6f72dc8 (production base) is in the commit ancestry.
 */

const { execSync } = require('child_process');

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

const envBranch = process.env.RAILWAY_GIT_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || process.env.GITHUB_REF_NAME;
const currentBranch = envBranch || run('git rev-parse --abbrev-ref HEAD') || 'HEAD';

// If in Railway/Vercel/CI environment without full git tree:
if (process.env.RAILWAY_ENVIRONMENT || process.env.VERCEL || process.env.CI || process.env.RAILWAY_SERVICE_ID) {
  console.log(`[assert_branch] OK: Cloud / CI environment detected (${envBranch || currentBranch || 'HEAD'}).`);
  process.exit(0);
}

if (!currentBranch) {
  console.error('[assert_branch] Failed to determine current git branch.');
  process.exit(1);
}

// Check 1: 6f72dc8 must be an ancestor of HEAD
const hasAncestor = run('git merge-base --is-ancestor 6f72dc8 HEAD');
if (hasAncestor === null) {
  console.error('[assert_branch] ERROR: Commit 6f72dc8 is NOT an ancestor of current HEAD.');
  console.error('All work must descend from the verified production base 6f72dc8.');
  process.exit(1);
}

// Check 2: Branch must be main, integration/local-all or a descendant
if (currentBranch === 'main' || currentBranch === 'integration/local-all' || currentBranch.startsWith('release/')) {
  console.log(`[assert_branch] OK: Running on trunk '${currentBranch}'.`);
  process.exit(0);
}

// If on a different branch, ensure integration/local-all is an ancestor
const isChildOfTrunk = run('git merge-base --is-ancestor integration/local-all HEAD');
if (isChildOfTrunk === null) {
  console.error(`[assert_branch] ERROR: Branch '${currentBranch}' is NOT 'integration/local-all' nor a child of it.`);
  console.error('Trunk is integration/local-all. All branches must be created from integration/local-all.');
  process.exit(1);
}

console.log(`[assert_branch] OK: Running on '${currentBranch}' (child of trunk).`);
process.exit(0);
