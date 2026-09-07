export type ScanStage = 'Preparing image' | 'Finding answer sheet' | 'Aligning sheet' | 'Reading answers' | 'Saving results';
export type ScanTimings = Record<string, number>;

export class ScanCancelledError extends Error {
  constructor() { super('Scan cancelled. You can retry or choose another photo.'); }
}

export interface ScanProgress {
  onStage?: (stage: ScanStage) => void;
  signal?: AbortSignal;
  preserveOrientation?: boolean;
}

export function checkCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new ScanCancelledError();
}

export async function yieldScanWork(signal?: AbortSignal) {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  checkCancelled(signal);
}

export async function scanStage(stage: ScanStage, progress: ScanProgress) {
  checkCancelled(progress.signal);
  progress.onStage?.(stage);
  // Let React commit the progress state before the next CPU-bound stage.
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  checkCancelled(progress.signal);
}

export function createScanTimer() {
  const started = performance.now();
  const timings: ScanTimings = {};
  return {
    timings,
    async measure<T>(name: string, work: () => T | Promise<T>): Promise<T> {
      const start = performance.now();
      try { return await work(); }
      finally { timings[name] = (timings[name] ?? 0) + performance.now() - start; }
    },
    finish() { timings.totalMs = performance.now() - started; return timings; },
  };
}

// Transient metadata, never part of the persisted student/scan records.
let pendingReview: { id: string; start: number; timings: ScanTimings } | undefined;
export function beginReviewTiming(id: string, timings: ScanTimings) {
  pendingReview = { id, start: performance.now(), timings };
}
export function finishReviewTiming(id: string) {
  if (pendingReview?.id !== id) return;
  const reviewOpenMs = performance.now() - pendingReview.start;
  if (__DEV__) console.info('[OMR timing]', JSON.stringify({ ...pendingReview.timings, reviewOpenMs, totalMs: pendingReview.timings.totalMs + reviewOpenMs }));
  pendingReview = undefined;
}
