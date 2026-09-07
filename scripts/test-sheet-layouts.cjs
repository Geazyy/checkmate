const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const deps = process.env.CHECKMATE_TOOLS;
const { chromium } = require(deps ? path.join(deps, 'playwright') : 'playwright');
const sharp = require(deps ? path.join(deps, 'sharp') : 'sharp');
const { PDFDocument } = require(deps ? path.join(deps, 'pdf-lib') : 'pdf-lib');
const { load, buffers } = require('./benchmark-omr.cjs');
const layout = load(path.resolve('src/services/omr/sheetLayout.ts'));
const { buildAnswerSheetHtml } = load(path.resolve('src/services/export/answerSheetTemplate.ts'));
const scanner = load(path.resolve('src/services/omr/imageScanner.ts'));

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1300, height: 1000 }, deviceScaleFactor: 2 });
  const output = path.resolve('.expo/benchmarks');
  fs.mkdirSync(output, { recursive: true });
  const report = [];
  try {
    for (const itemCount of [10, 20, 25, 30, 40, 50]) {
      for (const choiceCount of [4, 5]) {
        const config = { ...layout.DEFAULT_ANSWER_SHEET_CONFIG, itemCount, choiceCount, testTitle: 'Layout regression' };
        await page.setContent(buildAnswerSheetHtml(config));
        await page.evaluate((choiceCount) => {
          document.querySelectorAll('.question-row').forEach((row) => {
            const q = Number(row.dataset.question);
            if (q === 9) return;
            [...row.querySelectorAll('.bubble')].forEach((bubble, index) => {
              if (index === (q - 1) % choiceCount || (q === 12 && index === 0)) {
                bubble.style.background = '#000'; bubble.style.color = '#000';
              }
            });
          });
        }, choiceCount);
        const png = await page.locator('.answer-sheet').first().screenshot();
        const uri = `generated-${itemCount}-${choiceCount}`;
        const jpeg = await sharp(png).jpeg({ quality: 95 }).toBuffer();
        buffers.set(uri, jpeg);
        fs.writeFileSync(path.join(output, `${uri}.jpg`), jpeg);
        const expected = Array.from({ length: itemCount }, (_, i) => i === 8 ? 'blank' : i === 11 ? 'multiple' : 'ABCDE'[i % choiceCount]);
        try {
          const result = await scanner.analyzeAnswerSheetImageDetailed(uri, itemCount, choiceCount);
          const actual = result.results.map((r) => r.status === 'detected' ? r.detectedOptions.join('') : r.status);
          const mismatch = actual.flatMap((value, i) => value === expected[i] ? [] : [{ q: i + 1, expected: expected[i], actual: value }]);
          report.push({ itemCount, choiceCount, matched: itemCount - mismatch.length, mismatch });
        } catch (error) { report.push({ itemCount, choiceCount, error: error.message }); }
        console.log(JSON.stringify(report.at(-1)));
      }
    }
    for (const mark of ['A', 'blank']) {
      await page.setContent(buildAnswerSheetHtml({ ...layout.DEFAULT_ANSWER_SHEET_CONFIG, itemCount: 25, choiceCount: 4 }));
      if (mark === 'A') await page.evaluate(() => {
        document.querySelectorAll('.question-row').forEach((row) => {
          const bubble = row.querySelector('.bubble');
          bubble.style.background = '#000'; bubble.style.color = '#000';
        });
      });
      const uri = `uniform-${mark}`;
      buffers.set(uri, await sharp(await page.locator('.answer-sheet').first().screenshot()).jpeg({ quality: 95 }).toBuffer());
      const result = await scanner.analyzeAnswerSheetImageDetailed(uri, 25, 4);
      assert.ok(result.results.every((row) => mark === 'blank' ? row.status === 'blank' : row.status === 'detected' && row.detectedOptions.join('') === mark), `Uniform ${mark} sheet`);
    }
    for (const paperSize of ['a4', 'letter']) {
      for (const itemCount of [10, 20, 25]) {
        for (const sheetsPerPage of [1, 2, 4]) {
          const config = { ...layout.DEFAULT_ANSWER_SHEET_CONFIG, paperSize, itemCount, sheetsPerPage };
          await page.setContent(buildAnswerSheetHtml(config));
          await page.emulateMedia({ media: 'print' });
          assert.equal(await page.locator('.answer-sheet').count(), sheetsPerPage);
          assert.equal(await page.locator('.question-row').count(), itemCount * sheetsPerPage);
          const clipped = await page.evaluate(() => [...document.querySelectorAll('.answer-sheet')].some((sheet) => {
            const box = sheet.getBoundingClientRect();
            return [...sheet.querySelectorAll('.bubble')].some((bubble) => {
              const r = bubble.getBoundingClientRect();
              return r.left < box.left || r.right > box.right || r.top < box.top || r.bottom > box.bottom;
            });
          }));
          assert.equal(clipped, false, `Clipped ${paperSize}/${itemCount}/${sheetsPerPage}`);
          const pdfBytes = await page.pdf({ preferCSSPageSize: true, printBackground: true });
          const pdf = await PDFDocument.load(pdfBytes);
          assert.equal(pdf.getPageCount(), 1);
          const expectedSize = layout.getPagePoints(paperSize, 'landscape');
          assert.ok(Math.abs(pdf.getPage(0).getWidth() - expectedSize.width) < 1);
          assert.ok(Math.abs(pdf.getPage(0).getHeight() - expectedSize.height) < 1);
          fs.writeFileSync(path.join(output, `${paperSize}-${itemCount}-${sheetsPerPage}.pdf`), pdfBytes);
          await page.screenshot({ path: path.join(output, `${paperSize}-${itemCount}-${sheetsPerPage}.png`), fullPage: true });
          await page.emulateMedia({ media: 'screen' });
        }
      }
    }
    fs.writeFileSync(path.join(output, 'layout-results.json'), JSON.stringify(report, null, 2));
    assert.ok(report.every((r) => !r.error && !r.mismatch.length), 'Generated layout recognition failures');
    console.log('18 PDF layouts: one page, correct paper dimensions, complete copies and no clipped bubbles.');
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
