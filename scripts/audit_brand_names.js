const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function runGrep(term) {
  try {
    const out = execSync(`git grep -n -i "${term}"`, { encoding: 'utf8' });
    return out.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

const terms = ['Shop OS', 'ShopOS', 'Latif Traders'];
console.log('========================================================================');
console.log('AUDIT: REMAINING BRAND NAME OCCURRENCES ACROSS CODEBASE');
console.log('========================================================================');

for (const term of terms) {
  const matches = runGrep(term);
  console.log(`\n--- Matches for "${term}" (${matches.length} found) ---`);
  
  const categorized = {
    userVisible: [],
    docsAndComments: [],
    testsAndFixtures: [],
    systemAndPaths: []
  };

  for (const m of matches) {
    const colonIdx = m.indexOf(':');
    const file = m.slice(0, colonIdx);
    const rest = m.slice(colonIdx + 1);

    if (file.includes('test') || file.includes('fixtures') || file.includes('rehearsal')) {
      categorized.testsAndFixtures.push(m);
    } else if (file.endsWith('.md') || rest.includes('//') || rest.includes('/*')) {
      categorized.docsAndComments.push(m);
    } else if (file.includes('package.json') || file.includes('database.js') || file.includes('.env')) {
      categorized.systemAndPaths.push(m);
    } else {
      categorized.userVisible.push(m);
    }
  }

  console.log(`  [User-Visible / UI]: ${categorized.userVisible.length}`);
  categorized.userVisible.forEach(line => console.log('    • ' + line));

  console.log(`  [System / Config / Config Keys]: ${categorized.systemAndPaths.length}`);
  categorized.systemAndPaths.slice(0, 5).forEach(line => console.log('    • ' + line));
  if (categorized.systemAndPaths.length > 5) console.log(`      ... and ${categorized.systemAndPaths.length - 5} more`);

  console.log(`  [Documentation / Comments]: ${categorized.docsAndComments.length}`);
  console.log(`  [Tests & Fixtures]: ${categorized.testsAndFixtures.length}`);
}

console.log('========================================================================\n');
