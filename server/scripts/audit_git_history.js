const { execSync } = require('child_process');

// 1. Audit committed database, env, dump, and archive files
const output = execSync('git log --all --name-only --pretty=format:"COMMIT:%H|%ad" --date=short', { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });

const lines = output.split('\n');
let currentCommit = null;
let currentDate = null;
const fileStats = {};

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  if (trimmed.startsWith('COMMIT:')) {
    const parts = trimmed.slice(7).split('|');
    currentCommit = parts[0];
    currentDate = parts[1];
  } else {
    const filePath = trimmed;
    if (/\.(db|sqlite|env|dump|tar|gz|zip)$/i.test(filePath) || filePath.includes('.env')) {
      if (!fileStats[filePath]) {
        fileStats[filePath] = { commits: [], firstCommit: null, lastCommit: null, firstDate: null, lastDate: null };
      }
      fileStats[filePath].commits.push(currentCommit);
      fileStats[filePath].firstCommit = currentCommit;
      fileStats[filePath].firstDate = currentDate;
      if (!fileStats[filePath].lastCommit) {
        fileStats[filePath].lastCommit = currentCommit;
        fileStats[filePath].lastDate = currentDate;
      }
    }
  }
}

console.log('=== COMMITTED SENSITIVE FILES IN FULL GIT HISTORY ===');
for (const [f, stat] of Object.entries(fileStats)) {
  let size = 'unknown';
  try {
    const sizeOut = execSync(`git cat-file -s ${stat.lastCommit}:${f}`, { encoding: 'utf8' }).trim();
    size = (parseInt(sizeOut, 10) / 1024).toFixed(2) + ' KB';
  } catch (e) {
    try {
      const sizeOut2 = execSync(`git cat-file -s ${stat.firstCommit}:${f}`, { encoding: 'utf8' }).trim();
      size = (parseInt(sizeOut2, 10) / 1024).toFixed(2) + ' KB';
    } catch (_) {}
  }
  console.log(JSON.stringify({
    file: f,
    commitCount: stat.commits.length,
    firstCommit: stat.firstCommit.slice(0, 7) + ' (' + stat.firstDate + ')',
    lastCommit: stat.lastCommit.slice(0, 7) + ' (' + stat.lastDate + ')',
    size
  }, null, 2));
}

// 2. Secret scan across git history (standard gitleaks / trufflehog rules: JWT, API Keys, Private Keys, Passwords)
console.log('\n=== GITLEAKS / TRUFFLEHOG EQUIVALENT SCAN OVER FULL HISTORY ===');
const rules = [
  { name: 'Private Key', regex: /-----BEGIN (RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY-----/ },
  { name: 'JWT Secret Hardcoded', regex: /JWT_SECRET\s*=\s*['"][a-zA-Z0-9_\-+=]{10,}['"]/ },
  { name: 'Hardcoded Database Password', regex: /postgres(ql)?:\/\/[^:]+:([^@]+)@/ },
  { name: 'Generic Password Assignment', regex: /(api_key|secret_key|private_key)\s*[:=]\s*['"][a-zA-Z0-9_\-+=]{12,}['"]/i }
];

const commitHashes = execSync('git rev-list --all', { encoding: 'utf8' }).trim().split('\n');
console.log(`Total Commits Scanned Across All Branches: ${commitHashes.length}`);

const findings = [];
for (const h of commitHashes) {
  try {
    const diff = execSync(`git show ${h} --stat -p`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    for (const rule of rules) {
      if (rule.regex.test(diff)) {
        findings.push({ commit: h.slice(0, 7), rule: rule.name });
      }
    }
  } catch (_) {}
}

console.log(`Rule Violations Found: ${findings.length}`);
const countsByRule = {};
for (const f of findings) {
  countsByRule[f.rule] = (countsByRule[f.rule] || 0) + 1;
}
console.log('Rule Counts:', countsByRule);

// 3. Commits to push from feature/postgres-final vs origin/main
console.log('\n=== COMMITS THAT WOULD BE PUSHED ===');
const pgFinalToPush = execSync('git log origin/main..feature/postgres-final --oneline', { encoding: 'utf8' }).trim().split('\n');
console.log(`feature/postgres-final (vs origin/main): ${pgFinalToPush.filter(Boolean).length} commits:`);
pgFinalToPush.forEach(c => console.log('  ' + c));

const secBatchToPush = execSync('git log origin/main..release/security-batch1 --oneline', { encoding: 'utf8' }).trim().split('\n');
console.log(`\nrelease/security-batch1 (vs origin/main): ${secBatchToPush.filter(Boolean).length} commits:`);
secBatchToPush.forEach(c => console.log('  ' + c));

