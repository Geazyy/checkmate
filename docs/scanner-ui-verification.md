# Scanner and UI Verification

Updated September 8, 2026. Expo remains **57.0.9**. Runtime dependencies were not upgraded.

## Audit and Changes

- The existing light clay theme, navigation, exam editing, classes, answer keys, sheet generator and stored records were retained. Shared theme tokens, focus/disabled states and 44-pixel touch targets now cover the main screens. Settings adds persisted confidence and flagged-region preferences.
- The camera previously filled a tall screen while the captured image used `contain`, creating a visible change in framing. Both now occupy the same measured viewport. Native capture requests a 4:3 picture at zero zoom; web preview and capture use the video stream's actual aspect ratio without cropping.
- Header, guidance, shutter, torch and photo controls sit outside the image. Capture, image preparation and recognition have busy states. Retake, rotation and cancellation remain available where safe.
- Native capture retains Expo orientation processing. Unexpected landscape output from a portrait camera is rotated before preview; gallery EXIF is rendered into pixels. A visible rotate action handles exceptional orientations, and scanning no longer silently changes the confirmed orientation. Android sensor-specific behavior still needs a physical-device test.
- Native picture-size selection prefers a supported 4:3 image with at least 1200 pixels across the shorter edge. Gallery preparation caps the long edge at 2048. Analysis keeps its existing 900-pixel width limit and additionally caps tall crops at 1600 pixels high, avoiding unnecessarily oversized 25-question crops.
- Connected-component processing avoids per-pixel neighbor allocations. Lighting normalization uses integer integral buffers and cached window bounds. JPEG decoding omits the unused alpha channel. Cooperative work slices allow progress and cancellation between chunks; JPEG decode itself is still synchronous.
- Both single- and two-column grids receive validated perspective correction. Single-column detection consistently selects the first complete bubble group. A fallback reuses existing components for fragmented low-resolution outlines. Ambiguous geometry is rejected instead of producing a score.
- Shared layout support covers 10, 20, 25, 30, 40 and 50 questions with A-D or A-E. Detection remains independent of the answer key. Review uses the key belonging to the result's exam, and new captures no longer receive a fabricated student identity.

## Reproducible Comparison

Baseline: git revision `0532c3e`. The benchmark defaults to this fixed revision because an `Update UI` commit was created during the work. `OMR_BASELINE_REF` can select a different baseline.

These are **desktop fixture-analysis timings**, not Android camera timings. Sharp substitutes for the native image-input adapter; the actual TypeScript detector and jpeg-js decoder are exercised. Old and new engines alternate, with one warmup and seven measured runs per fixture. Values below are medians in milliseconds; device load can affect them.

| Fixture | Before | After | Correct detections before / after |
| --- | ---: | ---: | --- |
| 50, captured | 423 | 428 | 50/50 / 50/50 |
| 50, dark | 387 | 417 | 50/50 / 50/50 |
| 50, bright | 411 | 424 | 50/50 / 50/50 |
| 50, rotated | 413 | 391 | 50/50 / 50/50 |
| 50, reduced | 400 | 392 | 50/50 / 50/50 |
| 50, slight crop | 415 | 436 | 50/50 / 50/50 |
| 50, slight blur | 446 | 487 | 50/50 / 50/50 |
| 25, left-column crop | 669 | 428 | 12/25 / 25/25 |
| 25, full 50-item photo | 487 | 514 | 17/25 / 25/25 |

The cropped 25-item case is about **36% faster**. Across the seven 50-item variants, the median is **413 ms before versus 424 ms after**, about 3% slower. Bubble discovery improves (61 to 30 ms on the clear fixture), but yields, image work and validation offset the savings. There is **no demonstrated overall 50-item speedup**. The full-photo 25-item path now performs perspective correction and returns the correct column, with a small time increase.

All 400 expected photo-fixture answers match after the changes. These are variants of one existing real-photo fixture, not 400 independent photographed sheets. Expected answers were visually transcribed independently of both the detector and answer key.

## Browser Stage Timings

Four development-browser runs used a simulated camera stream containing a generated 25-item sheet. These measure the real web image path and review navigation, not a physical camera. Median stage durations:

| Stage | Milliseconds |
| --- | ---: |
| Read image dimensions | 4.7 |
| Orientation/render/resize/encode, fused operation | 327.5 |
| Read image bytes | 4.1 |
| JPEG decode | 205.3 |
| Grayscale | 16.4 |
| Lighting normalization, both passes | 149.8 |
| Locate bubble grid | 72.4 |
| Perspective correction | 45.5 |
| Sample bubbles | 1.3 |
| Classify marks | 1.1 |
| Score and dispatch review draft | 0.9 |
| First review animation frame | 251.3 |
| Total to first review frame | 1202.8 |

Totals range from 0.92 to 1.51 seconds. Individual stage medians do not sum to the median total. `saveResultsMs` measures scoring/draft dispatch and the existing persistence middleware, not confirmed durable database completion. Confirmed grading still uses the existing Grade Answers action. Orientation and resize share an Expo render job and are not independently timed. Review-frame timing does not guarantee every image has finished painting.

## Verification

- TypeScript: passed.
- Lint: zero errors, nine warnings (mostly existing unused helpers/type conventions, plus intentional camera-generation cleanup). ESLint 9.39.5 is used because the installed React/import plugins reject ESLint 10.
- Photo regression suite: all nine fixtures pass; cancelled scans, a 50-item photo under a 40-item exam, and camera frame/picture-size selection are checked.
- Generated sheets: all six supported counts with both choice sets, plus uniformly blank and uniformly A-marked 25-item sheets, pass. Blank and multiple cases are included; low-confidence classification is tested separately.
- Print regression: 18 A4/Letter combinations, 10/20/25 questions and one/two/four copies, produce exactly one page with correct dimensions and no clipped bubbles. A4 and Letter four-copy PDFs were rendered with Poppler and inspected. Printing code and the shared printed geometry were not changed.
- Browser UI: Home, Exams, Classes, Settings, Generator and Answer Key have no page overflow at 320, 390, 768 and 1280 pixels. Capture and captured-photo frame bounds are identical at all four widths; guidance stays outside the photo. Review, manual corrections, retake and one analysis per double-click pass without browser runtime errors.
- Existing user data was not reset. Browser tests use an isolated context and do not confirm/save test scans into the user's session.

## Remaining Limits

- No Android device was attached in `adb devices -l`. Galaxy A05 orientation, field of view, focus, torch, capture latency and on-device recognition remain unverified. Reload the Expo Go project, select an exam, photograph the upright sheet, confirm framing, then use the photo and review results. Test both a new capture and a gallery image.
- Geometry currently locates the answer grid, not a separately detected physical paper boundary. The old fiducial helpers were already unused. A dedicated paper-edge detector is still future work; no separate paper-detection timing is claimed.
- Difficult blur, heavy shadows, steep angles and arbitrary handwriting are not guaranteed. Retake and manual correction remain necessary. No answer is changed to match the key.
- Cooperative cancellation cannot interrupt a native image job or synchronous jpeg-js decode midway. Moving decode/analysis to a native or worker runtime is the next substantial performance task, requiring Android profiling first.
- The online Expo check was blocked by an approval-service credit error. A local check against the installed Expo manifest found one pre-existing mismatch: `react-native-svg` 15.15.5 versus the manifest's 15.15.4. It was not silently downgraded. This should be resolved and Expo validation repeated before a release.

## Commands and Outputs

Main implementation files: `src/app/scan/index.tsx`, `src/components/scanner/CameraOverlay.tsx`, `src/services/omr/captureGeometry.ts`, `src/services/omr/imageScanner.ts`, `src/services/omr/sheetLayout.ts`, `src/services/omr/scanTiming.ts`, and `src/app/scan/review.tsx`. Shared UI changes are in `src/constants/theme.ts`, `src/components/common/Controls.tsx`, `Header.tsx`, `AppShell.tsx`, and the existing app screens. Settings uses `src/app/settings.tsx` and `src/store/useSettingsStore.ts`. Development configuration adds `eslint.config.js` and the lint dependencies in package.json/package-lock.json.

Run `npx tsc --noEmit`, `npm run lint`, `node scripts/benchmark-omr.cjs`, `node scripts/benchmark-omr.cjs --compare`, `node scripts/test-sheet-layouts.cjs`, and `node scripts/test-scanner-ui.cjs` (with Metro running). The UI script also accepts `--scanner-only`.

QA scripts require Sharp, Playwright and pdf-lib, either installed as development tools or exposed through `CHECKMATE_TOOLS`, the path to a tools node_modules directory. They use system Microsoft Edge. This workspace used the bundled Codex dependencies; no runtime camera package was added. Results, PDFs and screenshots are generated under ignored `.expo/benchmarks/`.

Versioned APIs reviewed: [Expo 57](https://docs.expo.dev/versions/v57.0.0/), [Camera](https://docs.expo.dev/versions/v57.0.0/sdk/camera/), and [ImageManipulator](https://docs.expo.dev/versions/v57.0.0/sdk/imagemanipulator/).
