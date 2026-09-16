import { useAppTheme, useThemedStyles, AppTheme } from '../../constants/theme';
import { ActionButton as TouchableOpacity } from '../../components/common/Controls';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, Check, RotateCcw, X } from 'lucide-react-native';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScanStore } from '../../store/useScanStore';
import { useExamStore } from '../../store/useExamStore';
import { getReviewStatus, summarizeReview, OPTION_LETTERS } from '../../services/omr/scannerEngine';

import { finishReviewTiming } from '../../services/omr/scanTiming';
import { useSettingsStore } from '../../store/useSettingsStore';

export default function ScanReviewScreen() {
  const { ClayColors } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { examId } = useLocalSearchParams<{ examId?: string }>();
  const insets = useSafeAreaInsets();
  const {
    lastScannedResult,
    setLastScannedResult,
    confirmLastScannedResult,
    clearLastScannedResult,
  } = useScanStore();
  const answerKeysByExamId = useExamStore((state) => state.answerKeysByExamId);
  const activeAnswerKeys = answerKeysByExamId[lastScannedResult?.exam_id ?? examId ?? ''] ?? [];
  const keyMap = new Map(activeAnswerKeys.map((key) => [key.question_number, key]));
  const { showConfidence, highlightFlagged } = useSettingsStore();
  const resultId = lastScannedResult?.id;
  useEffect(() => {
    if (!resultId) return;
    const id = requestAnimationFrame(() => finishReviewTiming(resultId));
    return () => cancelAnimationFrame(id);
  }, [resultId]);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 220 });
  const [imageAspect, setImageAspect] = useState(0.75);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const items = useMemo(() => lastScannedResult?.items ?? [], [lastScannedResult?.items]);
  const previewUri = lastScannedResult?.cropped_sheet_image_url;
  useEffect(() => {
    if (!previewUri) return;
    Image.getSize(previewUri, (width, height) => {
      if (width && height) setImageAspect(width / height);
    });
  }, [previewUri]);
  const summary = useMemo(() => summarizeReview(items), [items]);
  const flaggedCount = summary.blank + summary.multiple + summary.uncertain;
  const missingKey = !items.length || items.some(item => !keyMap.get(item.question_number)?.correct_options.length);
  const visibleItems = reviewOnly ? items.filter(item => getReviewStatus(item) !== 'detected') : items;

  const previewMetrics = useMemo(() => {
    const containerAspect = previewSize.width / previewSize.height;
    if (!previewSize.width) return { left: 0, top: 0, width: 0, height: 0 };
    if (imageAspect >= containerAspect) {
      const height = previewSize.width / imageAspect;
      return { left: 0, top: (previewSize.height - height) / 2, width: previewSize.width, height };
    }
    const width = previewSize.height * imageAspect;
    return { left: (previewSize.width - width) / 2, top: 0, width, height: previewSize.height };
  }, [imageAspect, previewSize]);

  if (!lastScannedResult) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No scan result available.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.replace('/scan')}>
          <Text style={styles.btnText}>Return to Scanner</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleToggleOption = (qNum: number, currentOpts: string[], targetOpt: string) => {
    let updated: string[];
    if (currentOpts.length === 1 && currentOpts[0] === targetOpt) {
      updated = [];
    } else {
      updated = [targetOpt]; // Single choice override
    }
    const updatedItems = lastScannedResult.items?.map((item) => {
      if (item.question_number !== qNum) return item;

      const correctOptions = keyMap.get(qNum)?.correct_options || [];
      const isCorrect =
        updated.length > 0 && updated.length === correctOptions.length &&
        updated.every((option) => correctOptions.includes(option));

      return {
        ...item,
        detected_options: updated,
        is_correct: isCorrect,
        is_ambiguous: false,
        detection_status: updated.length ? ('detected' as const) : ('blank' as const),
        confidence: 1,
      };
    });

    const rawScore = (updatedItems || []).reduce((total, item) => {
      return total + (item.is_correct ? keyMap.get(item.question_number)?.points ?? 1 : 0);
    }, 0);
    const percentageScore = lastScannedResult.max_score
      ? Number(((rawScore / lastScannedResult.max_score) * 100).toFixed(2))
      : 0;

    setLastScannedResult({
      ...lastScannedResult,
      items: updatedItems,
      raw_score: rawScore,
      percentage_score: percentageScore,
      status: 'overridden',
    });
  };

  const handleRescan = () => {
    clearLastScannedResult();
    router.replace({ pathname: '/scan', params: { examId: lastScannedResult.exam_id } });
  };

  const handleConfirm = () => {
    if (missingKey) return;
    setConfirmOpen(false);
    confirmLastScannedResult();
    if (examId) {
      router.replace(`/exams/${examId}` as Href);
      return;
    }
    router.replace('/exams');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.reviewContent}>
      <View style={styles.topCard}>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>
            {lastScannedResult.student
              ? `${lastScannedResult.student.first_name} ${lastScannedResult.student.last_name}`
              : 'Unassigned Student'}
          </Text>
          <Text style={styles.studentSub}>
            ID: {lastScannedResult.student?.student_number || 'N/A'} • Status:{' '}
            {lastScannedResult.status}
          </Text>
        </View>

        <View style={styles.scorePill}>
          <Text style={styles.scorePillText}>
            {lastScannedResult.raw_score} / {lastScannedResult.max_score}
          </Text>
          <Text style={styles.percentageText}>{lastScannedResult.percentage_score}%</Text>
        </View>
      </View>

      <Text style={styles.sectionHeader}>Detected Answers</Text>

      <View style={styles.summaryBar}>
        {[
          ['Correct', summary.correct, ClayColors.success],
          ['Incorrect', summary.incorrect, ClayColors.danger],
          ['Blank', summary.blank, ClayColors.textMuted],
          ['Multiple', summary.multiple, ClayColors.warning],
          ['Uncertain', summary.uncertain, ClayColors.warning],
        ].map(([label, value, color]) => (
          <View style={styles.summaryItem} key={String(label)}>
            <Text style={[styles.summaryValue, { color: String(color) }]}>{String(value)}</Text>
            <Text style={styles.summaryLabel}>{String(label)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.filterBar}>
        {[false, true].map(flagged => (
          <TouchableOpacity key={String(flagged)} accessibilityRole="radio"
            accessibilityState={{ checked: reviewOnly === flagged }}
            style={[styles.filterButton, reviewOnly === flagged && styles.filterActive]}
            onPress={() => setReviewOnly(flagged)}>
            <Text style={{ color: reviewOnly === flagged ? ClayColors.onPrimary : ClayColors.textPrimary, fontWeight: '700' }}>
              {flagged ? `Needs review (${flaggedCount})` : `All (${items.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {missingKey && <Text accessibilityRole="alert" style={styles.sectionHeader}>Answer key incomplete. Complete the exam key before grading.</Text>}
      {reviewOnly && !visibleItems.length && <Text style={styles.sectionHeader}>No answers need review.</Text>}

      {lastScannedResult.cropped_sheet_image_url && (
        <View
          style={styles.sheetPreview}
          onLayout={(event) => setPreviewSize({
            width: event.nativeEvent.layout.width,
            height: event.nativeEvent.layout.height,
          })}>
          <Image
            accessibilityLabel="Captured answer sheet"
            source={{ uri: lastScannedResult.cropped_sheet_image_url }}
            style={StyleSheet.absoluteFill}
            resizeMode="contain"
          />
          {highlightFlagged && items
            .filter((item) => getReviewStatus(item) !== 'detected' && item.source_region)
            .map((item) => {
              const region = item.source_region!;
              return (
                <View
                  key={`region-${item.question_number}`}
                  style={[
                    styles.warningRegion,
                    {
                      left: previewMetrics.left + region.x * previewMetrics.width,
                      top: previewMetrics.top + region.y * previewMetrics.height,
                      width: region.width * previewMetrics.width,
                      height: Math.max(6, region.height * previewMetrics.height),
                    },
                  ]}>
                  <Text style={styles.warningRegionLabel}>Q{item.question_number}</Text>
                </View>
              );
            })}
        </View>
      )}

      {/* Detected Bubbles Review Grid */}
      <View style={styles.gridList}>
        {visibleItems.map((item) => {
          const detectionStatus = getReviewStatus(item);
          return (
          <View
            key={item.question_number}
            style={[
              styles.itemRow,
              item.detected_options.length > 0 &&
                (item.is_correct ? styles.itemRowCorrect : styles.itemRowIncorrect),
            ]}>
            <Text style={styles.itemNum}>Q{item.question_number}</Text>

            <View style={styles.statusIndicator}>
              {detectionStatus !== 'detected' && (
                <View style={styles.warningLabel}>
                  <AlertTriangle size={11} color={ClayColors.warning} />
                  <Text style={styles.flagText}>{detectionStatus === 'multiple' ? 'Invalid: multiple answers' : detectionStatus}</Text>
                </View>
              )}
              {showConfidence && typeof item.confidence === 'number' && (
                <Text style={styles.confidenceText}>{Math.round(item.confidence * 100)}% conf</Text>
              )}
              {!item.is_correct && <Text style={styles.correctAnswerText}>Key {keyMap.get(item.question_number)?.correct_options.join(', ') || '-'}</Text>}
              {item.is_correct ? <Check size={17} color={ClayColors.success} /> : <X size={17} color={ClayColors.danger} />}
            </View>

            <View style={styles.optionsRow}>
              {(Object.keys(item.fill_ratios).length
                ? Object.keys(item.fill_ratios)
                : OPTION_LETTERS.slice(0, 4)
              ).map((opt) => {
                const isSelected = item.detected_options.includes(opt);
                return (
                  <TouchableOpacity
                    accessibilityLabel={`Question ${item.question_number}, answer ${opt}`}
                    accessibilityState={{ selected: isSelected }}
                    key={opt}
                    style={[
                      styles.bubbleBtn,
                      isSelected &&
                        (item.is_correct ? styles.bubbleCorrect : styles.bubbleIncorrect),
                    ]}
                    onPress={() =>
                      handleToggleOption(item.question_number, item.detected_options, opt)
                    }>
                    <Text
                      style={[
                        styles.bubbleText,
                        isSelected && { color: ClayColors.onPrimary, fontWeight: '700' },
                      ]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

          </View>
        );})}
      </View>
      </ScrollView>

      {/* Action Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
        <TouchableOpacity style={styles.discardBtn} onPress={handleRescan}>
          <RotateCcw size={16} color={ClayColors.textPrimary} />
          <Text style={styles.discardText}>Retake Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity disabled={missingKey} style={[styles.saveBtn, missingKey && { opacity: 0.5 }]} onPress={() => flaggedCount ? setConfirmOpen(true) : handleConfirm()}>
          <Check size={17} color={ClayColors.onPrimary} />
          <Text style={styles.saveText}>Grade Answers</Text>
        </TouchableOpacity>
      </View>
      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmDialog} accessibilityViewIsModal>
            <Text style={styles.studentName}>Grade unresolved answers?</Text>
            <Text style={styles.studentSub}>{summary.blank} blank, {summary.multiple} multiple, {summary.uncertain} uncertain. These answers receive no points.</Text>
            <TouchableOpacity style={styles.dialogButton} onPress={() => { setConfirmOpen(false); setReviewOnly(true); }}>
              <Text style={styles.discardText}>Review answers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={handleConfirm}>
              <Text style={styles.btnText}>Grade anyway</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = ({ ClayButtonStyle, ClayCardStyle, ClayColors }: AppTheme) => StyleSheet.create({
  filterBar: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, gap: 8 },
  filterButton: { flex: 1, minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: ClayColors.borderDarker, justifyContent: 'center', alignItems: 'center', padding: 8 },
  filterActive: { backgroundColor: ClayColors.primary },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  confirmDialog: { backgroundColor: ClayColors.cardBg, borderRadius: 8, padding: 20, gap: 16, width: '100%', maxWidth: 420 },
  dialogButton: { minHeight: 44, padding: 12, backgroundColor: ClayColors.surfaceInset, borderRadius: 8 },
  container: {
    flex: 1,
    backgroundColor: ClayColors.bg,
  },
  reviewContent: { width: '100%', maxWidth: 850, alignSelf: 'center', paddingBottom: 12 },
  emptyContainer: {
    flex: 1,
    backgroundColor: ClayColors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: { color: ClayColors.textSecondary, fontSize: 16, marginBottom: 16 },
  btn: { ...ClayButtonStyle, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16 },
  btnText: { color: ClayColors.onPrimary, fontWeight: '700' },
  topCard: {
    ...ClayCardStyle,
    marginHorizontal: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  studentInfo: { flex: 1 },
  studentName: { color: ClayColors.textPrimary, fontSize: 17, fontWeight: '800' },
  studentSub: { color: ClayColors.textSecondary, fontSize: 12, marginTop: 4, fontWeight: '500' },
  scorePill: {
    backgroundColor: ClayColors.cardMint,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ClayColors.mintBorder,
  },
  scorePillText: { color: ClayColors.success, fontSize: 17, fontWeight: '800' },
  percentageText: { color: ClayColors.success, fontSize: 11, fontWeight: '700' },
  sectionHeader: {
    color: ClayColors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  sheetPreview: {
    height: 180,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: ClayColors.cardBg,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: ClayColors.borderSubtle,
  },
  warningRegion: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: ClayColors.warning,
    backgroundColor: 'rgba(217, 119, 6, 0.18)',
  },
  warningRegionLabel: {
    position: 'absolute',
    left: -1,
    top: -14,
    color: ClayColors.warning,
    backgroundColor: ClayColors.cardBg,
    fontSize: 9,
    fontWeight: '800',
  },
  summaryBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: ClayColors.borderSubtle,
    paddingVertical: 9,
  },
  summaryItem: { flex: 1, alignItems: 'center', minWidth: 0 },
  summaryValue: { fontSize: 15, fontWeight: '800' },
  summaryLabel: { color: ClayColors.textSecondary, fontSize: 10, marginTop: 2, fontWeight: '600' },
  gridList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  scrollView: {
    flex: 1,
  },
  itemRow: {
    ...ClayCardStyle,
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  itemRowCorrect: { borderColor: ClayColors.success, borderWidth: 2 },
  itemRowIncorrect: { borderColor: ClayColors.danger, borderWidth: 2 },
  itemNum: { color: ClayColors.textPrimary, fontSize: 14, fontWeight: '800', width: 38 },
  optionsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, width: '100%', marginTop: 10 },
  bubbleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: ClayColors.borderDarker,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: ClayColors.surfaceInset,
  },
  bubbleCorrect: { backgroundColor: ClayColors.success, borderColor: ClayColors.success },
  bubbleIncorrect: { backgroundColor: ClayColors.danger, borderColor: ClayColors.danger },
  bubbleText: { color: ClayColors.textSecondary, fontSize: 13, fontWeight: '700' },
  statusIndicator: { flex: 1, alignItems: 'flex-end', gap: 2 },
  warningLabel: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '100%' },
  flagText: { color: ClayColors.warning, fontSize: 10, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  confidenceText: { color: ClayColors.textMuted, fontSize: 9, fontWeight: '700' },
  correctAnswerText: { color: ClayColors.danger, fontSize: 9, fontWeight: '700' },
  resultIcon: { fontSize: 16, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    backgroundColor: ClayColors.cardBg,
    borderTopWidth: 1.5,
    borderTopColor: ClayColors.borderSubtle,
    gap: 12,
  },
  discardBtn: {
    flex: 1,
    minWidth: 130,
    backgroundColor: ClayColors.borderSubtle,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
    borderWidth: 1,
    borderColor: ClayColors.borderDarker,
  },
  discardText: { color: ClayColors.textPrimary, fontWeight: '700' },
  saveBtn: {
    ...ClayButtonStyle,
    flex: 2,
    minWidth: 140,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  saveText: { color: ClayColors.onPrimary, fontWeight: '700' },
});
