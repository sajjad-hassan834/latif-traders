const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const path = require('path');

test('SUPEROWNER STARTUP SAFETY: Disallow legacy default usernames', async (t) => {
  const disallowedNames = ['superowner', 'shopos_superowner', 'SuperOwner', 'SHOPOS_SUPEROWNER'];

  for (const badUser of disallowedNames) {
    await t.test(`Startup fails when SUPEROWNER_USERNAME is "${badUser}" in production`, () => {
      const child = spawnSync(
        process.execPath,
        ['-e', "process.env.NODE_ENV = 'production'; process.env.DATA_DIR = './data'; process.env.DB_PATH = './latif_traders.db'; process.env.SUPEROWNER_USERNAME = '" + badUser + "'; process.env.SUPEROWNER_PASSWORD = 'password12345678'; require('./server/config/database');"],
        {
          cwd: path.resolve(__dirname, '../..'),
          encoding: 'utf8'
        }
      );

      assert.notEqual(child.status, 0, `Boot must fail with non-zero exit code when SUPEROWNER_USERNAME is ${badUser}`);
      assert.ok(
        child.stderr.includes('[FATAL SECURITY ERROR]') || child.stdout.includes('[FATAL SECURITY ERROR]'),
        `Error output must explain that "${badUser}" is disallowed`
      );
    });
  }

  await t.test('Startup succeeds when SUPEROWNER_USERNAME is a custom unique username', () => {
    const child = spawnSync(
      process.execPath,
      ['-e', "process.env.NODE_ENV = 'production'; process.env.DATA_DIR = './data'; process.env.DB_PATH = './latif_traders.db'; process.env.SUPEROWNER_USERNAME = 'plat_custom_so_" + Date.now() + "'; process.env.SUPEROWNER_PASSWORD = 'customPass12345678'; require('./server/config/database'); console.log('CUSTOM_SO_OK');"],
      {
        cwd: path.resolve(__dirname, '../..'),
        encoding: 'utf8'
      }
    );

    assert.equal(child.status, 0, 'Boot must succeed with unique custom superowner');
    assert.ok(child.stdout.includes('CUSTOM_SO_OK'), 'Script must finish initialization');
  });
});
