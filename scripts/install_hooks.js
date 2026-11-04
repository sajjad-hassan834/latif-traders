#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const hookDir = path.resolve(__dirname, '../.git/hooks');
const hookFile = path.join(hookDir, 'pre-push');

if (!fs.existsSync(hookDir)) {
  fs.mkdirSync(hookDir, { recursive: true });
}

const hookContent = `#!/bin/sh
node scripts/assert_branch.js || exit 1
node scripts/check_no_old_ui.js || exit 1
`;

fs.writeFileSync(hookFile, hookContent, { mode: 0o755 });
console.log('✅ pre-push hook installed successfully at .git/hooks/pre-push');
