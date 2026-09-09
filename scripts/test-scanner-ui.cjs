const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.CHECKMATE_TOOLS ? path.join(process.env.CHECKMATE_TOOLS, 'playwright') : 'playwright');

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  const errors = [];
  const scanTimings = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    const prefix = '[OMR timing] ';
    if (message.text().startsWith(prefix)) scanTimings.push(JSON.parse(message.text().slice(prefix.length)));
  });
  const colorTest = process.argv.includes('--color');
  const output = path.resolve(colorTest ? '.expo/benchmarks/ui-color' : '.expo/benchmarks/ui');
  fs.mkdirSync(output, { recursive: true });
  const photo = fs.readFileSync(colorTest ? 'fixtures/omr/checkmate-25-color.jpg' : '.expo/benchmarks/generated-25-4.jpg').toString('base64');
  const scanOnly = process.argv.includes('--scanner-only');
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
    for (const route of scanOnly ? [] : ['/', '/exams', '/rosters', '/settings', '/answer-sheets', '/exams/exam-102/answer-key']) {
        await page.goto(`http://localhost:8081${route}`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: route === '/answer-sheets' ? 'Preview' : 'Open profile menu', exact: true }).waitFor();
      for (const width of [320, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: width > 700 ? 900 : 844 });
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${route} overflows ${width}`);
        await page.screenshot({ path: path.join(output, `${width}-${route.replaceAll('/', '_') || 'home'}.png`) });
      }
      console.log(`${route}: no page overflow at 320, 390, 768 and 1280px`);
    }
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: width > 700 ? 900 : 844 });
      if (width === 320) await page.goto('http://localhost:8081/scan?examId=exam-102', { waitUntil: 'domcontentloaded' });
      else await page.getByRole('button', { name: 'Retake Photo', exact: true }).click();
      const capture = page.getByRole('button', { name: 'Capture answer sheet', exact: true });
      await page.locator('video:visible').waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('video')].some((video) => video.getBoundingClientRect().height > 0 && video.videoWidth > 0));
      const before = await page.locator('[data-testid="camera-frame"]:visible').boundingBox();
      await page.screenshot({ path: path.join(output, `${width}-camera.png`) });
      await capture.click();
      await page.locator('[data-testid="captured-photo"]:visible').waitFor();
      const after = await page.locator('[data-testid="camera-frame"]:visible').boundingBox();
      assert.deepEqual(after, before, `Capture changes framing at ${width}`);
      const status = await page.getByText('Keep questions 1-25 and all A-D bubbles visible.', { exact: true }).filter({ visible: true }).boundingBox();
      assert.ok(status.y >= after.y + after.height, 'Guidance overlaps photo');
      await page.screenshot({ path: path.join(output, `${width}-captured.png`) });
      await page.getByRole('button', { name: 'Use Photo', exact: true }).evaluate((button) => { button.click(); button.click(); });
      await page.getByRole('button', { name: 'Question 25, answer D', exact: true }).waitFor({ timeout: 30000 });
      assert.equal(await page.getByRole('button', { name: /^Question \d+, answer [A-D]$/ }).count(), 100);
      if (colorTest) {
        const answerA = page.getByRole('button', { name: 'Question 12, answer A', exact: true });
        const answerB = page.getByRole('button', { name: 'Question 12, answer B', exact: true });
        await page.getByText('Invalid: multiple answers', { exact: true }).waitFor();
        assert.equal(await answerA.getAttribute('aria-pressed'), 'true');
        assert.equal(await answerB.getAttribute('aria-pressed'), 'true');
        assert.equal(await page.getByRole('button', { name: 'Question 11, answer C', exact: true }).getAttribute('aria-pressed'), 'true');
        await answerA.scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, `${width}-invalid.png`) });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        await answerA.click();
        assert.equal(await answerA.getAttribute('aria-pressed'), 'true');
        assert.equal(await answerB.getAttribute('aria-pressed'), 'false');
        await page.getByText('Invalid: multiple answers', { exact: true }).waitFor({ state: 'hidden' });
      }
      await page.getByRole('button', { name: 'Question 1, answer B', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[aria-label="Question 1, answer B"]')?.getAttribute('aria-pressed') === 'true');
      await page.screenshot({ path: path.join(output, `${width}-review.png`) });
      console.log(`${width}px: capture framing, 25-item review and manual override passed`);
    }
    assert.deepEqual(errors, [], 'Browser runtime errors');
    assert.equal(scanTimings.length, 4, 'Exactly one analysis per double-click');
    fs.writeFileSync(path.join(output, 'browser-stage-times.json'), JSON.stringify(scanTimings, null, 2));
  } catch (error) {
    console.log('Browser errors:', errors);
    console.log('Current page:', await page.locator('body').innerText());
    await page.screenshot({ path: path.join(output, 'failure.png') });
    throw error;
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
