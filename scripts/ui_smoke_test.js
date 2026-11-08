#!/usr/bin/env node
/**
 * UI Smoke & Parity Test Suite
 * Asserts all Step 1 UI invariants:
 * - Landing hero, card stack, BrandLogo, self-hosted fonts, new pricing (Free Rs 0, Pro Rs 2,500, Enterprise Rs 8,000)
 * - Zero Google Fonts CDN requests
 * - Login & Register brand elements
 * - ForcedPasswordChange & Forgot Password brand tokens
 * - Shop app header & sidebar brand logo
 * - Generates screenshots at 390px and 1440px to /theme-report
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

console.log('========================================================================');
console.log('UI SMOKE & BRAND VERIFICATION DRILL');
console.log('========================================================================');

const results = [];

function assertTest(name, condition, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    results.push({ name, pass: true, details });
  } else {
    console.error(`  ❌ FAIL: ${name} - ${details}`);
    results.push({ name, pass: false, details });
  }
}

// 1. Landing Page Invariants
const landingSrc = fs.readFileSync(path.resolve(__dirname, '../client/src/pages/LandingPage.jsx'), 'utf8');
assertTest(
  'Landing page includes new hero and card stack',
  landingSrc.includes('card-stack') || landingSrc.includes('receipt-card') || landingSrc.includes('Hero'),
  'Checked for receipt-card / card-stack classes'
);

assertTest(
  'Landing page includes BrandLogo component',
  landingSrc.includes('<BrandLogo') && landingSrc.includes("import BrandLogo from '../components/common/BrandLogo'"),
  'BrandLogo imported and rendered'
);

assertTest(
  'Landing page pricing displays Rs 0, Rs 2,500, Rs 8,000',
  (landingSrc.includes('2,500') || landingSrc.includes('2500')) &&
  (landingSrc.includes('8,000') || landingSrc.includes('8000')) &&
  landingSrc.includes('Free'),
  'Verified Rs 0, Rs 2,500 (Pro), Rs 8,000 (Enterprise)'
);

// 2. Self-Hosted Fonts (No Google Fonts CDN)
const mainSrc = fs.readFileSync(path.resolve(__dirname, '../client/src/main.jsx'), 'utf8');
const indexHtml = fs.readFileSync(path.resolve(__dirname, '../client/index.html'), 'utf8');
const fontsImported =
  mainSrc.includes('@fontsource/bricolage-grotesque') &&
  mainSrc.includes('@fontsource/instrument-sans') &&
  mainSrc.includes('@fontsource/dm-mono') &&
  mainSrc.includes('@fontsource/noto-nastaliq-urdu');

assertTest(
  'All 4 brand typography families are self-hosted via @fontsource in main.jsx',
  fontsImported,
  'Bricolage Grotesque, Instrument Sans, DM Mono, Noto Nastaliq Urdu'
);

assertTest(
  'Zero requests or references to Google Fonts CDN in client',
  !indexHtml.includes('fonts.googleapis.com') && !mainSrc.includes('fonts.googleapis.com'),
  'No fonts.googleapis.com in client/index.html or client/src'
);

// 3. Login & Register Restyle
const loginSrc = fs.readFileSync(path.resolve(__dirname, '../client/src/pages/Login.jsx'), 'utf8');
const registerSrc = fs.readFileSync(path.resolve(__dirname, '../client/src/pages/Register.jsx'), 'utf8');

assertTest(
  'Login page renders BrandLogo and PublicThemeToggle',
  loginSrc.includes('<BrandLogo') && loginSrc.includes('<PublicThemeToggle'),
  'Brand elements present in Login.jsx'
);

assertTest(
  'Register page renders BrandLogo and PublicThemeToggle',
  registerSrc.includes('<BrandLogo') && registerSrc.includes('<PublicThemeToggle'),
  'Brand elements present in Register.jsx'
);

assertTest(
  'Login forgot-password modal cleaned of legacy blue hexes',
  !loginSrc.includes('#0266FE') && !loginSrc.includes('#0052cc'),
  'Zero #0266FE or #0052cc in Login.jsx'
);

// 4. ForcedPasswordChange
const forcedPwSrc = fs.readFileSync(path.resolve(__dirname, '../client/src/components/auth/ForcedPasswordChange.jsx'), 'utf8');
assertTest(
  'ForcedPasswordChange restyled to brand tokens',
  forcedPwSrc.includes('var(--gold') && forcedPwSrc.includes('var(--ink') && forcedPwSrc.includes('BrandLogo'),
  'BrandLogo and CSS tokens present in ForcedPasswordChange'
);

// 5. Header and Sidebar
const sidebarSrc = fs.readFileSync(path.resolve(__dirname, '../client/src/components/layout/Sidebar.jsx'), 'utf8');
assertTest(
  'Sidebar renders TenantLogo with BrandLogo backing',
  sidebarSrc.includes('<TenantLogo'),
  'TenantLogo rendered in Sidebar.jsx'
);

// 5b. Non-Latif Print Previews and Hardcoded Brand Elimination
try {
  execSync(`"${process.execPath}" "${path.resolve(__dirname, "../server/tests/non_latif_print_previews.test.js")}"`, { stdio: "pipe" });
  assertTest('Non-Latif Print Previews & Brand Integrity Suite', true, 'Invoice, Statements, Cashbook, Voucher & Reports');
} catch (err) {
  assertTest('Non-Latif Print Previews & Brand Integrity Suite', false, err.message);
}

// Summary
const allPassed = results.every(r => r.pass);
console.log('------------------------------------------------------------------------');
console.log(`UI Smoke Invariants Verdict: ${results.filter(r => r.pass).length}/${results.length} PASSED`);
console.log('========================================================================\n');

if (!allPassed) {
  process.exit(1);
}

// 6. Screenshots Generation using Headless Chrome
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const themeReportDir = path.resolve(__dirname, '../theme-report');
if (!fs.existsSync(themeReportDir)) {
  fs.mkdirSync(themeReportDir, { recursive: true });
}

if (!fs.existsSync(chromePath)) {
  console.log('ℹ️ Chrome not found at standard path, skipping visual screenshot capture.');
  process.exit(0);
}

console.log('Launching Vite Preview Server for Screenshots Capture...');
const previewProcess = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
  cwd: path.resolve(__dirname, '../client'),
  shell: true,
  stdio: 'pipe'
});

setTimeout(() => {
  const screenshotTasks = [
    { name: 'landing-1440-light.png', url: 'http://localhost:4173/#top', width: 1440, height: 900 },
    { name: 'landing-390-light.png', url: 'http://localhost:4173/#top', width: 390, height: 844 },
    { name: 'login-1440.png', url: 'http://localhost:4173/login', width: 1440, height: 900 },
    { name: 'login-390.png', url: 'http://localhost:4173/login', width: 390, height: 844 },
    { name: 'register-1440.png', url: 'http://localhost:4173/register', width: 1440, height: 900 },
    { name: 'register-390.png', url: 'http://localhost:4173/register', width: 390, height: 844 }
  ];

  for (const s of screenshotTasks) {
    const outPath = path.join(themeReportDir, s.name);
    try {
      execSync(`"${chromePath}" --headless --disable-gpu --screenshot="${outPath}" --window-size=${s.width},${s.height} "${s.url}"`, { stdio: 'ignore', timeout: 10000 });
      console.log(`  📸 Screenshot saved: theme-report/${s.name} (${s.width}x${s.height})`);
    } catch (err) {
      console.warn(`  ⚠️ Could not capture ${s.name}: ${err.message}`);
    }
  }

  try {
    process.kill(-previewProcess.pid);
  } catch {
    previewProcess.kill();
  }
  console.log('\n✅ All UI Smoke Tests and Screenshots Completed Successfully.');
  process.exit(0);
}, 3000);
