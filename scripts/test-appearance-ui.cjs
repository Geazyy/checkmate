/* global __r */
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.CHECKMATE_TOOLS ? path.join(process.env.CHECKMATE_TOOLS, 'playwright') : 'playwright');

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();
  // UI-only fixture: never send test account data to Supabase.
  await context.route('**/*.supabase.co/**', route => route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const output = path.resolve('.expo/appearance-verification');
  fs.mkdirSync(output, { recursive: true });
  async function loginFixture() {
    await page.evaluate(() => {
      const entry = Array.from(__r.getModules()).find(([, module]) => module.verboseName === 'src/store/useAuthStore.ts');
      if (!entry) throw new Error('Development auth module not found');
      __r(entry[0]).useAuthStore.setState({ isLoading: false, recovery: false,
        session: { user: { id: 'appearance-test', email: 'test@example.invalid' } },
        user: { id: 'appearance-test', full_name: 'Theme Test', email: 'test@example.invalid' },
        profile: { id: 'appearance-test', full_name: 'Theme Test', role: 'teacher' } });
    });
    await page.getByRole('button', { name: 'Open profile menu' }).waitFor();
  }
  try {
    await page.goto('http://localhost:8081/auth/login', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
    await loginFixture();
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole('button', { name: 'Open profile menu' }).click();
      for (const mode of ['dark', 'light', 'dark']) {
        const control = page.getByRole('radio', { name: `${mode === 'dark' ? 'Dark' : 'Light'} mode` });
        await control.click();
        await page.waitForFunction(expected => JSON.parse(localStorage.getItem('checkmate-appearance-v1'))?.state?.mode === expected, mode);
        assert.equal(await control.getAttribute('aria-checked'), 'true');
        const background = await page.getByRole('button', { name: 'Close profile menu' }).evaluate(button => getComputedStyle(button.parentElement.parentElement).backgroundColor);
        assert.equal(background, mode === 'dark' ? 'rgb(34, 34, 38)' : 'rgb(255, 255, 255)');
        await page.screenshot({ path: path.join(output, `menu-${mode}-${width}.png`), fullPage: true });
      }
      await page.getByRole('button', { name: 'Close profile menu' }).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    }
    await page.getByRole('button', { name: 'Open profile menu' }).click();
    await page.getByText('Settings', { exact: true }).click();
    await page.getByRole('button', { name: 'Close profile menu' }).waitFor({ state: 'hidden' });
    await page.getByRole('radio', { name: 'Dark mode' }).waitFor();
    await page.getByRole('radio', { name: 'Light mode' }).click();
    await page.getByRole('radio', { name: 'Dark mode' }).click();
    await page.screenshot({ path: path.join(output, 'settings-dark.png'), fullPage: true });
    await page.reload();
    await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('checkmate-appearance-v1'))?.state?.mode === 'dark');
    const inputColor = await page.getByLabel('Email', { exact: true }).evaluate(input => getComputedStyle(input).backgroundColor);
    assert.equal(inputColor, 'rgb(43, 43, 49)');
    await page.screenshot({ path: path.join(output, 'login-dark.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log('PASS: menu light/dark at 320/390/1280, Settings toggle, persisted dark login, no horizontal overflow or runtime errors.');
  } finally { await context.close(); await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
