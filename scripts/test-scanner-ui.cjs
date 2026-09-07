const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(path.join(process.env.CHECKMATE_TOOLS, 'playwright'));

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const output = path.resolve('.expo/benchmarks/ui');
  fs.mkdirSync(output, { recursive: true });
  const photo = fs.readFileSync('.expo/benchmarks/generated-25-4.jpg').toString('base64');
  await context.addInitScript((photo) => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 900; canvas.height = 1200;
      const image = new Image();
      image.src = `data:image/jpeg;base64,${photo}`;
      await image.decode();
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(840 / image.width, 1140 / image.height);
      ctx.drawImage(image, (900 - image.width * scale) / 2, (1200 - image.height * scale) / 2, image.width * scale, image.height * scale);
      const stream = canvas.captureStream(5);
      setInterval(() => ctx.drawImage(canvas, 0, 0), 200);
      return stream;
    } });
  }, photo);
  try {
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: width > 700 ? 900 : 844 });
      for (const route of ['/', '/exams', '/rosters', '/settings', '/answer-sheets', '/exams/exam-102/answer-key']) {
        await page.goto(`http://localhost:8081${route}`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: route === '/answer-sheets' ? 'Preview' : 'Open profile menu', exact: true }).waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${route} overflows ${width}`);
        await page.screenshot({ path: path.join(output, `${width}-${route.replaceAll('/', '_') || 'home'}.png`) });
      }
      await page.goto('http://localhost:8081/scan?examId=exam-102', { waitUntil: 'domcontentloaded' });
      const capture = page.getByRole('button', { name: 'Capture answer sheet', exact: true });
      await page.waitForFunction(() => document.querySelector('video')?.videoWidth > 0);
      const before = await page.getByTestId('camera-frame').boundingBox();
      await page.screenshot({ path: path.join(output, `${width}-camera.png`) });
      await capture.click();
      await page.getByTestId('captured-photo').waitFor();
      const after = await page.getByTestId('camera-frame').boundingBox();
      assert.deepEqual(after, before, `Capture changes framing at ${width}`);
      const status = await page.getByText('Keep questions 1-25 and all A-D bubbles visible.', { exact: true }).boundingBox();
      assert.ok(status.y >= after.y + after.height, 'Guidance overlaps photo');
      await page.screenshot({ path: path.join(output, `${width}-captured.png`) });
      await page.getByRole('button', { name: 'Use Photo', exact: true }).click();
      await page.getByRole('button', { name: 'Question 25, answer D', exact: true }).waitFor({ timeout: 30000 });
      assert.equal(await page.getByRole('button', { name: /^Question \d+, answer [A-D]$/ }).count(), 100);
      await page.getByRole('button', { name: 'Question 1, answer B', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Question 1, answer B', exact: true }).getAttribute('aria-selected'), 'true');
      await page.screenshot({ path: path.join(output, `${width}-review.png`) });
      console.log(`${width}px: navigation, capture framing, 25-item review and manual override passed`);
    }
    assert.deepEqual(errors, [], 'Browser runtime errors');
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
