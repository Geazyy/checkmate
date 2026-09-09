/* global __dirname */
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const path = require('node:path');
const sharp = require(process.env.CHECKMATE_TOOLS ? path.join(process.env.CHECKMATE_TOOLS, 'sharp') : 'sharp');
const { load, buffers } = require('./benchmark-omr.cjs');
const root = path.resolve(__dirname, '..');
const scanner = load(path.join(root, 'src/services/omr/imageScanner.ts'));
const { scoreScanResults } = load(path.join(root, 'src/services/omr/scannerEngine.ts'));
const fixture = path.join(root, 'fixtures/omr/checkmate-25-color.jpg');
const { answers } = require('../fixtures/omr/checkmate-25-color-expected.json');

async function main() {
  buffers.set('muted-paper', await sharp({ create: { width: 100, height: 200, channels: 3, background: { r: 120, g: 135, b: 150 } } }).jpeg().toBuffer());
  const muted = await scanner.__loadImage('muted-paper');
  assert.deepEqual(muted.markData, muted.data, 'Muted paper/print colors must not be amplified into pencil marks');
  const { data, info } = await sharp(fixture).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const cases = [['red-photo', await sharp(fixture).toBuffer()]];
  // Synthetic hue variants retain the photographed rings and all graphite marks.
  for (const color of ['blue', 'green', 'black']) {
    const pixels = Buffer.from(data);
    for (let i = 0; i < pixels.length; i += 3) {
      const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]];
      if (r - Math.max(g, b) < 35) continue;
      const replacement = color === 'blue' ? [b, g, r] : color === 'green' ? [g, r, b] : [Math.min(g, b), Math.min(g, b), Math.min(g, b)];
      pixels.set(replacement, i);
    }
    cases.push([color, await sharp(pixels, { raw: info }).jpeg({ quality: 95 }).toBuffer()]);
  }
  const keys = answers.map((answer, i) => ({ question_number: i + 1, correct_options: [answer === 'multiple' ? 'A' : answer], points: 1 }));
  for (const [name, bytes] of cases) {
    buffers.set(name, bytes);
    const result = await scanner.analyzeAnswerSheetImageDetailed(name, 25, 4);
    assert.deepEqual(result.results.map((row) => row.status === 'detected' ? row.detectedOptions.join('') : row.status), answers, name);
    const double = result.results[11];
    assert.deepEqual([...double.detectedOptions].sort(), ['A', 'B']);
    assert.equal(double.isAmbiguous, true);
    const graded = scoreScanResults(result.results, keys);
    assert.equal(graded.rawScore, 24);
    assert.equal(graded.itemDetails[11].is_correct, false);
    assert.equal(scoreScanResults([double], [{ question_number: 12, correct_options: ['A', 'B'], points: 1 }]).rawScore, 0);
    console.log(`${name}: Q11 C, Q12 invalid A+B, all 25 results matched, invalid item scores zero`);
  }
  assert.equal(scanner.__classify({ A: 0.95, B: 0.4, C: 0, D: 0 }).status, 'multiple');
  assert.equal(scanner.__classify({ A: 0.95, B: 0.4, C: 0, D: 0 }, { A: 0.9, B: 0.1, C: 0, D: 0 }).status, 'detected');
  assert.equal(scanner.__classify({ A: 0.28, B: 0.2, C: 0, D: 0 }).status, 'uncertain');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
