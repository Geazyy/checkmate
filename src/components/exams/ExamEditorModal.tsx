import { AccessibleInput as TextInput, ActionButton as TouchableOpacity } from '../common/Controls';
import { ClayColors } from '../../constants/theme';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, Check, X } from 'lucide-react-native';
import { Exam, OptionCount, QuestionCount } from '../../types';

const QUESTION_COUNTS: QuestionCount[] = [10, 20, 25, 30, 40, 50, 100];

type ExamEditorModalProps = {
  exam: Exam | null;
  visible: boolean;
  onClose: () => void;
  onSave: (updates: Partial<Exam>) => void;
};

export function ExamEditorModal({ exam, visible, onClose, onSave }: ExamEditorModalProps) {
  const [title, setTitle] = useState('');
  const [className, setClassName] = useState('');
  const [description, setDescription] = useState('');
  const [questionCount, setQuestionCount] = useState<QuestionCount>(25);
  const [optionCount, setOptionCount] = useState<OptionCount>(4);
  const [passingScore, setPassingScore] = useState('60');
  const [sheetCode, setSheetCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!exam) return;
    // Reopening the editor restores the selected exam's saved values, discarding only the unsaved form draft.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTitle(exam.title);
    setClassName(exam.class_name ?? '');
    setDescription(exam.description ?? '');
    setQuestionCount(exam.total_questions);
    setOptionCount(exam.options_per_question);
    setPassingScore(String(exam.passing_score));
    setSheetCode(exam.sheet_code ?? '');
    setError('');
  }, [exam, visible]);

  const handleSave = () => {
    const parsedPassingScore = Number(passingScore);
    if (!title.trim()) {
      setError('Enter an exam title to continue.');
      return;
    }
    if (!Number.isFinite(parsedPassingScore) || parsedPassingScore < 0 || parsedPassingScore > 100) {
      setError('Passing score must be between 0 and 100.');
      return;
    }
    onSave({
      title: title.trim(),
      class_name: className.trim() || 'General',
      description: description.trim(),
      total_questions: questionCount,
      options_per_question: optionCount,
      passing_score: Math.round(parsedPassingScore),
      sheet_code: sheetCode.trim() || undefined,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.panel} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Edit exam</Text>
              <Text style={styles.subtitle}>Update the exam details used by sheets, keys, and grading.</Text>
            </View>
            <TouchableOpacity accessibilityLabel="Close edit exam" style={styles.iconButton} onPress={onClose}>
              <X size={19} color={ClayColors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScroll} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Exam title</Text>
            <TextInput autoFocus style={styles.input} value={title} onChangeText={(value) => { setTitle(value); setError(''); }} placeholder="Exam title" placeholderTextColor={ClayColors.textMuted} />

            <Text style={styles.label}>Class</Text>
            <TextInput style={styles.input} value={className} onChangeText={setClassName} placeholder="Example: Physics 101 - Sec A" placeholderTextColor={ClayColors.textMuted} />

            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} placeholder="Topics or notes" placeholderTextColor={ClayColors.textMuted} multiline />

            <Text style={styles.label}>Number of questions</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>
              {QUESTION_COUNTS.map((count) => (
                <TouchableOpacity key={count} style={[styles.choice, questionCount === count && styles.choiceActive]} onPress={() => setQuestionCount(count)}>
                  <Text style={[styles.choiceText, questionCount === count && styles.choiceTextActive]}>{count}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {!!exam && questionCount < exam.total_questions && (
              <View style={styles.warning}>
                <AlertTriangle size={16} color={ClayColors.warning} />
                <Text style={styles.warningText}>Answers above question {questionCount} will be removed from the key.</Text>
              </View>
            )}

            <View style={styles.twoColumns}>
              <View style={styles.column}>
                <Text style={styles.label}>Answer choices</Text>
                <View style={styles.segmented}>
                  {([4, 5] as OptionCount[]).map((count) => (
                    <TouchableOpacity key={count} style={[styles.segment, optionCount === count && styles.segmentActive]} onPress={() => setOptionCount(count)}>
                      <Text style={[styles.segmentText, optionCount === count && styles.segmentTextActive]}>{count === 4 ? 'A-D' : 'A-E'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.column}>
                <Text style={styles.label}>Passing score</Text>
                <View style={styles.scoreInputRow}>
                  <TextInput style={[styles.input, styles.scoreInput]} value={passingScore} onChangeText={setPassingScore} keyboardType="number-pad" placeholder="60" placeholderTextColor={ClayColors.textMuted} />
                  <Text style={styles.percent}>%</Text>
                </View>
              </View>
            </View>

            <Text style={styles.label}>Sheet or test code</Text>
            <TextInput style={styles.input} value={sheetCode} onChangeText={setSheetCode} autoCapitalize="characters" placeholder="Optional" placeholderTextColor={ClayColors.textMuted} />
            {!!error && <Text style={styles.error}>{error}</Text>}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Check size={17} color={ClayColors.onPrimary} /><Text style={styles.saveText}>Save changes</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.78)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  panel: { width: '100%', maxWidth: 560, maxHeight: '92%', backgroundColor: '#182438', borderWidth: 1, borderColor: '#334155', borderRadius: 8, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 18, borderBottomWidth: 1, borderBottomColor: '#334155' },
  headerCopy: { flex: 1 }, title: { color: ClayColors.surfaceMuted, fontSize: 18, fontWeight: '800' },
  subtitle: { color: ClayColors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  iconButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  formScroll: { flexGrow: 0 }, form: { padding: 18, paddingBottom: 8 },
  label: { color: ClayColors.borderDarker, fontSize: 11, fontWeight: '700', marginBottom: 7 },
  input: { minHeight: 43, backgroundColor: ClayColors.textPrimary, borderWidth: 1, borderColor: '#3B4A61', borderRadius: 8, color: ClayColors.surfaceMuted, fontSize: 13, paddingHorizontal: 12, marginBottom: 15 },
  multiline: { minHeight: 72, paddingTop: 11, textAlignVertical: 'top' },
  choiceRow: { gap: 7, paddingBottom: 15 },
  choice: { minWidth: 48, height: 36, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#3B4A61', backgroundColor: ClayColors.textPrimary, alignItems: 'center', justifyContent: 'center' },
  choiceActive: { backgroundColor: ClayColors.primary, borderColor: '#6366F1' }, choiceText: { color: ClayColors.textMuted, fontSize: 12, fontWeight: '700' }, choiceTextActive: { color: ClayColors.onPrimary },
  warning: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, marginTop: -7, marginBottom: 15, borderRadius: 8, backgroundColor: 'rgba(245,158,11,0.10)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)' },
  warningText: { flex: 1, color: '#FDE68A', fontSize: 10, lineHeight: 15 },
  twoColumns: { flexDirection: 'row', gap: 12 }, column: { flex: 1, minWidth: 0 },
  segmented: { flexDirection: 'row', height: 43, padding: 3, borderRadius: 8, backgroundColor: ClayColors.textPrimary, borderWidth: 1, borderColor: '#3B4A61', marginBottom: 15 },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 6 }, segmentActive: { backgroundColor: '#334155' },
  segmentText: { color: ClayColors.textMuted, fontSize: 11, fontWeight: '700' }, segmentTextActive: { color: ClayColors.onPrimary },
  scoreInputRow: { position: 'relative' }, scoreInput: { paddingRight: 30 }, percent: { position: 'absolute', right: 12, top: 12, color: ClayColors.textMuted, fontSize: 13 },
  error: { color: '#FCA5A5', fontSize: 11, marginTop: -6, marginBottom: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, padding: 16, borderTopWidth: 1, borderTopColor: '#334155' },
  cancelButton: { minHeight: 40, paddingHorizontal: 17, borderRadius: 8, borderWidth: 1, borderColor: ClayColors.textSecondary, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: ClayColors.borderDarker, fontSize: 12, fontWeight: '700' },
  saveButton: { minHeight: 40, paddingHorizontal: 17, borderRadius: 8, backgroundColor: '#059669', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  saveText: { color: ClayColors.onPrimary, fontSize: 12, fontWeight: '700' },
});
