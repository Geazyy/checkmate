import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertTriangle, Check, RotateCcw, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScanStore } from '../../store/useScanStore';
import { useExamStore } from '../../store/useExamStore';
import { OPTION_LETTERS } from '../../services/omr/scannerEngine';

export default function ScanReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    lastScannedResult,
    setLastScannedResult,
    confirmLastScannedResult,
    clearLastScannedResult,
  } = useScanStore();
  const { activeAnswerKeys } = useExamStore();
  const keyMap = new Map(activeAnswerKeys.map((key) => [key.question_number, key]));
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 220 });
  const [imageAspect, setImageAspect] = useState(0.75);
  const items = lastScannedResult?.items || [];
  const previewUri = lastScannedResult?.cropped_sheet_image_url;
  useEffect(() => {
    if (!previewUri) return;
    Image.getSize(previewUri, (width, height) => {
      if (width && height) setImageAspect(width / height);
    });
  }, [previewUri]);
  const summary = useMemo(() => ({
    correct: items.filter((item) => item.is_correct).length,
    incorrect: items.filter((item) => !item.is_correct).length,
    blank: items.filter((item) => item.detection_status === 'blank').length,
    multiple: items.filter((item) => item.detection_status === 'multiple').length,
    uncertain: items.filter((item) => item.detection_status === 'uncertain').length,
  }), [items]);

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
        <TouchableOpacity style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnText}>Return to Scanner</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleToggleOption = (qNum: number, currentOpts: string[], targetOpt: string) => {
    let updated: string[];
    if (currentOpts.includes(targetOpt)) {
      updated = currentOpts.filter((o) => o !== targetOpt);
    } else {
      updated = [targetOpt]; // Single choice override
    }
    const updatedItems = lastScannedResult.items?.map((item) => {
      if (item.question_number !== qNum) return item;

      const correctOptions = keyMap.get(qNum)?.correct_options || [];
      const isCorrect =
        updated.length === correctOptions.length &&
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
      return total + (item.is_correct ? keyMap.get(item.question_number)?.points || 1 : 0);
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
    router.back();
  };

  const handleConfirm = () => {
    confirmLastScannedResult();
    router.replace('/');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      {/* Top Banner */}
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

      <Text style={styles.sectionHeader}>Detected Answers (Tap option to override)</Text>

      <View style={styles.summaryBar}>
        {[
          ['Correct', summary.correct, '#10B981'],
          ['Incorrect', summary.incorrect, '#EF4444'],
          ['Blank', summary.blank, '#94A3B8'],
          ['Multiple', summary.multiple, '#F59E0B'],
          ['Uncertain', summary.uncertain, '#F59E0B'],
        ].map(([label, value, color]) => (
          <View style={styles.summaryItem} key={String(label)}>
            <Text style={[styles.summaryValue, { color: String(color) }]}>{String(value)}</Text>
            <Text style={styles.summaryLabel}>{String(label)}</Text>
          </View>
        ))}
      </View>

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
          {items
            .filter((item) => item.detection_status !== 'detected' && item.source_region)
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
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.gridList}>
        {items.map((item) => {
          const detectionStatus = item.detection_status
            ?? (item.is_ambiguous ? 'uncertain' : item.detected_options.length ? 'detected' : 'blank');
          return (
          <View
            key={item.question_number}
            style={[
              styles.itemRow,
              item.detected_options.length > 0 &&
                (item.is_correct ? styles.itemRowCorrect : styles.itemRowIncorrect),
            ]}>
            <Text style={styles.itemNum}>Q{item.question_number}</Text>

            <View style={styles.optionsRow}>
              {(Object.keys(item.fill_ratios).length
                ? Object.keys(item.fill_ratios)
                : OPTION_LETTERS.slice(0, 4)
              ).map((opt) => {
                const isSelected = item.detected_options.includes(opt);
                return (
                  <TouchableOpacity
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
                        isSelected && { color: '#FFFFFF', fontWeight: '700' },
                      ]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.statusIndicator}>
              {detectionStatus !== 'detected' && (
                <View style={styles.warningLabel}>
                  <AlertTriangle size={11} color="#F59E0B" />
                  <Text style={styles.flagText}>{detectionStatus}</Text>
                </View>
              )}
              {typeof item.confidence === 'number' && (
                <Text style={styles.confidenceText}>
                  {Math.round(item.confidence * 100)}% confidence
                </Text>
              )}
              {!item.is_correct && (
                <Text style={styles.correctAnswerText}>
                  Key {keyMap.get(item.question_number)?.correct_options.join(', ') || '-'}
                </Text>
              )}
              {item.is_correct
                ? <Check size={17} strokeWidth={3} color="#10B981" />
                : <X size={17} strokeWidth={3} color="#EF4444" />}
            </View>
          </View>
        );})}
      </ScrollView>

      {/* Action Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
        <TouchableOpacity style={styles.discardBtn} onPress={handleRescan}>
          <RotateCcw size={16} color="#F8FAFC" />
          <Text style={styles.discardText}>Retake Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.saveBtn} onPress={handleConfirm}>
          <Check size={17} color="#FFFFFF" />
          <Text style={styles.saveText}>Grade Answers</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: { color: '#94A3B8', fontSize: 16, marginBottom: 16 },
  btn: { backgroundColor: '#4F46E5', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  btnText: { color: '#FFFFFF', fontWeight: '600' },
  topCard: {
    backgroundColor: '#1E293B',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  studentInfo: { flex: 1 },
  studentName: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  studentSub: { color: '#94A3B8', fontSize: 11, marginTop: 4 },
  scorePill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: 'center',
  },
  scorePillText: { color: '#10B981', fontSize: 16, fontWeight: '800' },
  percentageText: { color: '#10B981', fontSize: 11, fontWeight: '600' },
  sectionHeader: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  sheetPreview: {
    height: 180,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#020617',
    borderRadius: 8,
    overflow: 'hidden',
  },
  warningRegion: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
  },
  warningRegionLabel: {
    position: 'absolute',
    left: -1,
    top: -14,
    color: '#F59E0B',
    backgroundColor: '#0F172A',
    fontSize: 9,
    fontWeight: '800',
  },
  summaryBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#334155',
    paddingVertical: 9,
  },
  summaryItem: { flex: 1, alignItems: 'center', minWidth: 0 },
  summaryValue: { fontSize: 14, fontWeight: '800' },
  summaryLabel: { color: '#94A3B8', fontSize: 8, marginTop: 2 },
  gridList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  scrollView: {
    flex: 1,
  },
  itemRow: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  itemRowCorrect: { borderColor: '#10B981' },
  itemRowIncorrect: { borderColor: '#EF4444' },
  itemNum: { color: '#F8FAFC', fontSize: 13, fontWeight: '700', width: 36 },
  optionsRow: { flexDirection: 'row', gap: 8 },
  bubbleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  bubbleCorrect: { backgroundColor: '#10B981', borderColor: '#10B981' },
  bubbleIncorrect: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  bubbleText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  statusIndicator: { width: 62, alignItems: 'flex-end', gap: 2 },
  warningLabel: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  flagText: { color: '#F59E0B', fontSize: 10, fontWeight: '600' },
  confidenceText: { color: '#CBD5E1', fontSize: 9, fontWeight: '700' },
  correctAnswerText: { color: '#FCA5A5', fontSize: 9, fontWeight: '700' },
  resultIcon: { fontSize: 16, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#1E293B',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 12,
  },
  discardBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  discardText: { color: '#F8FAFC', fontWeight: '600' },
  saveBtn: {
    flex: 2,
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  saveText: { color: '#FFFFFF', fontWeight: '700' },
});
