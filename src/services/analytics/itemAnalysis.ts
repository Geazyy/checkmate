import { ClassExamAnalytics, QuestionItemAnalysis, ScanResult } from '../../types';

/**
 * Calculates item analysis statistics including KR-20, Difficulty Index,
 * Discrimination Index, mean, median, standard deviation, and score distributions.
 */
export function calculateExamAnalytics(
  examId: string,
  totalQuestions: number,
  scans: ScanResult[]
): ClassExamAnalytics {
  if (!scans || scans.length === 0) {
    return {
      exam_id: examId,
      total_scans: 0,
      mean_score: 0,
      median_score: 0,
      std_deviation: 0,
      highest_score: 0,
      lowest_score: 0,
      passing_rate: 0,
      kr20_reliability: 0,
      items: [],
      score_histogram: [],
    };
  }

  const N = scans.length;
  const rawScores = scans.map((s) => s.raw_score).sort((a, b) => a - b);

  // 1. Central Tendencies
  const sumScores = rawScores.reduce((acc, val) => acc + val, 0);
  const meanScore = Number((sumScores / N).toFixed(2));

  const mid = Math.floor(N / 2);
  const medianScore =
    N % 2 !== 0 ? rawScores[mid] : Number(((rawScores[mid - 1] + rawScores[mid]) / 2).toFixed(2));

  const highestScore = rawScores[N - 1];
  const lowestScore = rawScores[0];

  // Variance & Standard Deviation
  const variance =
    rawScores.reduce((acc, score) => acc + Math.pow(score - meanScore, 2), 0) / N;
  const stdDeviation = Number(Math.sqrt(variance).toFixed(2));

  // Passing rate (passing threshold >= 60%)
  const maxScore = scans[0]?.max_score || totalQuestions;
  const passingCount = scans.filter((s) => (s.raw_score / maxScore) >= 0.6).length;
  const passingRate = Number(((passingCount / N) * 100).toFixed(1));

  // 2. High vs Low Grouping for Discrimination Index (Upper 27% vs Lower 27%)
  const sortedScans = [...scans].sort((a, b) => b.raw_score - a.raw_score);
  const groupSize = Math.max(1, Math.floor(N * 0.27));
  const upperGroup = sortedScans.slice(0, groupSize);
  const lowerGroup = sortedScans.slice(N - groupSize);

  // 3. Per Item Analysis & KR-20 Sum Computation
  let sumPq = 0;
  const itemAnalyses: QuestionItemAnalysis[] = [];

  for (let q = 1; q <= totalQuestions; q++) {
    let correctCount = 0;
    let upperCorrect = 0;
    let lowerCorrect = 0;
    const optionFreq: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };

    scans.forEach((scan) => {
      const detail = scan.items?.find((item) => item.question_number === q);
      if (detail) {
        if (detail.is_correct) correctCount++;
        detail.detected_options.forEach((opt) => {
          if (optionFreq[opt] !== undefined) optionFreq[opt]++;
        });
      }
    });

    upperGroup.forEach((scan) => {
      const detail = scan.items?.find((item) => item.question_number === q);
      if (detail?.is_correct) upperCorrect++;
    });

    lowerGroup.forEach((scan) => {
      const detail = scan.items?.find((item) => item.question_number === q);
      if (detail?.is_correct) lowerCorrect++;
    });

    // Difficulty Index P = Correct / N
    const difficultyIndex = Number((correctCount / N).toFixed(2));
    const p = difficultyIndex;
    const qVal = 1 - p;
    sumPq += p * qVal;

    let difficultyLabel: QuestionItemAnalysis['difficulty_label'] = 'Moderate';
    if (p > 0.8) difficultyLabel = 'Very Easy';
    else if (p > 0.6) difficultyLabel = 'Easy';
    else if (p > 0.4) difficultyLabel = 'Moderate';
    else if (p > 0.2) difficultyLabel = 'Hard';
    else difficultyLabel = 'Very Hard';

    // Discrimination Index D = (Ru - Rl) / n
    const discriminationIndex = Number(((upperCorrect - lowerCorrect) / groupSize).toFixed(2));

    let discriminationLabel: QuestionItemAnalysis['discrimination_label'] = 'Acceptable';
    if (discriminationIndex >= 0.4) discriminationLabel = 'Excellent';
    else if (discriminationIndex >= 0.3) discriminationLabel = 'Good';
    else if (discriminationIndex >= 0.2) discriminationLabel = 'Acceptable';
    else if (discriminationIndex >= 0.0) discriminationLabel = 'Poor';
    else discriminationLabel = 'Flawed';

    itemAnalyses.push({
      question_number: q,
      correct_option: 'A', // Master key fallback
      correct_count: correctCount,
      total_responses: N,
      difficulty_index: difficultyIndex,
      difficulty_label: difficultyLabel,
      discrimination_index: discriminationIndex,
      discrimination_label: discriminationLabel,
      option_frequencies: optionFreq,
    });
  }

  // 4. KR-20 Reliability Calculation: r_xx = (K / (K - 1)) * (1 - sum(p*q) / var)
  let kr20Reliability = 0;
  if (totalQuestions > 1 && variance > 0) {
    const kFactor = totalQuestions / (totalQuestions - 1);
    kr20Reliability = Number((kFactor * (1 - sumPq / variance)).toFixed(2));
    if (kr20Reliability < 0) kr20Reliability = 0;
    if (kr20Reliability > 1) kr20Reliability = 1;
  }

  // 5. Score Distribution Histogram (5 Bands)
  const step = maxScore / 5;
  const histogram = [
    { range: `0-${Math.round(step)}`, count: 0 },
    { range: `${Math.round(step + 1)}-${Math.round(step * 2)}`, count: 0 },
    { range: `${Math.round(step * 2 + 1)}-${Math.round(step * 3)}`, count: 0 },
    { range: `${Math.round(step * 3 + 1)}-${Math.round(step * 4)}`, count: 0 },
    { range: `${Math.round(step * 4 + 1)}-${maxScore}`, count: 0 },
  ];

  rawScores.forEach((score) => {
    const idx = Math.min(4, Math.floor(score / step));
    if (histogram[idx]) histogram[idx].count++;
  });

  return {
    exam_id: examId,
    total_scans: N,
    mean_score: meanScore,
    median_score: medianScore,
    std_deviation: stdDeviation,
    highest_score: highestScore,
    lowest_score: lowestScore,
    passing_rate: passingRate,
    kr20_reliability: kr20Reliability,
    items: itemAnalyses,
    score_histogram: histogram,
  };
}
