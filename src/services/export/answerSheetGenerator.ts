import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import {
  AnswerSheetConfig,
  buildAnswerSheetFilename,
  getPagePoints,
} from '../omr/sheetLayout';
import { buildAnswerSheetHtml } from './answerSheetTemplate';

export { buildAnswerSheetHtml } from './answerSheetTemplate';

export interface GeneratedAnswerSheet {
  uri: string;
  filename: string;
  numberOfPages: number;
}

export async function generateAnswerSheetPdf(config: AnswerSheetConfig): Promise<GeneratedAnswerSheet> {
  if (Platform.OS === 'web') {
    throw new Error('Direct PDF download is not available in the web preview. Use Print, then choose Save as PDF.');
  }

  const html = buildAnswerSheetHtml(config);
  const page = getPagePoints(config.paperSize, config.orientation);
  const result = await Print.printToFileAsync({ html, width: page.width, height: page.height });
  const filename = buildAnswerSheetFilename(config);
  const source = new File(result.uri);
  const destination = new File(Paths.cache, filename);
  if (destination.exists) destination.delete();
  await source.copy(destination);
  return { uri: destination.uri, filename, numberOfPages: result.numberOfPages };
}

export async function printAnswerSheet(config: AnswerSheetConfig) {
  const html = buildAnswerSheetHtml(config);

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error('The browser blocked the print window. Allow pop-ups for localhost, then try Print again.');
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 350);
    return 'web-window' as const;
  }

  await Print.printAsync({ html });
  return 'native' as const;
}

export async function shareAnswerSheet(config: AnswerSheetConfig) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('PDF sharing is not available on this device. Use Print and save the sheet as a PDF instead.');
  }
  const generated = await generateAnswerSheetPdf(config);
  await Sharing.shareAsync(generated.uri, {
    mimeType: 'application/pdf',
    dialogTitle: `Share ${generated.filename}`,
    UTI: 'com.adobe.pdf',
  });
  return generated;
}
