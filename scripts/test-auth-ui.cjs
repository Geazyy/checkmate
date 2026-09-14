const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.CHECKMATE_TOOLS ? path.join(process.env.CHECKMATE_TOOLS, 'playwright') : 'playwright');
async function main() {
 const browser = await chromium.launch({ channel: 'msedge', headless: true });
 const context = await browser.newContext();
 const page = await context.newPage();
 page.setDefaultTimeout(120000);
 const errors = [];
 page.on('pageerror', e => errors.push(e.message));
 const output = path.resolve('.expo/auth-verification');
 fs.mkdirSync(output, { recursive: true });
 await context.addInitScript(() => {
  localStorage.setItem('checkmate-exams-v1', JSON.stringify({ state: { exams: [{ id: 'private-old', title: 'PRIVATE LEGACY TEACHER DATA' }] }, version: 0 }));
 });
 try {
  for (const route of ['/', '/exams', '/rosters', '/scan', '/scan/review', '/settings', '/profile', '/help', '/answer-sheets', '/exams/exam-101/answer-key', '/exams/exam-101/analytics']) {
   await page.goto('http://localhost:8081' + route, { waitUntil: 'domcontentloaded' });
   await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
   assert.match(page.url(), /auth\/login/, route + ' must redirect to login');
   assert.equal((await page.locator('body').innerText()).includes('PRIVATE LEGACY TEACHER DATA'), false);
  }
  for (const [route, heading] of [['login', 'Sign in'], ['register', 'Create account'], ['forgot-password', 'Reset password']]) {
   await page.goto('http://localhost:8081/auth/' + route, { waitUntil: 'domcontentloaded' });
   await page.getByText(heading, { exact: true }).first().waitFor();
   for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: path.join(output, route + '-' + width + '.png'), fullPage: true });
   }
  }
  await page.goto('http://localhost:8081/auth/login');
  await page.getByLabel('Password', { exact: true }).fill('not-a-real-password');
  assert.equal(await page.getByLabel('Password', { exact: true }).getAttribute('type'), 'password');
  await page.getByRole('button', { name: 'Show password', exact: true }).click();
  assert.equal(await page.getByLabel('Password', { exact: true }).evaluate(input => input.type), 'text');
  await page.reload();
  await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
  assert.ok(await page.evaluate(() => localStorage.getItem('checkmate-exams-v1')).then(s => s.includes('PRIVATE LEGACY TEACHER DATA')));
  assert.deepEqual(errors, []);
  console.log('PASS: 11 signed-out route guards; login/register/reset at 320/390/768/1280; show password; original local data preserved; no browser runtime errors.');
  console.log('This test does not create users, send email, or test live authenticated Supabase requests.');
 } finally { await context.close(); await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
