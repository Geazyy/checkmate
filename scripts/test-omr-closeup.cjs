/* global __dirname */
const assert = require('node:assert/strict');
const path = require('node:path');
const sharp = require(process.env.CHECKMATE_TOOLS ? path.join(process.env.CHECKMATE_TOOLS, 'sharp') : 'sharp');
const { load, buffers } = require('./benchmark-omr.cjs');
const root = path.resolve(__dirname, '..');
const scanner = load(path.join(root, 'src/services/omr/imageScanner.ts'));
const fixture = path.join(root, 'fixtures/omr/checkmate-25-closeup.jpg');
const { answers } = require('../fixtures/omr/checkmate-25-closeup-expected.json');

async function main() {
  const variants = [
    ['original', sharp(fixture)],
    ['blurred', sharp(fixture).blur(0.55)],
    ['reduced', sharp(fixture).resize({ width: 480 })],
    ['compressed', sharp(fixture).jpeg({ quality: 65 })],
  ];
  for (const [name, pipeline] of variants) {
    const uri = `closeup-${name}`;
    buffers.set(uri, await pipeline.toBuffer());
    const started = performance.now();
    const result = await scanner.analyzeAnswerSheetImageDetailed(uri, 25, 4);
    assert.equal(result.results.length, 25);
    assert.deepEqual(result.results.map((row) => row.status === 'detected' ? row.detectedOptions.join('') : row.status), answers, name);
    for (const row of result.results) {
      const region = row.sourceRegion;
      assert.ok(region.x >= 0 && region.y >= 0 && region.x + region.width <= 1 && region.y + region.height <= 1);
    }
    console.log(`${name}: 25/25 matched, Q11 blank, ${Math.round(performance.now() - started)}ms`);
  }
  const incomplete = [
    ['last-row-missing', sharp(fixture).extract({ left: 0, top: 0, width: 720, height: 785 })],
    ['first-row-missing', sharp(fixture).extract({ left: 0, top: 100, width: 720, height: 860 })],
    ['D-column-missing', sharp(fixture).extract({ left: 0, top: 0, width: 570, height: 960 })],
    ['not-a-sheet', sharp({ create: { width: 720, height: 960, channels: 3, background: '#aaa' } }).jpeg()],
  ];
  for (const [name, pipeline] of incomplete) {
    buffers.set(name, await pipeline.toBuffer());
    await assert.rejects(scanner.analyzeAnswerSheetImageDetailed(name, 25, 4), (error) => {
      assert.match(error.message, /align|locate/i);
      assert.equal(error.details.expectedRows, 25);
      assert.ok(Number.isInteger(error.details.detectedRows));
      assert.ok(error.details.sourceWidth > 0 && error.details.sourceHeight > 0);
      return true;
    }, name);
    console.log(`${name}: rejected without guessing`);
  }
  console.log('Close-up regression checks passed. Native photo decoding still needs device verification.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
