import {
  AnswerSheetConfig,
  SheetFieldKey,
  buildAnswerSheetFilename,
  buildLayoutId,
  clampItemCount,
  getPageCssSize,
  getPageMillimeters,
  getPagePoints,
  getQuestionColumns,
} from '../omr/sheetLayout';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];
const PAGE_PADDING_MM = 8;
const FOUR_UP_GAP_MM = 5;

const FIELD_LABELS: Record<SheetFieldKey, string> = {
  studentName: 'Student name',
  studentId: 'Student ID',
  gradeSection: 'Grade & section',
  subject: 'Subject',
  teacher: 'Teacher',
  date: 'Date',
  testTitle: 'Test title',
  testCode: 'Test code',
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fieldValue(key: SheetFieldKey, config: AnswerSheetConfig) {
  if (key === 'testTitle') return config.testTitle;
  if (key === 'subject') return config.subject;
  if (key === 'teacher') return config.teacher;
  if (key === 'testCode') return config.testCode;
  return '';
}

function buildFieldHtml(config: AnswerSheetConfig) {
  return (Object.keys(config.fields) as SheetFieldKey[])
    .filter((key) => config.fields[key])
    .map((key) => {
      const value = fieldValue(key, config).trim();
      return `<div class="info-field"><span>${FIELD_LABELS[key]}</span><strong>${value ? escapeHtml(value) : '&nbsp;'}</strong></div>`;
    })
    .join('');
}

function buildQuestionGridHtml(config: AnswerSheetConfig) {
  const options = OPTION_LETTERS.slice(0, config.choiceCount);
  return getQuestionColumns(config.itemCount)
    .map((questions) => `
      <div class="question-column">
        ${questions.map((question) => `
          <div class="question-row" data-question="${question}">
            <span class="question-number">${question}.</span>
            <div class="bubble-group">
              ${options.map((option) => `<span class="bubble">${option}</span>`).join('')}
            </div>
          </div>`).join('')}
      </div>`)
    .join('');
}

function buildSheetHtml(config: AnswerSheetConfig, copyNumber: number) {
  const itemCount = clampItemCount(config.itemCount);
  const title = config.testTitle.trim() || 'Student Answer Sheet';
  const layoutId = buildLayoutId(config);
  return `
    <div class="sheet-slot">
      <section class="answer-sheet" aria-label="Answer sheet ${copyNumber}" data-layout-id="${escapeHtml(layoutId)}">
        <i class="marker marker-tl"></i><i class="marker marker-tr"></i>
        <i class="marker marker-bl"></i><i class="marker marker-br"></i>
        <header class="sheet-header">
          <h1>CHECKMATE</h1>
          <div class="sheet-title">${escapeHtml(title)}</div>
          <div class="sheet-meta">${itemCount} items &middot; Choose one answer per question</div>
        </header>
        <div class="info-grid">${buildFieldHtml(config)}</div>
        <div class="instruction">Shade one circle completely using a dark pencil or pen. Keep the corner markers clean.</div>
        <div class="question-grid">${buildQuestionGridHtml(config)}</div>
        <footer>
          ${config.includeLayoutId ? `<span class="layout-id">${escapeHtml(layoutId)}</span>` : '<span></span>'}
          <span>Blank OMR sheet</span>
        </footer>
      </section>
    </div>`;
}

export function buildAnswerSheetHtml(config: AnswerSheetConfig) {
  const sheetCount = config.sheetsPerPage;
  const pageSize = getPageCssSize(config.paperSize, config.orientation);
  const pagePoints = getPagePoints(config.paperSize, config.orientation);
  const pageMm = getPageMillimeters(config.paperSize, config.orientation);
  const columns = getQuestionColumns(config.itemCount).length;
  const compactClass = columns >= 3 ? 'many-columns' : columns === 2 ? 'two-columns' : 'one-column';
  const sheets = Array.from({ length: sheetCount }, (_, index) => buildSheetHtml(config, index + 1)).join('');
  const cellWidth = (pageMm.width - PAGE_PADDING_MM * 2 - FOUR_UP_GAP_MM) / 2;
  const cellHeight = (pageMm.height - PAGE_PADDING_MM * 2 - FOUR_UP_GAP_MM) / 2;
  const fourSheetWidth = config.orientation === 'landscape' ? cellHeight : cellWidth;
  const fourSheetHeight = config.orientation === 'landscape' ? cellWidth : cellHeight;

  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(buildAnswerSheetFilename(config))}</title>
      <style>
        * { box-sizing: border-box; }
        @page { size: ${pageSize}; margin: 0; }
        html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; }
        .page { width: ${pagePoints.width}pt; height: ${pagePoints.height}pt; padding: ${PAGE_PADDING_MM}mm; display: grid; align-items: stretch; position: relative; overflow: hidden; }
        .sheets-1 { grid-template-columns: minmax(0, 1fr); }
        .sheets-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 6mm; }
        .sheets-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); gap: ${FOUR_UP_GAP_MM}mm; }
        .sheet-slot { min-width: 0; min-height: 0; position: relative; display: flex; align-items: stretch; justify-content: stretch; }
        .answer-sheet { flex: 1; min-width: 0; min-height: 0; position: relative; padding: 7mm 6mm 5mm; border: 0.35mm solid #222; background: #fff; overflow: hidden; }
        .cut-line { position: absolute; z-index: 5; pointer-events: none; border-color: #999; }
        .cut-line-v { top: ${PAGE_PADDING_MM}mm; bottom: ${PAGE_PADDING_MM}mm; left: 50%; border-left: 0.3mm dashed #999; }
        .cut-line-h { left: ${PAGE_PADDING_MM}mm; right: ${PAGE_PADDING_MM}mm; top: 50%; border-top: 0.3mm dashed #999; }
        .marker { position: absolute; width: 5mm; height: 5mm; background: #000; display: block; }
        .marker-tl { top: 1.8mm; left: 1.8mm; } .marker-tr { top: 1.8mm; right: 1.8mm; }
        .marker-bl { bottom: 1.8mm; left: 1.8mm; } .marker-br { bottom: 1.8mm; right: 1.8mm; }
        .sheet-header { text-align: center; border-bottom: 0.6mm solid #000; padding: 0 5mm 2.2mm; }
        h1 { font-size: 14pt; line-height: 1; margin: 0; letter-spacing: 0; }
        .sheet-title { margin-top: 1.2mm; font-size: 9pt; font-weight: 700; }
        .sheet-meta, .instruction { font-size: 6.5pt; }
        .sheet-meta { margin-top: 0.8mm; }
        .info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.2mm 3mm; margin: 2.2mm 0; }
        .info-field { display: flex; align-items: flex-end; gap: 1mm; min-width: 0; font-size: 6.8pt; }
        .info-field span { white-space: nowrap; }
        .info-field strong { min-width: 0; flex: 1; height: 3.7mm; border-bottom: 0.3mm solid #000; overflow: hidden; white-space: nowrap; font-size: 6.8pt; }
        .instruction { text-align: center; margin-bottom: 1.4mm; }
        .question-grid { display: flex; gap: 3mm; align-items: flex-start; }
        .question-column { flex: 1; min-width: 0; }
        .question-row { height: 5.5mm; display: flex; align-items: center; border-bottom: 0.2mm solid #ddd; }
        .question-number { width: 8mm; flex: 0 0 8mm; text-align: right; padding-right: 1.6mm; font-size: 7.5pt; font-weight: 700; }
        .bubble-group { flex: 1; display: flex; align-items: center; justify-content: space-evenly; }
        .bubble { width: 4.5mm; height: 4.5mm; border: 0.42mm solid #000; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 6.5pt; font-weight: 700; line-height: 1; }
        .many-columns .question-grid { gap: 1.2mm; }
        .many-columns .question-number { width: 6mm; flex-basis: 6mm; padding-right: 0.7mm; font-size: 6.5pt; }
        .many-columns .bubble { width: 3.7mm; height: 3.7mm; font-size: 5.5pt; }
        footer { position: absolute; left: 6mm; right: 6mm; bottom: 2.4mm; display: flex; justify-content: space-between; font-size: 5.5pt; }
        .sheets-4 .answer-sheet { flex: none; position: absolute; left: 50%; top: 50%; width: ${fourSheetWidth.toFixed(3)}mm; height: ${fourSheetHeight.toFixed(3)}mm; transform: translate(-50%, -50%)${config.orientation === 'landscape' ? ' rotate(90deg)' : ''}; padding: 4mm 4mm 3.5mm; }
        .sheets-4 .marker { width: 3.5mm; height: 3.5mm; }
        .sheets-4 .marker-tl { top: 1.2mm; left: 1.2mm; } .sheets-4 .marker-tr { top: 1.2mm; right: 1.2mm; }
        .sheets-4 .marker-bl { bottom: 1.2mm; left: 1.2mm; } .sheets-4 .marker-br { bottom: 1.2mm; right: 1.2mm; }
        .sheets-4 .sheet-header { padding: 0 4mm 1mm; border-bottom-width: 0.4mm; }
        .sheets-4 h1 { font-size: 9pt; }
        .sheets-4 .sheet-title { margin-top: 0.5mm; font-size: 6.5pt; }
        .sheets-4 .sheet-meta, .sheets-4 .instruction { font-size: 4.7pt; }
        .sheets-4 .sheet-meta { margin-top: 0.35mm; }
        .sheets-4 .info-grid { gap: 0.45mm 2mm; margin: 1mm 0; }
        .sheets-4 .info-field, .sheets-4 .info-field strong { font-size: 4.8pt; }
        .sheets-4 .info-field strong { height: 2.6mm; }
        .sheets-4 .instruction { margin-bottom: 0.5mm; }
        .sheets-4 .question-row { height: 3.45mm; }
        .sheets-4 .question-number { width: 6mm; flex-basis: 6mm; padding-right: 1mm; font-size: 5.5pt; }
        .sheets-4 .bubble { width: 3.15mm; height: 3.15mm; border-width: 0.32mm; font-size: 4.7pt; }
        .sheets-4 footer { left: 4mm; right: 4mm; bottom: 1.35mm; font-size: 4.2pt; }
        .print-toolbar { display: none; }
        @media screen {
          body { background: #dbe2ea; padding: 16px; }
          .print-toolbar { display: flex; justify-content: center; margin-bottom: 12px; }
          .print-toolbar button { border: 0; border-radius: 6px; background: #4f46e5; color: #fff; padding: 10px 18px; font-size: 14px; font-weight: 700; cursor: pointer; }
          .page { background: #fff; margin: auto; box-shadow: 0 10px 30px rgba(0,0,0,.18); }
        }
        @media print { .print-toolbar { display: none !important; } }
      </style>
    </head>
    <body class="${compactClass}">
      <div class="print-toolbar"><button type="button" onclick="window.print()">Print this sheet</button></div>
      <main class="page sheets-${sheetCount} orientation-${config.orientation}">
        ${sheets}
        ${sheetCount === 2 ? '<i class="cut-line cut-line-v" aria-hidden="true"></i>' : ''}
        ${sheetCount === 4 ? '<i class="cut-line cut-line-v" aria-hidden="true"></i><i class="cut-line cut-line-h" aria-hidden="true"></i>' : ''}
      </main>
    </body>
  </html>`;
}
