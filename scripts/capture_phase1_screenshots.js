const path = require('path');
const fs = require('fs');
const { execSync, spawn } = require('child_process');

const reviewDir = path.resolve(__dirname, '../design/review/phase1');
if (!fs.existsSync(reviewDir)) {
  fs.mkdirSync(reviewDir, { recursive: true });
}

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
if (!fs.existsSync(chromePath)) {
  console.error('Chrome executable not found at standard path.');
  process.exit(1);
}

console.log('Capturing Phase 1 Midnight Amber Screenshots into design/review/phase1/...');

const previewProcess = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
  cwd: path.resolve(__dirname, '../client'),
  shell: true,
  stdio: 'pipe'
});

setTimeout(() => {
  const screenshotTasks = [
    { name: 'landing-midnight-amber-1440.png', url: 'http://localhost:4173/#top', width: 1440, height: 900 },
    { name: 'landing-midnight-amber-390.png', url: 'http://localhost:4173/#top', width: 390, height: 844 },
    { name: 'login-midnight-amber-1440.png', url: 'http://localhost:4173/login', width: 1440, height: 900 },
    { name: 'login-midnight-amber-390.png', url: 'http://localhost:4173/login', width: 390, height: 844 },
    { name: 'register-midnight-amber-1440.png', url: 'http://localhost:4173/register', width: 1440, height: 900 },
    { name: 'register-midnight-amber-390.png', url: 'http://localhost:4173/register', width: 390, height: 844 }
  ];

  for (const s of screenshotTasks) {
    const outPath = path.join(reviewDir, s.name);
    try {
      execSync(`"${chromePath}" --headless --disable-gpu --screenshot="${outPath}" --window-size=${s.width},${s.height} "${s.url}"`, {
        stdio: 'ignore',
        timeout: 10000
      });
      console.log(`  📸 Screenshot saved: design/review/phase1/${s.name} (${s.width}x${s.height})`);
    } catch (err) {
      console.warn(`  ⚠️ Could not capture ${s.name}: ${err.message}`);
    }
  }

  try {
    process.kill(-previewProcess.pid);
  } catch {
    previewProcess.kill();
  }
  console.log('\n✅ All Phase 1 Screenshots Captured in design/review/phase1/.');
  process.exit(0);
}, 3000);
