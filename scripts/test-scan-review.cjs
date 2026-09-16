/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const file = path.join(__dirname, '../src/services/omr/scannerEngine.ts');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const target = { exports: {} };
new Function('exports', 'module', compiled)(target.exports, target);
const { scoreScanResults, getReviewStatus, summarizeReview } = target.exports;
const bubble = { questionNumber: 1, detectedOptions: ['A'], fillRatios: { A: 0.8 }, status: 'detected', isAmbiguous: false };
assert.throws(() => scoreScanResults([bubble], []), /Answer key missing for question 1/);
assert.throws(() => scoreScanResults([bubble], [{ question_number: 1, correct_options: [] }]), /Answer key missing/);
assert.equal(scoreScanResults([bubble], [{ question_number: 1, correct_options: ['A'], points: 0 }]).rawScore, 0);
assert.equal(scoreScanResults([bubble], [{ question_number: 1, correct_options: ['A'], points: 2 }]).rawScore, 2);
for (const status of ['blank', 'multiple', 'uncertain']) {
  assert.equal(scoreScanResults([{ ...bubble, status }], [{ question_number: 1, correct_options: ['A'], points: 1 }]).rawScore, 0);
}
const item = { question_number: 1, detected_options: ['A'], is_correct: true, is_ambiguous: false, fill_ratios: {} };
const rows = [item, { ...item, is_correct: false },
  { ...item, detected_options: [], detection_status: 'blank' },
  { ...item, detected_options: ['A', 'B'] },
  { ...item, is_ambiguous: true }];
assert.equal(getReviewStatus(rows[3]), 'multiple');
assert.deepEqual(summarizeReview(rows), { correct: 1, incorrect: 1, blank: 1, multiple: 1, uncertain: 1 });
assert.equal(Object.values(summarizeReview(rows)).reduce((a, b) => a + b), rows.length);
console.log('Scan review: missing keys rejected, zero-point weights preserved, flagged answers score zero, totals are exclusive.');
