const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:5000/api';
const REVIEW_DIR = path.resolve(__dirname, '../design/review/phase2');

if (!fs.existsSync(REVIEW_DIR)) {
  fs.mkdirSync(REVIEW_DIR, { recursive: true });
}

async function capturePhase2Screenshots() {
  console.log('Capturing Phase 2 Lokboltab Dashboard Screenshots...');
  if (!fs.existsSync(CHROME_PATH)) {
    console.error('Chrome executable not found at standard path.');
    process.exit(1);
  }

  // Register or login a test user
  const email = `phase2_test_${Date.now()}@example.com`;
  const regPayload = {
    business_name: 'Metro Pharma & Mart',
    business_type: 'pharmacy',
    full_name: 'Dr. Tariq Latif',
    email,
    password: 'password123',
    phone: '03001234567'
  };

  let token = null;
  let user = null;
  let tenant = null;

  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regPayload)
    });
    const data = await res.json();
    if (data.success) {
      token = data.token;
      user = data.user;
      tenant = data.user?.tenant || {
        id: data.user.tenant_id,
        business_name: 'Metro Pharma & Mart',
        business_type: 'pharmacy',
        plan: 'free'
      };
    }
  } catch (err) {
    console.warn('API register error, falling back:', err.message);
  }

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true
  });

  // 1. Desktop 1440x900
  const context1440 = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page1440 = await context1440.newPage();

  if (token) {
    await page1440.goto(`${BASE_URL}/login`);
    await page1440.evaluate(({ token, user, tenant }) => {
      localStorage.setItem('lt_token', token);
      localStorage.setItem('lt_user', JSON.stringify(user));
      localStorage.setItem('lt_tenant', JSON.stringify(tenant));
      localStorage.setItem('shoppos_app_theme', 'midnight-amber');
      document.documentElement.setAttribute('data-app-theme', 'midnight-amber');
    }, { token, user, tenant });
  }

  await page1440.goto(`${BASE_URL}/`);
  await page1440.waitForTimeout(1500);

  const out1440 = path.join(REVIEW_DIR, 'dashboard-midnight-amber-1440.png');
  await page1440.screenshot({ path: out1440, fullPage: false });
  console.log(`  📸 Saved screenshot: design/review/phase2/dashboard-midnight-amber-1440.png (1440x900)`);
  await context1440.close();

  // 2. Mobile 390x844
  const context390 = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true
  });
  const page390 = await context390.newPage();

  if (token) {
    await page390.goto(`${BASE_URL}/login`);
    await page390.evaluate(({ token, user, tenant }) => {
      localStorage.setItem('lt_token', token);
      localStorage.setItem('lt_user', JSON.stringify(user));
      localStorage.setItem('lt_tenant', JSON.stringify(tenant));
      localStorage.setItem('shoppos_app_theme', 'midnight-amber');
      document.documentElement.setAttribute('data-app-theme', 'midnight-amber');
    }, { token, user, tenant });
  }

  await page390.goto(`${BASE_URL}/`);
  await page390.waitForTimeout(1500);

  const out390 = path.join(REVIEW_DIR, 'dashboard-midnight-amber-390.png');
  await page390.screenshot({ path: out390, fullPage: false });
  console.log(`  📸 Saved screenshot: design/review/phase2/dashboard-midnight-amber-390.png (390x844)`);
  await context390.close();

  await browser.close();
  console.log('✅ Phase 2 Screenshots Successfully Captured!');
}

capturePhase2Screenshots()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Screenshot capture failed:', err);
    process.exit(1);
  });

