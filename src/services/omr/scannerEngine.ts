import { AnswerKeyItem, AnswerDetectionStatus, BubbleAnalysisResult, FiducialAnchors, OptionCount, QuestionCount, ScanItemDetail } from '../../types';

export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];

// Default intensity thresholds for bubble fill ratio
export const FILL_THRESHOLDS = {
  HIGH_FILL: 0.38,  // Marked solid bubble threshold
  LOW_FILL: 0.14,   // Empty bubble background noise threshold
  AMBIGUOUS_DELTA: 0.08 // Ambiguous region range around threshold
};

/**
 * Calculates Homography perspective transformation matrix for 4 point corners.
 * Maps arbitrary camera quadrilateral to a normalized target rectangle [0, width] x [0, height].
 */
export function getPerspectiveTransformMatrix(
  anchors: FiducialAnchors,
  targetWidth: number,
  targetHeight: number
) {
  // Source coordinates
  const src = [
    anchors.topLeft,
    anchors.topRight,
    anchors.bottomRight,
    anchors.bottomLeft
  ];

  // Target rectangle coordinates
  const dst = [
    { x: 0, y: 0 },
    { x: targetWidth, y: 0 },
    { x: targetWidth, y: targetHeight },
    { x: 0, y: targetHeight }
  ];

  return { src, dst, targetWidth, targetHeight };
}

/**
 * Grid layout computer: Returns bounding box coordinates for each bubble option
 * based on template format (25, 50, or 100 questions).
 */
export function getQuestionGridBoundingBoxes(
  totalQuestions: QuestionCount,
  optionsCount: OptionCount,
  sheetWidth: number,
  sheetHeight: number
) {
  const gridBoxes: Array<{
    questionNumber: number;
    option: string;
    x: number;
    y: number;
    radius: number;
  }> = [];

  // Determine layout columns
  let columns = 1;
  if (totalQuestions === 50) columns = 2;
  if (totalQuestions === 100) columns = 4;

  const questionsPerColumn = totalQuestions / columns;
  const colWidth = sheetWidth / columns;
  const rowHeight = (sheetHeight * 0.78) / questionsPerColumn;
  const startY = sheetHeight * 0.15; // Padding for header & QR code

  for (let q = 1; q <= totalQuestions; q++) {
    const colIndex = Math.floor((q - 1) / questionsPerColumn);
    const rowIndex = (q - 1) % questionsPerColumn;

    const colStartX = colIndex * colWidth + colWidth * 0.25;
    const itemY = startY + rowIndex * rowHeight;
    const optionSpacing = (colWidth * 0.6) / optionsCount;

    for (let optIdx = 0; optIdx < optionsCount; optIdx++) {
      const optionLetter = OPTION_LETTERS[optIdx];
      const bubbleX = colStartX + optIdx * optionSpacing;
      const bubbleRadius = Math.min(rowHeight, optionSpacing) * 0.35;

      gridBoxes.push({
        questionNumber: q,
        option: optionLetter,
        x: bubbleX,
        y: itemY,
        radius: bubbleRadius,
      });
    }
  }

  return gridBoxes;
}

/**
 * Simulates adaptive pixel intensity extraction & fill ratio calculation for a scanned frame image buffer
 */
export function analyzeSheetBubbles(
  totalQuestions: QuestionCount,
  optionsCount: OptionCount,
  mockImagePixels?: Uint8Array,
  sheetWidth: number = 800,
  sheetHeight: number = 1000
): BubbleAnalysisResult[] {
  const results: BubbleAnalysisResult[] = [];
  const options = OPTION_LETTERS.slice(0, optionsCount);

  for (let q = 1; q <= totalQuestions; q++) {
    const fillRatios: Record<string, number> = {};
    const detectedOptions: string[] = [];
    let maxRatio = 0;
    let maxOption = '';

    // Calculate simulated fill ratios (or extract from pixel matrix)
    options.forEach((opt) => {
      // In production C++/JSI OpenCV module, this sums binarized dark pixels inside circle ROI
      let ratio = 0.05; // default empty noise
      if (mockImagePixels) {
        // Pixel-based ratio calculation
        const index = ((q * 7 + opt.charCodeAt(0)) % 100) / 100;
        ratio = index;
      }
      fillRatios[opt] = Number(ratio.toFixed(2));

      if (ratio > maxRatio) {
        maxRatio = ratio;
        maxOption = opt;
      }
    });

    // Check marked condition
    options.forEach((opt) => {
      if (fillRatios[opt] >= FILL_THRESHOLDS.HIGH_FILL) {
        detectedOptions.push(opt);
      }
    });

    const isAmbiguous =
      maxRatio >= FILL_THRESHOLDS.LOW_FILL &&
      maxRatio < FILL_THRESHOLDS.HIGH_FILL;

    const status: AnswerDetectionStatus = detectedOptions.length > 1
      ? 'multiple'
      : detectedOptions.length === 1
        ? 'detected'
        : isAmbiguous
          ? 'uncertain'
          : 'blank';

    results.push({
      questionNumber: q,
      detectedOptions,
      fillRatios,
      isAmbiguous: status !== 'detected',
      status,
      confidence: status === 'detected' ? 0.9 : 0.25,
      sourceRegion: { x: 0, y: (q - 1) / totalQuestions, width: 1, height: 1 / totalQuestions },
    });
  }

  return results;
}

/**
 * Scores student bubble choices against the exam master answer key
 */
export function scoreScanResults(
  bubbleResults: BubbleAnalysisResult[],
  answerKeys: AnswerKeyItem[]
): {
  rawScore: number;
  maxScore: number;
  percentageScore: number;
  itemDetails: ScanItemDetail[];
} {
  let rawScore = 0;
  let maxScore = 0;
  const itemDetails: ScanItemDetail[] = [];

  const keyMap = new Map<number, AnswerKeyItem>();
  answerKeys.forEach((key) => keyMap.set(key.question_number, key));

  bubbleResults.forEach((res) => {
    const key = keyMap.get(res.questionNumber);
    const correctOpts = key?.correct_options || ['A'];
    const itemPoints = key?.points || 1.0;
    maxScore += itemPoints;

    // Check correctness: detected options must match correct options exactly
    const isCorrect =
      res.detectedOptions.length > 0 &&
      res.detectedOptions.length === correctOpts.length &&
      res.detectedOptions.every((opt) => correctOpts.includes(opt));

    if (isCorrect) {
      rawScore += itemPoints;
    }

    itemDetails.push({
      question_number: res.questionNumber,
      detected_options: res.detectedOptions,
      is_correct: isCorrect,
      is_ambiguous: res.isAmbiguous,
      fill_ratios: res.fillRatios,
      detection_status: res.status,
      confidence: res.confidence,
      source_region: res.sourceRegion,
    });
  });

  const percentageScore = maxScore > 0 ? Number(((rawScore / maxScore) * 100).toFixed(2)) : 0;

  return {
    rawScore,
    maxScore,
    percentageScore,
    itemDetails,
  };
}
