// Desktop fixture benchmark. Native camera, Expo codecs, persistence and navigation
// require a device run; Sharp here substitutes only the image input adapter.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const jpeg = require('jpeg-js');
const sharp = require(process.env.CHECKMATE_TOOLS ? path.join(process.env.CHECKMATE_TOOLS, 'sharp') : 'sharp');
const root = path.resolve(__dirname, '..');
let baseline = process.argv.includes('--baseline');
const buffers = new Map();
let sequence = 0;
let timings = {};
const bytes = (uri) => buffers.get(uri) || fs.readFileSync(uri);
const mocks = {
  'jpeg-js': { ...jpeg, decode(...args) {
    const start = performance.now();
    try { return jpeg.decode(...args); }
    finally { timings.decodeImageMs = performance.now() - start; }
  } },
  'react-native': { Platform: { OS: 'android' }, Image: { getSize(uri, resolve, reject) {
    sharp(bytes(uri)).metadata().then(({ width, height }) => resolve(width, height), reject);
  } } },
  'expo-file-system': { File: class { constructor(uri) { this.uri = uri; } async bytes() { return new Uint8Array(bytes(this.uri)); } } },
  'expo-image-manipulator': { SaveFormat: { JPEG: 'jpeg' }, ImageManipulator: { manipulate(uri) {
    let pipeline = sharp(bytes(uri)).autoOrient();
    return {
      rotate(angle) { pipeline = pipeline.rotate(angle); },
      resize(size) { pipeline = pipeline.resize(size); },
      release() {},
      async renderAsync() {
        return { release() {}, async saveAsync() {
          const start = performance.now();
          const value = await pipeline.jpeg({ quality: 92 }).toBuffer();
          timings.orientationAndResizeMs = performance.now() - start;
          const id = `memory:${sequence++}`;
          buffers.set(id, value);
          return { uri: id };
        } };
      },
    };
  } } },
};
function source(file) {
  if (!baseline || !file.includes(`${path.sep}src${path.sep}`)) return fs.readFileSync(file, 'utf8');
  try {
    return execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, 'show', `HEAD:${path.relative(root, file).replaceAll('\\', '/')}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch { return fs.readFileSync(file, 'utf8'); }
}
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  let code = source(file);
  if (file.endsWith('imageScanner.ts')) {
    const stages = { normalizeLighting: 'preprocessMs', rectify: 'perspectiveCorrectionMs', discoverPartialBubbleGrid: 'bubbleDetectionMs', discoverTwoColumnBubbleGrid: 'bubbleDetectionMs', darkRatio: 'bubbleSamplingMs', classifyRatios: 'classificationMs' };
    for (const [name, stage] of Object.entries(stages)) {
      code += `\n{ const original = ${name}; ${name} = (...args) => { const start = performance.now(); const finish = () => { __timings['${stage}'] = (__timings['${stage}'] || 0) + performance.now() - start; }; try { const value = original(...args); if (value?.then) return value.finally(finish); finish(); return value; } catch(error) { finish(); throw error; } }; }`;
    }
    code += '\nexports.__classify = classifyRatios; exports.__normalize = normalizeLighting; exports.__components = findComponents; exports.__loadImage = (uri) => loadSmallGrayscaleImage(uri, { measure: async (_, work) => work() }); exports.__runs = selectTwoBubbleRuns;';
  }
  const module = { exports: {} };
  cache.set(file, module);
  const compiled = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const req = (id) => {
    if (mocks[id]) return mocks[id];
    if (id.startsWith('.')) return load(path.resolve(path.dirname(file), `${id}.ts`));
    return require(id);
  };
  new Function('require', 'module', 'exports', '__DEV__', '__timings', compiled)(req, module, module.exports, false, new Proxy({}, { get: (_, k) => timings[k], set: (_, k, v) => { timings[k] = v; return true; } }));
  return module.exports;
}
async function main() {
  const scanner = load(path.join(root, 'src/services/omr/imageScanner.ts'));
  const fixtureDir = path.join(root, 'fixtures/omr');
  const expected = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'checkmate-50-expected.json'))).answers;
  const cases = ['captured', 'dark', 'bright', 'rotated', 'reduced', 'slight-crop'].map((name) => ({ name: `50-${name}`, uri: path.join(fixtureDir, `checkmate-50-${name}.jpg`), count: 50, expected }));
  const base = path.join(fixtureDir, 'checkmate-50-captured.jpg');
  const meta = await sharp(base).metadata();
  buffers.set('25-left', await sharp(base).extract({ left: 0, top: 0, width: Math.floor(meta.width * 0.52), height: meta.height }).toBuffer());
  cases.push({ name: '25-left', uri: '25-left', count: 25, expected: expected.slice(0, 25) });
  buffers.set('50-blurred', await sharp(base).blur(0.55).toBuffer());
  cases.push({ name: '50-blurred', uri: '50-blurred', count: 50, expected });
  cases.push({ name: '25-full-sheet', uri: base, count: 25, expected: expected.slice(0, 25) });
  if (process.argv.includes('--compare')) {
    baseline = true; cache.clear();
    const previous = load(path.join(root, 'src/services/omr/imageScanner.ts'));
    baseline = false;
    const comparisons = [];
    for (const test of cases) {
      const runs = { before: [], after: [] };
      const outcomes = {};
      for (let repeat = 0; repeat < 8; repeat++) {
        const order = repeat % 2 ? [['after', scanner], ['before', previous]] : [['before', previous], ['after', scanner]];
        for (const [label, engine] of order) {
          timings = {};
          const start = performance.now();
          try {
            const result = await engine.analyzeAnswerSheetImageDetailed(test.uri, test.count, 4);
            const actual = result.results.map((r) => r.status === 'detected' ? r.detectedOptions.join('') : r.status);
            outcomes[label] = { matched: actual.filter((a, i) => a === test.expected[i]).length, total: test.count };
          } catch (error) { outcomes[label] = { rejected: error.message }; }
          if (repeat > 0) runs[label].push({ totalMs: performance.now() - start, ...timings });
          for (const key of buffers.keys()) if (key.startsWith('memory:')) buffers.delete(key);
        }
      }
      const row = { fixture: test.name };
      for (const label of ['before', 'after']) row[label] = { ...outcomes[label], ...Object.fromEntries(Object.keys(runs[label][0]).map((k) => [k, +runs[label].map((r) => r[k]).sort((a, b) => a - b)[3].toFixed(2)])) };
      comparisons.push(row); console.log(JSON.stringify(row));
    }
    fs.mkdirSync(path.join(root, '.expo/benchmarks'), { recursive: true });
    fs.writeFileSync(path.join(root, '.expo/benchmarks/comparison.json'), JSON.stringify(comparisons, null, 2));
    return;
  }
  const report = [];
  for (const test of cases) {
    const runs = [];
    let outcome;
    for (let repeat = 0; repeat < 4; repeat++) {
      timings = {};
      const start = performance.now();
      try {
        const result = await scanner.analyzeAnswerSheetImageDetailed(test.uri, test.count, 4);
        const actual = result.results.map((r) => r.status === 'detected' ? r.detectedOptions.join('') : r.status);
        outcome = { matched: actual.filter((a, i) => a === test.expected[i]).length, total: test.count, mismatches: actual.flatMap((a, i) => a === test.expected[i] ? [] : [{ q: i + 1, expected: test.expected[i], actual: a }]) };
      } catch (error) { outcome = { rejected: error.message }; }
      if (repeat) runs.push({ totalMs: performance.now() - start, ...timings });
      for (const key of buffers.keys()) if (key.startsWith('memory:')) buffers.delete(key);
    }
    const medians = Object.fromEntries(Object.keys(runs[0]).map((k) => [k, +runs.map((r) => r[k]).sort((a, b) => a - b)[1].toFixed(2)]));
    report.push({ fixture: test.name, ...outcome, ...medians });
    console.log(JSON.stringify(report.at(-1)));
  }
  if (!baseline) {
    const assert = require('node:assert/strict');
    assert.ok(report.every((row) => row.matched === row.total && row.total > 0), 'Photo fixture recognition regression');
    const cancelled = new AbortController();
    cancelled.abort();
    await assert.rejects(scanner.analyzeAnswerSheetImageDetailed(base, 50, 4, { signal: cancelled.signal }), /cancelled/i);
    const duringScan = new AbortController();
    await assert.rejects(scanner.analyzeAnswerSheetImageDetailed(base, 50, 4, {
      signal: duringScan.signal,
      onStage(stage) { if (stage === 'Aligning sheet') duringScan.abort(); },
    }), /cancelled/i);
    await assert.rejects(scanner.analyzeAnswerSheetImageDetailed(base, 40, 4), /alignment failed/i);
    const camera = load(path.resolve('src/services/omr/captureGeometry.ts'));
    assert.equal(camera.selectPictureSize(['4032x3024', '640x480', '1600x1200', '1920x1080']), '1600x1200');
    assert.equal(camera.selectPictureSize(['invalid', '1920x1080']), undefined);
    for (const [width, height] of [[320, 320], [390, 560], [1280, 540]]) {
      const frame = camera.fitCameraFrame(width, height);
      assert.ok(frame.width <= width && frame.height <= height);
      assert.ok(Math.abs(frame.width / frame.height - 0.75) < 0.001);
    }
    assert.equal(scanner.__classify({ A: 0, B: 0.05, C: 0.03, D: 0 }).status, 'blank');
    assert.equal(scanner.__classify({ A: 0.7, B: 0.68, C: 0.03, D: 0 }).status, 'multiple');
    assert.equal(scanner.__classify({ A: 0.28, B: 0.2, C: 0.03, D: 0 }).status, 'uncertain');
    assert.equal(scanner.__classify({ A: 0.8, B: 0, C: 0, D: 0 }).detectedOptions[0], 'A');
  }
  fs.mkdirSync(path.join(root, '.expo/benchmarks'), { recursive: true });
  fs.writeFileSync(path.join(root, `.expo/benchmarks/${baseline ? 'before' : 'after'}.json`), JSON.stringify(report, null, 2));
}
module.exports = { load, buffers };
if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
