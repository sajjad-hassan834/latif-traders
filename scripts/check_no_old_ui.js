#!/usr/bin/env node
/**
 * Guard against legacy UI elements, dead components, and obsolete branding.
 * Fails if forbidden legacy files, strings, or CDNs are reintroduced.
 */

const fs = require('fs');
const path = require('path');

const FORBIDDEN_FILES = [
  'client/src/components/common/LtLogo.jsx',
  'client/src/assets/logo.png',
  'client/src/assets/hero.png',
  'client/src/assets/react.svg',
  'client/src/assets/vite.svg'
];

const FORBIDDEN_STRINGS = [
  { pattern: /SAAS ERP/i, name: '"SAAS ERP" badge text' },
  { pattern: /LtLogo/i, name: 'Old LtLogo component' },
  { pattern: /fonts\.googleapis\.com/i, name: 'External Google Fonts CDN in client' },
  { pattern: /#0266FE/i, name: 'Legacy blue #0266FE color' },
  { pattern: /cyclingIndex/i, name: 'Legacy rotating pill state' },
  {
    pattern: /latif/i,
    name: 'Hardcoded legacy shop name "latif"',
    customCheck: (content, relPath) => {
      let codeOnly = content;
      if (relPath.replace(/\\/g, '/').includes('client/src/utils/api.js') || relPath.replace(/\\/g, '/').includes('client/src/constants/tenant.js')) {
        codeOnly = codeOnly.replace(/https:\/\/latif-traders-production\.up\.railway\.app/g, '').replace(/latif_001/g, '');
      }
      // Strip comments: /* ... */ and // ...
      codeOnly = codeOnly.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
      return /latif/i.test(codeOnly);
    }
  }
];

let errors = 0;

console.log('[check_no_old_ui] Auditing codebase for legacy UI remnants...');

// 1. Check forbidden files
for (const relPath of FORBIDDEN_FILES) {
  const fullPath = path.resolve(__dirname, '..', relPath);
  if (fs.existsSync(fullPath)) {
    console.error(`❌ FORBIDDEN FILE FOUND: ${relPath}`);
    errors++;
  }
}

// 2. Scan client files recursively (client/src and client/index.html)
function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
        scanDir(fullPath);
      }
    } else if (entry.isFile() && /\.(jsx?|tsx?|css|html|json)$/i.test(entry.name)) {
      // Don't scan test fixtures or package.json
      if (entry.name === 'package.json' || entry.name === 'package-lock.json') continue;
      const content = fs.readFileSync(fullPath, 'utf8');
      const relPath = path.relative(path.resolve(__dirname, '..'), fullPath);

      for (const rule of FORBIDDEN_STRINGS) {
        const hasViolation = rule.customCheck
          ? rule.customCheck(content, relPath)
          : rule.pattern.test(content);
        if (hasViolation) {
          console.error(`❌ FORBIDDEN PATTERN DETECTED in ${relPath}: ${rule.name}`);
          errors++;
        }
      }
    }
  }
}

scanDir(path.resolve(__dirname, '../client/src'));
const clientHtml = path.resolve(__dirname, '../client/index.html');
if (fs.existsSync(clientHtml)) {
  const content = fs.readFileSync(clientHtml, 'utf8');
  for (const rule of FORBIDDEN_STRINGS) {
    if (rule.pattern.test(content)) {
      console.error(`❌ FORBIDDEN PATTERN DETECTED in client/index.html: ${rule.name}`);
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`\n[check_no_old_ui] FAILED: ${errors} legacy UI violation(s) found.`);
  process.exit(1);
} else {
  console.log('[check_no_old_ui] PASS: Zero legacy UI artifacts detected.');
  process.exit(0);
}
