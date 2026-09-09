import { Image, Platform } from 'react-native';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';

import { AnswerDetectionStatus, BubbleAnalysisResult, OptionCount, QuestionCount } from '../../types';
import { OPTION_LETTERS } from './scannerEngine';
import { OMR_CANONICAL_SIZE, OMR_ROWS_PER_COLUMN, getScannerSheetLayout } from './sheetLayout';
import { createScanTimer, scanStage, ScanProgress, ScanTimings, yieldScanWork } from './scanTiming';

const ANALYSIS_WIDTH = 900;
const ANALYSIS_MAX_HEIGHT = 1600;
const SCAN_WORK_SLICE_MS = 32;
const NORMALIZED_WIDTH = OMR_CANONICAL_SIZE.width;
const NORMALIZED_HEIGHT = OMR_CANONICAL_SIZE.height;
export const OMR_SCANNER_REVISION = '2026-09-09.2';

export const IMAGE_OMR_CONFIG = {
  localContrastRadius: 28,
  localContrastStrength: 2.6,
  normalizedPaperLevel: 225,
  componentThreshold: 185,
  componentFallbackThresholds: [165, 145],
  colorNoiseAllowance: 40,
  colorInkStrength: 1.2,
  sampleRadiusRatio: 0.44,
  minimumMarkScore: 0.24,
  confidentMarkScore: 0.38,
  multipleMarkScore: 0.3,
  minimumMultipleCoverage: 0.45,
  markCoverageRadiusScale: 1.35,
  markCoverageInnerRatio: 0.6,
  markCoverageThreshold: 165,
  minimumSeparation: 0.1,
  minimumGeometryConfidence: 0.82,
  maximumBubbleSizeVariation: 0.45,
  maximumPrintedBaseline: 0.8,
  joinedBubbleMinimumHeight: 1.6,
  joinedBubbleMaximumPitch: 1.6,
  joinedBubbleCutSearch: 0.18,
  joinedBubbleMaximumBridge: 0.35,
} as const;

type GrayImage = { data: Uint8Array; width: number; height: number };
type Point = { x: number; y: number };
type Component = Point & { width: number; height: number; area: number };
type BubbleGrid = {
  xCenters: number[];
  yCenters: number[];
  radius: number;
  rowXCenters?: number[][];
  rowRadii?: number[];
};

export interface OmrImageAnalysis {
  timings: ScanTimings;
  originalImageUri: string;
  results: BubbleAnalysisResult[];
  previewImageUri: string;
  canonicalImageUri?: string;
  geometry: {
    mode: 'partial-grid' | 'bubble-grid' | 'corner-markers';
    confidence: number;
    sourceWidth: number;
    sourceHeight: number;
    canonicalWidth: number;
    canonicalHeight: number;
  };
}

export class OmrScanError extends Error {
  constructor(message: string, public readonly details?: {
    detectedRows: number;
    expectedRows: number;
    sourceWidth: number;
    sourceHeight: number;
  }) {
    super(message);
    this.name = 'OmrScanError';
  }
}

async function readImageBytes(uri: string) {
  if (Platform.OS === 'web') {
    return new Uint8Array(await (await fetch(uri)).arrayBuffer());
  }
  return new File(uri).bytes();
}

async function loadSmallGrayscaleImage(uri: string, timer: ReturnType<typeof createScanTimer>, preserveOrientation = false): Promise<GrayImage & { uri: string; markData: Uint8Array }> {
  const dimensions = await timer.measure('loadImageMs', () => new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  }));
  const context = ImageManipulator.manipulate(uri);
  // Expo normalizes EXIF when rendering. Rotation and resize are one native job.
  if (!preserveOrientation && dimensions.width > dimensions.height) context.rotate(90);
  const rotates = !preserveOrientation && dimensions.width > dimensions.height;
  const aspect = rotates ? dimensions.height / dimensions.width : dimensions.width / dimensions.height;
  context.resize({ width: Math.min(ANALYSIS_WIDTH, Math.round(ANALYSIS_MAX_HEIGHT * aspect)) });
  const resized = await timer.measure('orientationAndResizeMs', async () => {
    try {
      const rendered = await context.renderAsync();
      try { return await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 }); }
      finally { rendered.release(); }
    } finally { context.release(); }
  });
  const bytes = await timer.measure('readImageBytesMs', () => readImageBytes(resized.uri));
  const decoded = await timer.measure('decodeImageMs', () => decode(bytes, {
    useTArray: true,
    formatAsRGBA: false,
    tolerantDecoding: true,
    maxResolutionInMP: 3,
    maxMemoryUsageInMB: 96,
  }));
  return timer.measure('grayscaleMs', () => {
  const gray = new Uint8Array(decoded.width * decoded.height);
  const markData = new Uint8Array(gray.length);

  for (let pixel = 0, rgb = 0; pixel < gray.length; pixel++, rgb += 3) {
    gray[pixel] = Math.round(
      decoded.data[rgb] * 0.299 +
        decoded.data[rgb + 1] * 0.587 +
        decoded.data[rgb + 2] * 0.114
    );
    const chroma = Math.max(decoded.data[rgb], decoded.data[rgb + 1], decoded.data[rgb + 2])
      - Math.min(decoded.data[rgb], decoded.data[rgb + 1], decoded.data[rgb + 2]);
    // Keep neutral paper/graphite unchanged; saturated pencil ink needs its own contrast.
    markData[pixel] = Math.max(0, gray[pixel] - Math.max(0, chroma - IMAGE_OMR_CONFIG.colorNoiseAllowance) * IMAGE_OMR_CONFIG.colorInkStrength);
  }

  return { data: gray, markData, width: decoded.width, height: decoded.height, uri: resized.uri };
  });
}

async function normalizeLighting(image: GrayImage, signal?: AbortSignal): Promise<GrayImage> {
  let lastYield = performance.now();
  const { data, width, height } = image;
  const stride = width + 1;
  const integral = new Uint32Array(stride * (height + 1));
  for (let y = 1; y <= height; y++) {
    if ((y & 31) === 0 && performance.now() - lastYield > SCAN_WORK_SLICE_MS) { await yieldScanWork(signal); lastYield = performance.now(); }
    let rowSum = 0;
    const sourceRow = (y - 1) * width;
    const currentRow = y * stride;
    const previousRow = currentRow - stride;
    for (let x = 1; x <= width; x++) {
      rowSum += data[sourceRow + x - 1];
      integral[currentRow + x] = integral[previousRow + x] + rowSum;
    }
  }

  const output = new Uint8Array(data.length);
  const radius = IMAGE_OMR_CONFIG.localContrastRadius;
  const leftEdges = new Uint32Array(width);
  const rightEdges = new Uint32Array(width);
  const windowWidths = new Uint32Array(width);
  for (let x = 0; x < width; x++) {
    leftEdges[x] = Math.max(0, x - radius);
    rightEdges[x] = Math.min(width - 1, x + radius) + 1;
    windowWidths[x] = rightEdges[x] - leftEdges[x];
  }
  for (let y = 0; y < height; y++) {
    if ((y & 31) === 0 && performance.now() - lastYield > SCAN_WORK_SLICE_MS) { await yieldScanWork(signal); lastYield = performance.now(); }
    const top = Math.max(0, y - radius);
    const bottom = Math.min(height - 1, y + radius);
    const lowerRow = (bottom + 1) * stride;
    const upperRow = top * stride;
    const areaHeight = bottom - top + 1;
    const imageRow = y * width;
    for (let x = 0; x < width; x++) {
      const left = leftEdges[x];
      const right = rightEdges[x];
      const area = windowWidths[x] * areaHeight;
      const sum = integral[lowerRow + right]
        - integral[upperRow + right]
        - integral[lowerRow + left]
        + integral[upperRow + left];
      const localMean = sum / area;
      output[imageRow + x] = Math.max(
        0,
        Math.min(
          255,
          IMAGE_OMR_CONFIG.normalizedPaperLevel
            + (data[imageRow + x] - localMean) * IMAGE_OMR_CONFIG.localContrastStrength
        )
      );
    }
  }
  return { data: output, width, height };
}

async function findComponents(
  image: GrayImage,
  threshold: number,
  bounds: { left: number; top: number; right: number; bottom: number },
  signal?: AbortSignal
) {
  let lastYield = performance.now();
  const { data, width } = image;
  const left = Math.max(1, Math.floor(bounds.left));
  const right = Math.min(width - 1, Math.ceil(bounds.right));
  const top = Math.max(1, Math.floor(bounds.top));
  const bottom = Math.min(image.height - 1, Math.ceil(bounds.bottom));
  const visited = new Uint8Array(width * image.height);
  const queue = new Int32Array(width * image.height);
  const components: Component[] = [];

  for (let y = top; y < bottom; y++) {
    if ((y & 31) === 0 && performance.now() - lastYield > SCAN_WORK_SLICE_MS) { await yieldScanWork(signal); lastYield = performance.now(); }
    for (let x = left; x < right; x++) {
      const start = y * width + x;
      if (visited[start] || data[start] > threshold) continue;

      let head = 0;
      let tail = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      visited[start] = 1;
      queue[tail++] = start;

      while (head < tail) {
        if ((head & 8191) === 0 && performance.now() - lastYield > SCAN_WORK_SLICE_MS) { await yieldScanWork(signal); lastYield = performance.now(); }
        const index = queue[head++];
        const px = index % width;
        const py = Math.floor(index / width);
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);

        if (px > left && !visited[index - 1] && data[index - 1] <= threshold) {
          visited[index - 1] = 1; queue[tail++] = index - 1;
        }
        if (px + 1 < right && !visited[index + 1] && data[index + 1] <= threshold) {
          visited[index + 1] = 1; queue[tail++] = index + 1;
        }
        if (py > top && !visited[index - width] && data[index - width] <= threshold) {
          visited[index - width] = 1; queue[tail++] = index - width;
        }
        if (py + 1 < bottom && !visited[index + width] && data[index + width] <= threshold) {
          visited[index + width] = 1; queue[tail++] = index + width;
        }
      }

      const componentWidth = maxX - minX + 1;
      const componentHeight = maxY - minY + 1;
      if (tail >= 8) {
        components.push({
          x: (minX + maxX) / 2,
          y: (minY + maxY) / 2,
          width: componentWidth,
          height: componentHeight,
          area: tail,
        });
      }
    }
  }

  return components;
}

async function findFiducials(image: GrayImage): Promise<Component[] | undefined> {
  const components = (await findComponents(image, 135, {
    left: 0,
    top: 0,
    right: image.width,
    bottom: image.height,
  })).filter((component) => {
    const ratio = component.width / component.height;
    return (
      component.width >= 10 &&
      component.width <= image.width * 0.09 &&
      component.height >= 10 &&
      component.height <= image.width * 0.09 &&
      ratio >= 0.68 &&
      ratio <= 1.45 &&
      component.area / (component.width * component.height) >= 0.62
    );
  });

  const corners = [
    { x: 0, y: 0 },
    { x: image.width, y: 0 },
    { x: image.width, y: image.height },
    { x: 0, y: image.height },
  ];
  const selected = corners.map((corner, cornerIndex) => {
    const candidates = components.filter((component) => {
      const isLeft = component.x < image.width / 2;
      const isTop = component.y < image.height / 2;
      return isLeft === (cornerIndex === 0 || cornerIndex === 3) && isTop === (cornerIndex < 2);
    });
    return candidates.sort((a, b) => {
      const distanceA = Math.hypot(a.x - corner.x, a.y - corner.y);
      const distanceB = Math.hypot(b.x - corner.x, b.y - corner.y);
      return distanceA / Math.sqrt(a.area) - distanceB / Math.sqrt(b.area);
    })[0];
  });

  if (selected.some((point) => !point)) return undefined;

  const [topLeft, topRight, bottomRight, bottomLeft] = selected as Component[];
  const sizes = selected.map((point) => (point!.width + point!.height) / 2);
  const horizontalSpan = Math.min(
    Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y),
    Math.hypot(bottomRight.x - bottomLeft.x, bottomRight.y - bottomLeft.y)
  );
  const verticalSpan = Math.min(
    Math.hypot(bottomLeft.x - topLeft.x, bottomLeft.y - topLeft.y),
    Math.hypot(bottomRight.x - topRight.x, bottomRight.y - topRight.y)
  );
  if (
    horizontalSpan < image.width * 0.48 ||
    verticalSpan < image.height * 0.42 ||
    Math.max(...sizes) / Math.max(1, Math.min(...sizes)) > 1.7
  ) return undefined;
  return [topLeft, topRight, bottomRight, bottomLeft];
}

function solveLinearSystem(matrix: number[][], values: number[]) {
  const size = values.length;
  const augmented = matrix.map((row, index) => [...row, values[index]]);
  for (let column = 0; column < size; column++) {
    let pivot = column;
    for (let row = column + 1; row < size; row++) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    if (Math.abs(divisor) < 1e-9) throw new OmrScanError('The photographed sheet angle is too steep.');
    for (let entry = column; entry <= size; entry++) augmented[column][entry] /= divisor;
    for (let row = 0; row < size; row++) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let entry = column; entry <= size; entry++) {
        augmented[row][entry] -= factor * augmented[column][entry];
      }
    }
  }
  return augmented.map((row) => row[size]);
}

function destinationToSourceHomography(points: Point[], targets: Point[] = [
    { x: 0, y: 0 },
    { x: NORMALIZED_WIDTH - 1, y: 0 },
    { x: NORMALIZED_WIDTH - 1, y: NORMALIZED_HEIGHT - 1 },
    { x: 0, y: NORMALIZED_HEIGHT - 1 },
  ]) {
  const equations: number[][] = [];
  const values: number[] = [];
  targets.forEach(({ x, y }, index) => {
    const source = points[index];
    equations.push([x, y, 1, 0, 0, 0, -source.x * x, -source.x * y]);
    values.push(source.x);
    equations.push([0, 0, 0, x, y, 1, -source.y * x, -source.y * y]);
    values.push(source.y);
  });
  return solveLinearSystem(equations, values);
}

async function rectify(image: GrayImage, anchors: Point[], targets?: Point[], signal?: AbortSignal) {
  let lastYield = performance.now();
  const h = destinationToSourceHomography(anchors, targets);
  const output = new Uint8Array(NORMALIZED_WIDTH * NORMALIZED_HEIGHT);
  output.fill(255);
  for (let y = 0; y < NORMALIZED_HEIGHT; y++) {
    if ((y & 31) === 0 && performance.now() - lastYield > SCAN_WORK_SLICE_MS) { await yieldScanWork(signal); lastYield = performance.now(); }
    for (let x = 0; x < NORMALIZED_WIDTH; x++) {
      const denominator = h[6] * x + h[7] * y + 1;
      const sx = Math.round((h[0] * x + h[1] * y + h[2]) / denominator);
      const sy = Math.round((h[3] * x + h[4] * y + h[5]) / denominator);
      if (sx >= 0 && sx < image.width && sy >= 0 && sy < image.height) {
        output[y * NORMALIZED_WIDTH + x] = image.data[sy * image.width + sx];
      }
    }
  }
  return {
    image: { data: output, width: NORMALIZED_WIDTH, height: NORMALIZED_HEIGHT },
    destinationToSource: h,
  };
}

function mapPoint(h: number[], point: Point) {
  const denominator = h[6] * point.x + h[7] * point.y + 1;
  return {
    x: (h[0] * point.x + h[1] * point.y + h[2]) / denominator,
    y: (h[3] * point.x + h[4] * point.y + h[5]) / denominator,
  };
}

function clusterValues(values: number[], count: number, minimumGap: number) {
  const histogram = new Map<number, number>();
  values.forEach((value) => {
    const bin = Math.round(value / 2) * 2;
    histogram.set(bin, (histogram.get(bin) || 0) + 1);
  });
  return [...histogram.entries()]
    .sort((a, b) => b[1] - a[1])
    .reduce<number[]>((chosen, [value]) => {
      if (chosen.length < count && chosen.every((existing) => Math.abs(existing - value) >= minimumGap)) {
        chosen.push(value);
      }
      return chosen;
    }, [])
    .sort((a, b) => a - b);
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function selectRegularBubbleRun(items: Component[], optionsCount: number, typicalDiameter: number) {
  const sorted = [...items].sort((a, b) => a.x - b.x);

  for (let start = 0; start <= sorted.length - optionsCount; start++) {
    const run = sorted.slice(start, start + optionsCount);
    const gaps = run.slice(1).map((item, index) => item.x - run[index].x);
    const averageGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    if (averageGap < typicalDiameter * 0.85) continue;
    const gapDeviation = Math.sqrt(
      gaps.reduce((sum, gap) => sum + (gap - averageGap) ** 2, 0) / gaps.length
    );
    const diameters = run.map((item) => (item.width + item.height) / 2);
    const sizeError = Math.max(...diameters) / Math.max(1, Math.min(...diameters)) - 1;
    if (sizeError > IMAGE_OMR_CONFIG.maximumBubbleSizeVariation) continue;
    const score = gapDeviation / averageGap + sizeError * 0.3;
    if (Math.max(...gaps) / Math.max(1, Math.min(...gaps)) > 1.8) continue;
    // A 25-item crop may still show the second column. Keep the first complete run consistently.
    if (score <= 0.32) return run;
  }

  return undefined;
}

type DetectedBubbleRow = { y: number; bubbles: Component[]; radius: number };

function regularBubbleRuns(items: Component[], optionsCount: number, typicalDiameter: number) {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const runs: Array<{ items: Component[]; averageGap: number; score: number }> = [];
  for (let start = 0; start <= sorted.length - optionsCount; start++) {
    const run = sorted.slice(start, start + optionsCount);
    const gaps = run.slice(1).map((item, index) => item.x - run[index].x);
    const averageGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    if (averageGap < typicalDiameter * 0.9 || averageGap > typicalDiameter * 4.8) continue;
    const deviation = Math.sqrt(
      gaps.reduce((sum, gap) => sum + (gap - averageGap) ** 2, 0) / gaps.length
    ) / averageGap;
    if (deviation <= 0.26 && Math.max(...gaps) / Math.max(1, Math.min(...gaps)) <= 1.55) {
      runs.push({ items: run, averageGap, score: deviation });
    }
  }
  return runs.sort((a, b) => a.score - b.score);
}

function selectTwoBubbleRuns(items: Component[], optionsCount: number, typicalDiameter: number) {
  const runs = regularBubbleRuns(items, optionsCount, typicalDiameter);
  let best: { bubbles: Component[]; score: number } | undefined;
  for (let leftIndex = 0; leftIndex < runs.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < runs.length; rightIndex++) {
      const first = runs[leftIndex];
      const second = runs[rightIndex];
      const left = first.items[0].x < second.items[0].x ? first : second;
      const right = left === first ? second : first;
      if (left.items[left.items.length - 1].x >= right.items[0].x) continue;
      const columnGap = right.items[0].x - left.items[left.items.length - 1].x;
      if (columnGap < Math.min(left.averageGap, right.averageGap) * 1.6) continue;
      const spacingMismatch = Math.abs(left.averageGap - right.averageGap)
        / Math.max(left.averageGap, right.averageGap);
      if (spacingMismatch > 0.24) continue;
      const score = left.score + right.score + spacingMismatch;
      if (!best || score < best.score) best = { bubbles: [...left.items, ...right.items], score };
    }
  }
  return best?.bubbles;
}

function chooseRegularRows(rows: DetectedBubbleRow[], expectedRows: number) {
  if (rows.length < expectedRows) return [];
  let bestRows = rows.slice(0, expectedRows);
  let bestScore = Number.POSITIVE_INFINITY;
  for (let start = 0; start <= rows.length - expectedRows; start++) {
    const window = rows.slice(start, start + expectedRows);
    const gaps = window.slice(1).map((row, index) => row.y - window[index].y);
    const typicalGap = median(gaps);
    const spacingError = gaps.reduce((sum, gap) => sum + Math.abs(gap - typicalGap), 0)
      / Math.max(1, typicalGap * gaps.length);
    const sizeError = Math.max(...window.map((row) => row.radius))
      / Math.max(1, Math.min(...window.map((row) => row.radius))) - 1;
    const score = spacingError + sizeError * 0.25;
    if (score < bestScore) {
      bestRows = window;
      bestScore = score;
    }
  }
  return bestScore <= 0.34 ? bestRows : [];
}

async function discoverTwoColumnBubbleGrid(
  image: GrayImage,
  optionsCount: number,
  rowsPerColumn: number,
  signal?: AbortSignal
): Promise<BubbleGrid> {
  const rawCandidates = (await findComponents(image, IMAGE_OMR_CONFIG.componentThreshold, {
    left: image.width * 0.04,
    top: image.height * 0.05,
    right: image.width * 0.96,
    bottom: image.height * 0.96,
  }, signal)).filter((component) => {
    const ratio = component.width / component.height;
    const maximumSize = Math.min(70, image.width * 0.085);
    return component.width >= 8 && component.width <= maximumSize
      && component.height >= 8 && component.height <= maximumSize
      && ratio >= 0.62 && ratio <= 1.55 && component.area >= 14;
  });
  const estimatedDiameter = median(rawCandidates.map((item) => (item.width + item.height) / 2)
    .sort((a, b) => b - a).slice(0, rowsPerColumn * optionsCount * 2));
  if (!estimatedDiameter) {
    throw new OmrScanError('No answer bubbles were found. Move closer and keep the complete sheet visible.');
  }
  const collectRows = (diameter: number, minimumDiameter: number) => {
  const duplicateDistance = Math.max(4, diameter * 0.34);
  const candidates = [...rawCandidates]
    .filter((item) => (item.width + item.height) / 2 >= minimumDiameter)
    .sort((a, b) => b.width * b.height - a.width * a.height)
    .reduce<Component[]>((chosen, item) => {
      if (!chosen.some((existing) => Math.hypot(existing.x - item.x, existing.y - item.y) < duplicateDistance)) {
        chosen.push(item);
      }
      return chosen;
    }, []);
  const typicalDiameter = median(candidates.map((item) => (item.width + item.height) / 2));
  const rowTolerance = Math.max(7, typicalDiameter * 0.58);
  const groups: Component[][] = [];
  [...candidates].sort((a, b) => a.y - b.y).forEach((candidate) => {
    let nearest: Component[] | undefined;
    let distance = Number.POSITIVE_INFINITY;
    groups.forEach((group) => {
      const center = group.reduce((sum, item) => sum + item.y, 0) / group.length;
      const candidateDistance = Math.abs(center - candidate.y);
      if (candidateDistance <= rowTolerance && candidateDistance < distance) {
        nearest = group;
        distance = candidateDistance;
      }
    });
    if (nearest) nearest.push(candidate);
    else groups.push([candidate]);
  });
  return groups.map((group) => {
    const bubbles = selectTwoBubbleRuns(group, optionsCount, typicalDiameter);
    if (!bubbles) return undefined;
    return {
      y: median(bubbles.map((item) => item.y)),
      bubbles,
      radius: Math.max(4, median(bubbles.map((item) => (item.width + item.height) / 2)) * 0.28),
    };
  }).filter((row): row is DetectedBubbleRow => Boolean(row)).sort((a, b) => a.y - b.y);
  };
  let detectedRows = collectRows(estimatedDiameter, estimatedDiameter * 0.65);
  if (detectedRows.length !== rowsPerColumn || chooseRegularRows(detectedRows, rowsPerColumn).length !== rowsPerColumn) {
    // Reuse components for low-resolution outlines whose rings split into smaller fragments.
    const fallback = collectRows(median(rawCandidates.map((item) => (item.width + item.height) / 2)), 0);
    if (fallback.length === rowsPerColumn && chooseRegularRows(fallback, rowsPerColumn).length === rowsPerColumn) detectedRows = fallback;
  }
  const rows = chooseRegularRows(detectedRows, rowsPerColumn);
  if (rows.length !== rowsPerColumn || detectedRows.length !== rowsPerColumn) {
    throw new OmrScanError(
      `Answer-sheet alignment failed. Found ${detectedRows.length} of ${rowsPerColumn} complete rows with both columns. Retake the photo with the full sheet visible.`
    );
  }
  const expectedPerRow = optionsCount * 2;
  if (rows.some((row) => row.bubbles.length !== expectedPerRow)) {
    throw new OmrScanError('Answer-sheet alignment failed. Every row must contain both A-D bubble groups.');
  }
  return {
    xCenters: [],
    yCenters: rows.map((row) => row.y),
    radius: median(rows.map((row) => row.radius)),
    rowXCenters: rows.map((row) => row.bubbles.map((item) => item.x)),
    rowRadii: rows.map((row) => row.radius),
  };
}

async function discoverPartialBubbleGrid(
  image: GrayImage,
  optionsCount: number,
  rowsPerColumn: number,
  signal?: AbortSignal,
  joinedComponents?: Component[],
  threshold: number = IMAGE_OMR_CONFIG.componentThreshold
): Promise<BubbleGrid> {
  const components = joinedComponents ?? await findComponents(image, threshold, {
    left: image.width * 0.08,
    top: image.height * 0.02,
    right: image.width * 0.99,
    bottom: image.height * 0.99,
  }, signal);
  const rawCandidates = components.filter((component) => {
    const ratio = component.width / component.height;
    const maximumSize = Math.min(95, image.width * 0.13);
    return (
      component.width >= 8 &&
      component.width <= maximumSize &&
      component.height >= 8 &&
      component.height <= maximumSize &&
      ratio >= 0.62 &&
      ratio <= 1.55 &&
      component.area >= 14
    );
  });

  const estimatedDiameter = median(
    rawCandidates.map((item) => (item.width + item.height) / 2)
      .sort((a, b) => b - a).slice(0, rowsPerColumn * optionsCount)
  );
  const duplicateDistance = Math.max(5, estimatedDiameter * 0.38);
  const candidates = [...rawCandidates]
    .filter((item) => (item.width + item.height) / 2 >= estimatedDiameter * 0.65)
    .sort((a, b) => b.width * b.height - a.width * a.height)
    .reduce<Component[]>((chosen, item) => {
      const duplicate = chosen.some(
        (existing) => Math.hypot(existing.x - item.x, existing.y - item.y) < duplicateDistance
      );
      if (!duplicate) chosen.push(item);
      return chosen;
    }, []);

  const typicalDiameter = median(candidates.map((item) => (item.width + item.height) / 2));
  const rowTolerance = Math.max(8, typicalDiameter * 0.58);
  const rowGroups: Component[][] = [];

  [...candidates]
    .sort((a, b) => a.y - b.y)
    .forEach((candidate) => {
      let nearest: Component[] | undefined;
      let nearestDistance = Number.POSITIVE_INFINITY;
      rowGroups.forEach((group) => {
        const center = group.reduce((sum, item) => sum + item.y, 0) / group.length;
        const distance = Math.abs(center - candidate.y);
        if (distance < nearestDistance && distance <= rowTolerance) {
          nearest = group;
          nearestDistance = distance;
        }
      });
      if (nearest) nearest.push(candidate);
      else rowGroups.push([candidate]);
    });

  const detectedRows = rowGroups
    .map((group) => {
      const bubbles = selectRegularBubbleRun(group, optionsCount, typicalDiameter);
      if (!bubbles) return undefined;
      return {
        y: bubbles.reduce((sum, item) => sum + item.y, 0) / bubbles.length,
        bubbles,
        radius: Math.max(
          5,
          median(bubbles.map((item) => (item.width + item.height) / 2))
            * 0.28
        ),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => a.y - b.y);

  const rows = chooseRegularRows(detectedRows, rowsPerColumn);

  if (rows.length !== rowsPerColumn || detectedRows.length !== rowsPerColumn) {
    if (!joinedComponents) {
      await yieldScanWork(signal);
      const separated = splitJoinedBubbleComponents(image, components, rowsPerColumn * optionsCount, threshold);
      return discoverPartialBubbleGrid(image, optionsCount, rowsPerColumn, signal, separated, threshold);
    }
    const nextThreshold = IMAGE_OMR_CONFIG.componentFallbackThresholds.find((value) => value < threshold);
    if (nextThreshold !== undefined) {
      await yieldScanWork(signal);
      return discoverPartialBubbleGrid(image, optionsCount, rowsPerColumn, signal, undefined, nextThreshold);
    }
    throw new OmrScanError(
      detectedRows.length === rowsPerColumn
        ? `Found ${rowsPerColumn} rows, but their spacing could not be aligned. Hold the sheet flat and retake the photo.`
        : `Aligned ${detectedRows.length} of ${rowsPerColumn} answer rows. Keep every question and all A-${optionsCount === 5 ? 'E' : 'D'} circles visible, then retake the photo.`,
      { detectedRows: detectedRows.length, expectedRows: rowsPerColumn, sourceWidth: image.width, sourceHeight: image.height }
    );
  }

  return {
    xCenters: rows[0].bubbles.map((item) => item.x),
    yCenters: rows.map((row) => row.y),
    radius: median(rows.map((row) => row.radius)),
    rowXCenters: rows.map((row) => row.bubbles.map((item) => item.x)),
    rowRadii: rows.map((row) => row.radius),
  };
}

function splitJoinedBubbleComponents(image: GrayImage, components: Component[], expectedBubbles: number, threshold: number) {
  const config = IMAGE_OMR_CONFIG;
  const round = components.filter((c) => c.width >= 8 && c.width <= 95
    && c.height / c.width >= 0.75 && c.height / c.width <= 1.3);
  const diameter = median(round.map((c) => c.width).sort((a, b) => b - a).slice(0, expectedBubbles));
  const bubbles = round.filter((c) => c.width >= diameter * 0.75 && c.width <= diameter * 1.3);
  const gaps = bubbles.flatMap((c) => {
    let nearestGap = Number.POSITIVE_INFINITY;
    for (const other of bubbles) {
      const gap = other.y - c.y;
      if (Math.abs(other.x - c.x) < diameter * 0.4 && gap > diameter * 0.8) {
        nearestGap = Math.min(nearestGap, gap);
      }
    }
    return nearestGap <= diameter * config.joinedBubbleMaximumPitch ? [nearestGap] : [];
  });
  const pitch = median(gaps);
  if (!pitch) return components;
  return components.flatMap((c) => {
    if (c.width < diameter * 0.75 || c.width > diameter * 1.3
      || c.height < diameter * config.joinedBubbleMinimumHeight) return [c];
    const count = Math.round((c.height - diameter) / pitch) + 1;
    if (count < 2 || count > OMR_ROWS_PER_COLUMN) return [c];
    const left = Math.round(c.x - (c.width - 1) / 2);
    const top = Math.round(c.y - (c.height - 1) / 2);
    const bottom = top + c.height;
    const projection = (y: number) => {
      let dark = 0;
      for (let x = left; x < left + c.width; x++) dark += Number(image.data[y * image.width + x] <= threshold);
      return dark;
    };
    const cuts = [top];
    // Only cut weak necks near the measured row pitch, never invent absent circles.
    for (let i = 1; i < count; i++) {
      const expected = top + diameter / 2 + (i - 0.5) * pitch;
      const search = pitch * config.joinedBubbleCutSearch;
      let best = -1;
      let score = Number.POSITIVE_INFINITY;
      for (let y = Math.max(top, Math.ceil(expected - search)); y <= Math.min(bottom - 1, Math.floor(expected + search)); y++) {
        const candidate = projection(y) + Math.abs(y - expected) / pitch;
        if (candidate < score) { score = candidate; best = y; }
      }
      if (best < 0 || projection(best) > diameter * config.joinedBubbleMaximumBridge) return [c];
      cuts.push(best);
    }
    cuts.push(bottom);
    const pieces = cuts.slice(1).map((end, i) => {
      let minX = left + c.width, maxX = left, minY = end, maxY = cuts[i], area = 0;
      for (let y = cuts[i]; y < end; y++) for (let x = left; x < left + c.width; x++) {
        if (image.data[y * image.width + x] > threshold) continue;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y); area++;
      }
      return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, width: maxX - minX + 1, height: maxY - minY + 1, area };
    });
    return pieces.every((piece) => piece.area >= 14 && piece.height >= diameter * 0.6
      && piece.height <= diameter * config.joinedBubbleMaximumPitch && piece.width >= diameter * 0.65) ? pieces : [c];
  });
}

async function discoverBubbleGrid(
  image: GrayImage,
  optionsCount: number,
  rowsPerColumn: number,
  questionColumns: number = 2
): Promise<BubbleGrid> {
  const candidates = (await findComponents(image, 145, {
    left: image.width * (questionColumns === 1 ? 0.22 : 0.12),
    top: image.height * 0.05,
    right: image.width * 0.98,
    bottom: image.height * 0.97,
  })).filter((component) => {
    const ratio = component.width / component.height;
    return (
      component.width >= 10 &&
      component.width <= 55 &&
      component.height >= 10 &&
      component.height <= 55 &&
      ratio >= 0.7 &&
      ratio <= 1.35 &&
      component.area >= 20
    );
  });
  const expectedColumns = optionsCount * questionColumns;
  const xCenters = clusterValues(
    candidates.filter((item) => item.y > image.height * 0.18).map((item) => item.x),
    expectedColumns,
    14
  );
  const yCenters = clusterValues(candidates.map((item) => item.y), rowsPerColumn, 18);

  if (xCenters.length !== expectedColumns || yCenters.length !== rowsPerColumn) {
    throw new OmrScanError(
      `Could not locate the complete ${rowsPerColumn}-row answer grid. Hold the sheet flat, improve the light, and fill the frame.`
    );
  }
  const diameters = candidates
    .filter(
      (item) =>
        xCenters.some((x) => Math.abs(x - item.x) < 5) &&
        yCenters.some((y) => Math.abs(y - item.y) < 5)
    )
    .map((item) => (item.width + item.height) / 2)
    .sort((a, b) => a - b);
  return {
    xCenters,
    yCenters,
    radius: Math.max(5, (diameters[Math.floor(diameters.length / 2)] || 18) * 0.28),
  };
}

function darkRatio(image: GrayImage, centerX: number, centerY: number, radius: number) {
  let dark = 0;
  let total = 0;
  const limit = Math.ceil(radius);
  for (let dy = -limit; dy <= limit; dy++) {
    for (let dx = -limit; dx <= limit; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const x = Math.round(centerX + dx);
      const y = Math.round(centerY + dy);
      if (x < 0 || x >= image.width || y < 0 || y >= image.height) continue;
      dark += Math.max(0, (190 - image.data[y * image.width + x]) / 190);
      total++;
    }
  }
  return total ? dark / total : 0;
}

function markCoverage(image: GrayImage, centerX: number, centerY: number, sampleRadius: number) {
  const radius = sampleRadius * IMAGE_OMR_CONFIG.markCoverageRadiusScale;
  const innerRadius = radius * IMAGE_OMR_CONFIG.markCoverageInnerRatio;
  let dark = 0, total = 0;
  // Sample outside the printed letter, but inside the bubble outline.
  for (let dy = -Math.ceil(radius); dy <= Math.ceil(radius); dy++) {
    for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx++) {
      const distance = dx * dx + dy * dy;
      if (distance > radius * radius || distance < innerRadius * innerRadius) continue;
      const x = Math.round(centerX + dx), y = Math.round(centerY + dy);
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
      dark += Number(image.data[y * image.width + x] < IMAGE_OMR_CONFIG.markCoverageThreshold);
      total++;
    }
  }
  return total ? dark / total : 0;
}

function classifyRatios(ratios: Record<string, number>, coverage?: Record<string, number>) {
  const ranked = Object.entries(ratios)
    .map(([option, ratio]) => ({ option, ratio }))
    .sort((a, b) => b.ratio - a.ratio);
  const strongest = ranked[0];
  const second = ranked[1];
  const marked = ranked.filter((entry) => entry.ratio >= IMAGE_OMR_CONFIG.multipleMarkScore
    && (!coverage || coverage[entry.option] >= IMAGE_OMR_CONFIG.minimumMultipleCoverage));
  const separation = strongest.ratio - second.ratio;
  let status: AnswerDetectionStatus;
  let detectedOptions: string[];

  if (strongest.ratio < IMAGE_OMR_CONFIG.minimumMarkScore) {
    status = 'blank';
    detectedOptions = [];
  } else if (marked.length > 1) {
    status = 'multiple';
    detectedOptions = marked.map((entry) => entry.option);
  } else if (
    strongest.ratio < IMAGE_OMR_CONFIG.confidentMarkScore ||
    separation < IMAGE_OMR_CONFIG.minimumSeparation
  ) {
    status = 'uncertain';
    detectedOptions = [];
  } else {
    status = 'detected';
    detectedOptions = [strongest.option];
  }

  const signalConfidence = Math.max(
    0,
    Math.min(1, (strongest.ratio - IMAGE_OMR_CONFIG.minimumMarkScore) / 0.42)
  );
  const separationConfidence = Math.max(
    0,
    Math.min(1, (separation - 0.04) / 0.42)
  );
  const confidence = status === 'blank'
    ? Math.max(0, Math.min(1, (IMAGE_OMR_CONFIG.minimumMarkScore - strongest.ratio) / 0.18))
    : status === 'multiple'
      ? Math.max(0, Math.min(1, second.ratio / Math.max(strongest.ratio, 0.01)))
      : 0.6 * signalConfidence + 0.4 * separationConfidence;

  return {
    status,
    detectedOptions,
    confidence: Number(confidence.toFixed(2)),
  };
}

function quantile(values: number[], fraction: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * fraction)));
  return sorted[index];
}

function calibrateMarkScores(rawRows: Array<Record<string, number>>, options: string[]) {
  const baselines = Object.fromEntries(options.map((option) => [
    option,
    Math.min(IMAGE_OMR_CONFIG.maximumPrintedBaseline, quantile(rawRows.map((row) => row[option]), 0.32)),
  ]));
  return rawRows.map((row) => Object.fromEntries(options.map((option) => {
    const baseline = baselines[option];
    const score = Math.max(0, Math.min(1, (row[option] - baseline - 0.025) / Math.max(0.28, 0.78 - baseline)));
    return [option, Number(score.toFixed(2))];
  })));
}

function gridGeometryConfidence(grid: BubbleGrid, optionsCount: number, rowsPerColumn = OMR_ROWS_PER_COLUMN, columnCount = 2) {
  const rows = grid.rowXCenters || [];
  if (rows.length !== rowsPerColumn || rows.some((row) => row.length !== optionsCount * columnCount)) return 0;
  const yGaps = grid.yCenters.slice(1).map((y, index) => y - grid.yCenters[index]);
  const expectedYGap = median(yGaps);
  const yError = yGaps.reduce((sum, gap) => sum + Math.abs(gap - expectedYGap), 0)
    / Math.max(1, expectedYGap * yGaps.length);
  const optionGaps = rows.flatMap((row) => [
    ...row.slice(1, optionsCount).map((x, index) => x - row[index]),
    ...row.slice(optionsCount + 1).map((x, index) => x - row[optionsCount + index]),
  ]);
  const expectedOptionGap = median(optionGaps);
  // Reject rows that jump between columns or shift onto question numbers.
  if (rows.some((row, i) => i > 0 && Math.abs(row[0] - rows[i - 1][0]) > expectedOptionGap * 0.65)) return 0;
  const xError = optionGaps.reduce((sum, gap) => sum + Math.abs(gap - expectedOptionGap), 0)
    / Math.max(1, expectedOptionGap * optionGaps.length);
  return Math.max(0, Math.min(1, 1 - yError * 1.8 - xError * 1.3));
}

async function canonicalizeGrid(source: GrayImage, grid: BubbleGrid, signal?: AbortSignal) {
  const rows = grid.rowXCenters!;
  const lastOption = rows[0].length - 1;
  const sourceAnchors = [
    { x: rows[0][0], y: grid.yCenters[0] },
    { x: rows[0][lastOption], y: grid.yCenters[0] },
    { x: rows[rows.length - 1][lastOption], y: grid.yCenters[grid.yCenters.length - 1] },
    { x: rows[rows.length - 1][0], y: grid.yCenters[grid.yCenters.length - 1] },
  ];
  const targets = [
    { x: 92, y: 112 },
    { x: NORMALIZED_WIDTH - 92, y: 112 },
    { x: NORMALIZED_WIDTH - 92, y: NORMALIZED_HEIGHT - 112 },
    { x: 92, y: NORMALIZED_HEIGHT - 112 },
  ];
  const warped = await rectify(source, sourceAnchors, targets, signal);
  const sourceToCanonical = destinationToSourceHomography(targets, sourceAnchors);
  const canonicalRows = rows.map((row, rowIndex) => row.map((x) => mapPoint(sourceToCanonical, {
    x,
    y: grid.yCenters[rowIndex],
  })));
  const rowXCenters = canonicalRows.map((row) => row.map((point) => point.x));
  const yCenters = canonicalRows.map((row) => median(row.map((point) => point.y)));
  const rowRadii = canonicalRows.map((row, rowIndex) => {
    const sourceRadius = grid.rowRadii?.[rowIndex] ?? grid.radius;
    const center = { x: rows[rowIndex][0], y: grid.yCenters[rowIndex] };
    return Math.hypot(
      mapPoint(sourceToCanonical, { x: center.x + sourceRadius, y: center.y }).x
        - mapPoint(sourceToCanonical, center).x,
      mapPoint(sourceToCanonical, { x: center.x, y: center.y + sourceRadius }).y
        - mapPoint(sourceToCanonical, center).y
    ) / 2;
  });
  return {
    image: warped.image,
    grid: {
      xCenters: [],
      yCenters,
      radius: median(rowRadii),
      rowXCenters,
      rowRadii,
    } satisfies BubbleGrid,
  };
}

export async function analyzeAnswerSheetImageDetailed(
  imageUri: string,
  totalQuestions: QuestionCount,
  optionsCount: OptionCount,
  progress: ScanProgress = {}
): Promise<OmrImageAnalysis> {
  const timer = createScanTimer();
  const scannerLayout = getScannerSheetLayout(totalQuestions, optionsCount);
  if (!scannerLayout) {
    throw new OmrScanError('Automatic photo recognition supports 10, 20, 25, 30, 40 and 50 questions.');
  }
  await scanStage('Preparing image', progress);
  const source = await loadSmallGrayscaleImage(imageUri, timer, progress.preserveOrientation);
  if (__DEV__) console.info('[CheckMate OMR start]', JSON.stringify({
    revision: OMR_SCANNER_REVISION, totalQuestions, optionsCount,
    sourceWidth: source.width, sourceHeight: source.height,
  }));
  await scanStage('Finding answer sheet', progress);
  const normalizedSource = await timer.measure('preprocessMs', () => normalizeLighting(source, progress.signal));
  const options = OPTION_LETTERS.slice(0, optionsCount);
  let analysisImage = normalizedSource;
  let analysisGrid: BubbleGrid;
  let sourceGrid: BubbleGrid;
  let mode: OmrImageAnalysis['geometry']['mode'] = 'partial-grid';

  if (scannerLayout.columnCount === 1) {
    sourceGrid = await timer.measure('bubbleDetectionMs', () => discoverPartialBubbleGrid(normalizedSource, optionsCount, scannerLayout.rowsPerColumn, progress.signal));
  } else {
    sourceGrid = await timer.measure('bubbleDetectionMs', () => discoverTwoColumnBubbleGrid(normalizedSource, optionsCount, scannerLayout.rowsPerColumn, progress.signal));
    mode = 'bubble-grid';
  }
  const geometryConfidence = gridGeometryConfidence(sourceGrid, optionsCount, scannerLayout.rowsPerColumn, scannerLayout.columnCount);
  if (geometryConfidence < IMAGE_OMR_CONFIG.minimumGeometryConfidence) {
    throw new OmrScanError('Answer-sheet alignment failed. Please retake the photo with the full answer grid flat and visible.');
  }
  await scanStage('Aligning sheet', progress);
  const canonical = await timer.measure('perspectiveCorrectionMs', () => canonicalizeGrid({ ...source, data: source.markData }, sourceGrid, progress.signal));
  analysisImage = await timer.measure('preprocessMs', () => normalizeLighting(canonical.image, progress.signal));
  analysisGrid = canonical.grid;
  await scanStage('Reading answers', progress);

  const samplingStart = performance.now();
  const rawRows: Array<Record<string, number>> = [];
  for (let question = 1; question <= totalQuestions; question++) {
    const column = scannerLayout.columnCount === 1 ? 0 : Math.floor((question - 1) / scannerLayout.rowsPerColumn);
    const row = (question - 1) % scannerLayout.rowsPerColumn;
    const optionOffset = column * optionsCount;
    const rowCenters = analysisGrid.rowXCenters?.[row];
    rawRows.push(Object.fromEntries(options.map((option, optionIndex) => [
      option,
      darkRatio(
        analysisImage,
        rowCenters?.[optionOffset + optionIndex]
          ?? analysisGrid.xCenters[optionOffset + optionIndex],
        analysisGrid.yCenters[row],
        analysisGrid.rowRadii?.[row] ?? analysisGrid.radius
      ),
    ])));
  }
  timer.timings.bubbleSamplingMs = performance.now() - samplingStart;
  const classificationStart = performance.now();
  const calibratedRows = calibrateMarkScores(rawRows, options);
  const results: BubbleAnalysisResult[] = calibratedRows.map((ratios, questionIndex) => {
    const question = questionIndex + 1;
    const column = scannerLayout.columnCount === 1 ? 0 : Math.floor(questionIndex / scannerLayout.rowsPerColumn);
    const row = questionIndex % scannerLayout.rowsPerColumn;
    const optionOffset = column * optionsCount;
    const sourceRow = sourceGrid.rowXCenters?.[row]
      ?? options.map((_, optionIndex) => sourceGrid.xCenters[optionOffset + optionIndex]);
    const sourceXs = sourceRow.slice(optionOffset, optionOffset + optionsCount);
    const radius = sourceGrid.rowRadii?.[row] ?? sourceGrid.radius;
    const classification = classifyRatios(ratios, Object.fromEntries(options.map((option, index) => [
      option,
      markCoverage(analysisImage, analysisGrid.rowXCenters![row][optionOffset + index],
        analysisGrid.yCenters[row], analysisGrid.rowRadii?.[row] ?? analysisGrid.radius),
    ])));
    const left = Math.max(0, Math.min(...sourceXs) - radius * 1.5);
    const right = Math.min(source.width, Math.max(...sourceXs) + radius * 1.5);
    const top = Math.max(0, sourceGrid.yCenters[row] - radius * 1.7);
    const bottom = Math.min(source.height, sourceGrid.yCenters[row] + radius * 1.7);
    return {
      questionNumber: question,
      detectedOptions: classification.detectedOptions,
      fillRatios: ratios,
      isAmbiguous: classification.status !== 'detected',
      status: classification.status,
      confidence: classification.confidence,
      sourceRegion: {
        x: left / source.width,
        y: top / source.height,
        width: (right - left) / source.width,
        height: (bottom - top) / source.height,
      },
    };
  });
  timer.timings.classificationMs = performance.now() - classificationStart;
  const confidence = geometryConfidence;
  if (__DEV__) {
    console.info('[CheckMate OMR]', JSON.stringify({
      source: `${source.width}x${source.height}`,
      canonical: `${analysisImage.width}x${analysisImage.height}`,
      mode,
      geometryConfidence: Number(confidence.toFixed(3)),
      ...timer.finish(),
    }));
  }
  return {
    timings: timer.finish(),
    originalImageUri: imageUri,
    results,
    previewImageUri: source.uri,
    canonicalImageUri: undefined,
    geometry: {
      mode,
      confidence,
      sourceWidth: source.width,
      sourceHeight: source.height,
      canonicalWidth: analysisImage.width,
      canonicalHeight: analysisImage.height,
    },
  };
}

export async function analyzeAnswerSheetImage(
  imageUri: string,
  totalQuestions: QuestionCount,
  optionsCount: OptionCount
): Promise<BubbleAnalysisResult[]> {
  return (await analyzeAnswerSheetImageDetailed(imageUri, totalQuestions, optionsCount)).results;
}
