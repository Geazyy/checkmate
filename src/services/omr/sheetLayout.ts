export const OMR_SHEET_VERSION = '2.1';
export const OMR_ROWS_PER_COLUMN = 25;
export const SCANNER_SUPPORTED_ITEM_COUNTS = [25, 50] as const;
export const OMR_CANONICAL_SIZE = { width: 800, height: 1120 } as const;
export const OMR_50_AD_LAYOUT = {
  layoutId: 'CM-OMR-V2.1-Q50-C4',
  version: OMR_SHEET_VERSION,
  itemCount: 50,
  choices: ['A', 'B', 'C', 'D'],
  canonicalWidth: OMR_CANONICAL_SIZE.width,
  canonicalHeight: OMR_CANONICAL_SIZE.height,
  columns: [
    { firstQuestion: 1, lastQuestion: 25, rowCount: OMR_ROWS_PER_COLUMN },
    { firstQuestion: 26, lastQuestion: 50, rowCount: OMR_ROWS_PER_COLUMN },
  ],
} as const;

export type PaperSize = 'a4' | 'letter';
export type PageOrientation = 'portrait' | 'landscape';
export type SheetsPerPage = 1 | 2;
export type SheetFieldKey =
  | 'studentName'
  | 'studentId'
  | 'gradeSection'
  | 'subject'
  | 'teacher'
  | 'date'
  | 'testTitle'
  | 'testCode';

export interface AnswerSheetFields {
  studentName: boolean;
  studentId: boolean;
  gradeSection: boolean;
  subject: boolean;
  teacher: boolean;
  date: boolean;
  testTitle: boolean;
  testCode: boolean;
}

export interface AnswerSheetConfig {
  itemCount: number;
  choiceCount: 4 | 5;
  paperSize: PaperSize;
  orientation: PageOrientation;
  sheetsPerPage: SheetsPerPage;
  fields: AnswerSheetFields;
  testTitle: string;
  subject: string;
  teacher: string;
  testCode: string;
  includeLayoutId: boolean;
}

export const DEFAULT_ANSWER_SHEET_FIELDS: AnswerSheetFields = {
  studentName: true,
  studentId: true,
  gradeSection: true,
  subject: true,
  teacher: false,
  date: true,
  testTitle: true,
  testCode: true,
};

export const DEFAULT_ANSWER_SHEET_CONFIG: AnswerSheetConfig = {
  itemCount: 25,
  choiceCount: 4,
  paperSize: 'a4',
  orientation: 'landscape',
  sheetsPerPage: 2,
  fields: DEFAULT_ANSWER_SHEET_FIELDS,
  testTitle: '',
  subject: '',
  teacher: '',
  testCode: '',
  includeLayoutId: true,
};

const PAPER_POINTS = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
} as const;

export function clampItemCount(value: number) {
  if (!Number.isFinite(value)) return 25;
  return Math.min(100, Math.max(1, Math.round(value)));
}

export function getInternalColumnCount(itemCount: number) {
  return Math.max(1, Math.ceil(clampItemCount(itemCount) / OMR_ROWS_PER_COLUMN));
}

export function getQuestionColumns(itemCount: number) {
  const safeCount = clampItemCount(itemCount);
  const columnCount = getInternalColumnCount(safeCount);
  const rowsPerColumn = Math.ceil(safeCount / columnCount);

  return Array.from({ length: columnCount }, (_, columnIndex) => {
    const start = columnIndex * rowsPerColumn + 1;
    const end = Math.min(safeCount, start + rowsPerColumn - 1);
    return Array.from({ length: Math.max(0, end - start + 1) }, (_, rowIndex) => start + rowIndex);
  });
}

export function getPagePoints(paperSize: PaperSize, orientation: PageOrientation) {
  const page = PAPER_POINTS[paperSize];
  return orientation === 'landscape'
    ? { width: page.height, height: page.width }
    : { width: page.width, height: page.height };
}

export function getPageCssSize(paperSize: PaperSize, orientation: PageOrientation) {
  const size = paperSize === 'a4' ? 'A4' : 'Letter';
  return `${size} ${orientation}`;
}

export function buildLayoutId(config: AnswerSheetConfig) {
  const testId = config.testCode.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toUpperCase();
  const suffix = testId ? `-${testId.slice(0, 20)}` : '';
  return `CM-OMR-V${OMR_SHEET_VERSION}-Q${clampItemCount(config.itemCount)}-C${config.choiceCount}${suffix}`;
}

export function buildAnswerSheetFilename(config: AnswerSheetConfig) {
  const paper = config.paperSize === 'a4' ? 'A4' : 'Letter';
  const orientation = config.orientation === 'landscape' ? 'Landscape' : 'Portrait';
  return `Answer-Sheet-${clampItemCount(config.itemCount)}-Items-${paper}-${orientation}.pdf`;
}

export function scannerSupportsItemCount(itemCount: number): itemCount is 25 | 50 {
  return (SCANNER_SUPPORTED_ITEM_COUNTS as readonly number[]).includes(itemCount);
}
