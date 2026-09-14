import { AccessibleInput as TextInput, ActionButton as TouchableOpacity } from '../../components/common/Controls';
import React, { useCallback, useMemo, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { currentOwner } from '../../store/storage';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  Archive,
  ArrowDownAZ,
  ArrowRight,
  CheckCircle2,
  Copy,
  FileText,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  ScanLine,
  Search,
  Trash2,
  X,
} from 'lucide-react-native';
import { Href, useRouter } from 'expo-router';
import { AppShell } from '../../components/common/AppShell';
import { ExamEditorModal } from '../../components/exams/ExamEditorModal';
import { useExamStore } from '../../store/useExamStore';
import { useScanStore } from '../../store/useScanStore';
import { Exam, OptionCount, QuestionCount } from '../../types';
import { ClayCardStyle, ClayColors } from '../../constants/theme';

const QUESTION_COUNTS: QuestionCount[] = [10, 20, 25, 30, 40, 50, 100];
type ExamFilter = 'active' | 'archived' | 'all';
type ExamSort = 'updated' | 'title' | 'scans';

const SORT_LABELS: Record<ExamSort, string> = {
  updated: 'Recently updated',
  title: 'Title A-Z',
  scans: 'Most scans',
};

export default function ExamsManagerScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const {
    exams,
    classes,
    answerKeysByExamId,
    setActiveExam,
    addExam,
    updateExam,
    duplicateExam,
    archiveExam,
    restoreExam,
    deleteExam,
  } = useExamStore();
  const scannedResults = useScanStore((state) => state.scannedResults);
  const removeExamResults = useScanStore((state) => state.removeExamResults);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newClassId, setNewClassId] = useState<string | null>(classes[0]?.id ?? null);
  const [questionCount, setQuestionCount] = useState<QuestionCount>(25);
  const [optionCount, setOptionCount] = useState<OptionCount>(4);
  const [passingScore, setPassingScore] = useState('60');
  const [formError, setFormError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ExamFilter>('active');
  const [sort, setSort] = useState<ExamSort>('updated');
  const [menuExam, setMenuExam] = useState<Exam | null>(null);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [deletingExam, setDeletingExam] = useState<Exam | null>(null);
  const [feedback, setFeedback] = useState('');
  const wide = width >= 760;

  const scanCountFor = useCallback((exam: Exam) => Math.max(
    exam.scanned_count ?? 0,
    scannedResults.filter((scan) => scan.exam_id === exam.id).length,
  ), [scannedResults]);

  const visibleExams = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return exams
      .filter((exam) => {
        const archived = exam.status === 'archived' || !!exam.archived_at;
        if (filter === 'active' && archived) return false;
        if (filter === 'archived' && !archived) return false;
        if (!normalizedQuery) return true;
        return [exam.title, exam.class_name, exam.description, exam.sheet_code]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase().includes(normalizedQuery));
      })
      .sort((a, b) => {
        if (sort === 'title') return a.title.localeCompare(b.title);
        if (sort === 'scans') return scanCountFor(b) - scanCountFor(a);
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
  }, [exams, filter, query, sort, scanCountFor]);

  const closeCreateForm = () => {
    setIsCreating(false);
    setFormError('');
  };

  const handleCreateExam = () => {
    const score = Number(passingScore);
    if (!newTitle.trim()) {
      setFormError('Enter an exam title to continue.');
      return;
    }
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      setFormError('Passing score must be between 0 and 100.');
      return;
    }
    const selectedClass = classes.find((item) => item.id === newClassId);
    const id = randomUUID();
    const now = new Date().toISOString();
    const exam: Exam = {
      id,
      teacher_id: currentOwner()!,
      class_id: selectedClass?.id,
      title: newTitle.trim(),
      description: selectedClass?.subject ?? '',
      total_questions: questionCount,
      options_per_question: optionCount,
      passing_score: Math.round(score),
      status: 'draft',
      created_at: now,
      updated_at: now,
      scanned_count: 0,
      average_score: 0,
      class_name: selectedClass?.name ?? 'General',
    };
    const keys = Array.from({ length: questionCount }, (_, index) => ({
      exam_id: id,
      question_number: index + 1,
      correct_options: [] as string[],
      points: 1,
    }));
    addExam(exam, keys);
    setNewTitle('');
    setQuestionCount(25);
    setOptionCount(4);
    setPassingScore('60');
    closeCreateForm();
    router.push(`/exams/${id}` as Href);
  };

  const cycleSort = () => {
    setSort((current) => current === 'updated' ? 'title' : current === 'title' ? 'scans' : 'updated');
  };

  const handleDuplicate = (exam: Exam) => {
    const duplicated = duplicateExam(exam.id);
    setMenuExam(null);
    if (duplicated) setFeedback(`Created ${duplicated.title}.`);
  };

  const handleArchiveToggle = (exam: Exam) => {
    const archived = exam.status === 'archived' || !!exam.archived_at;
    if (archived) {
      restoreExam(exam.id);
      setFeedback(`${exam.title} restored.`);
    } else {
      archiveExam(exam.id);
      setFeedback(`${exam.title} archived. Its answer key and scans are preserved.`);
    }
    setMenuExam(null);
  };

  const handleDelete = () => {
    if (!deletingExam) return;
    removeExamResults(deletingExam.id);
    deleteExam(deletingExam.id);
    setFeedback(`${deletingExam.title} was permanently deleted.`);
    setDeletingExam(null);
  };

  return (
    <AppShell title="Exams">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.pageHeading, width < 480 && styles.pageHeadingCompact]}>
          <View style={styles.headingCopy}>
            <View style={styles.eyebrowChip}>
              <Text style={styles.eyebrow}>ASSESSMENTS</Text>
            </View>
            <Text style={styles.pageTitle}>Exam Catalog</Text>
            <Text style={styles.pageSub}>Set up keys, print sheets, and start grading from one place.</Text>
          </View>
          <TouchableOpacity style={styles.createButton} onPress={() => isCreating ? closeCreateForm() : setIsCreating(true)}>
            {isCreating ? <X size={18} color={ClayColors.onPrimary} /> : <Plus size={18} color={ClayColors.onPrimary} strokeWidth={2.4} />}
            <Text style={styles.createButtonText}>{isCreating ? 'Close' : 'New Exam'}</Text>
          </TouchableOpacity>
        </View>

        {isCreating && (
          <View style={styles.formPanel}>
            <Text style={styles.formTitle}>Create an Exam</Text>
            <Text style={styles.formSub}>Start with the details, then configure the answer key.</Text>
            <View style={[styles.formFields, wide && styles.formFieldsWide]}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Exam title</Text>
                <TextInput autoFocus style={[styles.input, !!formError && !newTitle.trim() && styles.inputError]}
                  placeholder="Example: Chemistry Quiz 3" placeholderTextColor={ClayColors.textMuted} value={newTitle}
                  onChangeText={(value) => { setNewTitle(value); setFormError(''); }} />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Class</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.classChoices}>
                  <TouchableOpacity style={[styles.classChoice, newClassId === null && styles.classChoiceActive]} onPress={() => setNewClassId(null)}>
                    <Text style={[styles.classChoiceText, newClassId === null && styles.classChoiceTextActive]}>General</Text>
                  </TouchableOpacity>
                  {classes.map((classSection) => (
                    <TouchableOpacity key={classSection.id} style={[styles.classChoice, newClassId === classSection.id && styles.classChoiceActive]} onPress={() => setNewClassId(classSection.id)}>
                      <Text style={[styles.classChoiceText, newClassId === classSection.id && styles.classChoiceTextActive]} numberOfLines={1}>{classSection.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={[styles.formFields, wide && styles.formFieldsWide]}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Number of questions</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.questionChoices}>
                  {QUESTION_COUNTS.map((count) => (
                    <TouchableOpacity key={count} style={[styles.countChoice, questionCount === count && styles.countChoiceActive]} onPress={() => setQuestionCount(count)}>
                      <Text style={[styles.countChoiceText, questionCount === count && styles.countChoiceTextActive]}>{count}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.compactSettings}>
                <View style={styles.optionSetting}>
                  <Text style={styles.label}>Choices</Text>
                  <View style={styles.segmentedControl}>
                    {([4, 5] as OptionCount[]).map((count) => (
                      <TouchableOpacity key={count} style={[styles.segment, optionCount === count && styles.segmentActive]} onPress={() => setOptionCount(count)}>
                        <Text style={[styles.segmentText, optionCount === count && styles.segmentTextActive]}>{count === 4 ? 'A-D' : 'A-E'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.scoreSetting}>
                  <Text style={styles.label}>Passing score</Text>
                  <View style={styles.scoreInputWrap}>
                    <TextInput style={[styles.input, styles.scoreInput]} value={passingScore} onChangeText={setPassingScore} keyboardType="number-pad" />
                    <Text style={styles.percent}>%</Text>
                  </View>
                </View>
              </View>
            </View>

            {!!formError && <Text style={styles.errorText}>{formError}</Text>}
            <View style={styles.formActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={closeCreateForm}><Text style={styles.secondaryButtonText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={handleCreateExam}>
                <Text style={styles.primaryButtonText}>Create Exam</Text><ArrowRight size={17} color={ClayColors.onPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.searchBar}>
          <Search size={19} color={ClayColors.textMuted} />
          <TextInput accessibilityLabel="Search exams" style={styles.searchInput} value={query} onChangeText={setQuery}
            placeholder="Search exams or classes" placeholderTextColor={ClayColors.textMuted} />
          {!!query && (
            <TouchableOpacity accessibilityLabel="Clear search" style={styles.clearSearch} onPress={() => setQuery('')}>
              <X size={17} color={ClayColors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.toolbar}>
          <View style={styles.filters}>
            {(['active', 'archived', 'all'] as ExamFilter[]).map((value) => (
              <TouchableOpacity key={value} style={[styles.filterButton, filter === value && styles.filterButtonActive]} onPress={() => setFilter(value)}>
                <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{value[0].toUpperCase() + value.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity accessibilityLabel="Change exam sorting" style={styles.sortButton} onPress={cycleSort}>
            <ArrowDownAZ size={16} color={ClayColors.textSecondary} />
            <Text style={styles.sortText}>{SORT_LABELS[sort]}</Text>
          </TouchableOpacity>
        </View>

        {!!feedback && (
          <View style={styles.feedback}>
            <CheckCircle2 size={16} color={ClayColors.success} />
            <Text style={styles.feedbackText}>{feedback}</Text>
            <TouchableOpacity accessibilityLabel="Dismiss message" onPress={() => setFeedback('')}><X size={16} color={ClayColors.success} /></TouchableOpacity>
          </View>
        )}

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>{filter === 'archived' ? 'Archived Exams' : filter === 'all' ? 'All Exams' : 'Your Exams'}</Text>
          <Text style={styles.countText}>{visibleExams.length} shown</Text>
        </View>

        {visibleExams.length > 0 ? (
          <View style={[styles.examGrid, wide && styles.examGridWide]}>
            {visibleExams.map((exam) => {
              const configured = (answerKeysByExamId[exam.id] ?? []).filter((key) => key.correct_options.length > 0).length;
              const keyReady = configured === exam.total_questions;
              const archived = exam.status === 'archived' || !!exam.archived_at;
              const scans = scanCountFor(exam);
              return (
                <View key={exam.id} style={[styles.examCard, wide && styles.examCardWide, archived && styles.examCardArchived]}>
                  <View style={styles.examTopRow}>
                    <View style={styles.documentIcon}><FileText size={20} color={ClayColors.primary} /></View>
                    <View style={styles.examTopActions}>
                      <View style={[styles.statusBadge, keyReady && styles.statusBadgeReady, archived && styles.statusBadgeArchived]}>
                        {archived ? <Archive size={13} color={ClayColors.textMuted} /> : <CheckCircle2 size={13} color={keyReady ? ClayColors.success : ClayColors.warning} />}
                        <Text style={[styles.statusText, keyReady && styles.statusTextReady, archived && styles.statusTextArchived]}>
                          {archived ? 'Archived' : keyReady ? 'Key ready' : `${configured}/${exam.total_questions} keyed`}
                        </Text>
                      </View>
                      <TouchableOpacity accessibilityLabel={`More actions for ${exam.title}`} style={styles.moreButton} onPress={() => setMenuExam(exam)}>
                        <MoreVertical size={19} color={ClayColors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.examTitle} numberOfLines={2}>{exam.title}</Text>
                  <Text style={styles.examSub} numberOfLines={1}>{exam.class_name || exam.description || 'General'}</Text>
                  <View style={styles.examMeta}>
                    <Text style={styles.metaText}>{exam.total_questions} questions</Text><View style={styles.metaDot} />
                    <Text style={styles.metaText}>A-{String.fromCharCode(64 + exam.options_per_question)}</Text><View style={styles.metaDot} />
                    <Text style={styles.metaText}>{scans} scans</Text>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity accessibilityLabel={`Open ${exam.title}`} style={styles.openButton}
                      onPress={() => { setActiveExam(exam); router.push(`/exams/${exam.id}` as Href); }}>
                      <Text style={styles.openButtonText}>Open Exam</Text><ArrowRight size={16} color={ClayColors.primary} />
                    </TouchableOpacity>
                    {!archived && (
                      <TouchableOpacity accessibilityLabel={`Scan ${exam.title}`} style={styles.scanButton}
                        onPress={() => { setActiveExam(exam); router.push({ pathname: '/scan', params: { examId: exam.id } }); }}>
                        <ScanLine size={18} color={ClayColors.onPrimary} strokeWidth={2.4} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Search size={28} color={ClayColors.textMuted} />
            <Text style={styles.emptyTitle}>{query ? 'No matching exams' : filter === 'archived' ? 'No archived exams' : 'No exams yet'}</Text>
            <Text style={styles.emptyText}>{query ? 'Try another title, class, topic, or code.' : 'Create an exam to configure its key and begin scanning.'}</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={!!menuExam} transparent animationType="fade" onRequestClose={() => setMenuExam(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setMenuExam(null)}>
          <Pressable style={styles.actionMenu} onPress={(event) => event.stopPropagation()}>
            <View style={styles.actionMenuHeader}>
              <View style={styles.actionMenuCopy}>
                <Text style={styles.actionMenuTitle} numberOfLines={1}>{menuExam?.title}</Text>
                <Text style={styles.actionMenuSub}>Exam actions</Text>
              </View>
              <TouchableOpacity accessibilityLabel="Close exam actions" style={styles.moreButton} onPress={() => setMenuExam(null)}><X size={18} color={ClayColors.textMuted} /></TouchableOpacity>
            </View>
            <ActionRow icon={Pencil} label="Edit exam" onPress={() => { setEditingExam(menuExam); setMenuExam(null); }} />
            <ActionRow icon={Copy} label="Duplicate exam" onPress={() => menuExam && handleDuplicate(menuExam)} />
            <ActionRow icon={menuExam?.status === 'archived' || menuExam?.archived_at ? RotateCcw : Archive}
              label={menuExam?.status === 'archived' || menuExam?.archived_at ? 'Restore exam' : 'Archive exam'}
              onPress={() => menuExam && handleArchiveToggle(menuExam)} />
            <View style={styles.menuDivider} />
            <ActionRow icon={Trash2} label="Delete permanently" danger onPress={() => { setDeletingExam(menuExam); setMenuExam(null); }} />
          </Pressable>
        </Pressable>
      </Modal>

      <ExamEditorModal
        exam={editingExam}
        visible={!!editingExam}
        onClose={() => setEditingExam(null)}
        onSave={(updates) => {
          if (!editingExam) return;
          updateExam(editingExam.id, updates);
          setFeedback(`${updates.title ?? editingExam.title} updated.`);
          setEditingExam(null);
        }}
      />

      <Modal visible={!!deletingExam} transparent animationType="fade" onRequestClose={() => setDeletingExam(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDeletingExam(null)}>
          <Pressable style={styles.confirmPanel} onPress={(event) => event.stopPropagation()}>
            <View style={styles.dangerIcon}><Trash2 size={23} color={ClayColors.danger} /></View>
            <Text style={styles.confirmTitle}>Delete this exam permanently?</Text>
            <Text style={styles.confirmText}>
              {deletingExam?.title} and its answer key will be removed. {deletingExam ? scanCountFor(deletingExam) : 0} associated scan records will also be deleted. This cannot be undone.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setDeletingExam(null)}><Text style={styles.secondaryButtonText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}><Trash2 size={16} color={ClayColors.onPrimary} /><Text style={styles.deleteButtonText}>Delete exam</Text></TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </AppShell>
  );
}

type ActionRowProps = {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  onPress: () => void;
  danger?: boolean;
};

function ActionRow({ icon: Icon, label, onPress, danger }: ActionRowProps) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress}>
      <Icon size={18} color={danger ? ClayColors.danger : ClayColors.textMuted} />
      <Text style={[styles.actionRowText, danger && styles.actionRowDanger]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 1080, alignSelf: 'center', padding: 20, paddingBottom: 100 },
  pageHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 },
  pageHeadingCompact: { flexDirection: 'column' },
  headingCopy: { flex: 1 },
  eyebrowChip: {
    backgroundColor: ClayColors.cardIndigo,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ClayColors.indigoBorder,
    marginBottom: 6,
  },
  eyebrow: { color: ClayColors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0 },
  pageTitle: { color: ClayColors.textPrimary, fontSize: 26, fontWeight: '800', letterSpacing: 0 },
  pageSub: { color: ClayColors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 4, maxWidth: 500 },
  createButton: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: ClayColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomWidth: 4,
    borderBottomColor: ClayColors.primaryBevel,
    shadowColor: ClayColors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  createButtonText: { color: ClayColors.onPrimary, fontSize: 13, fontWeight: '800' },
  formPanel: {
    ...ClayCardStyle,
    backgroundColor: ClayColors.onPrimary,
    padding: 20,
    marginBottom: 24,
  },
  formTitle: { color: ClayColors.textPrimary, fontSize: 18, fontWeight: '800' },
  formSub: { color: ClayColors.textMuted, fontSize: 12, marginTop: 3, marginBottom: 18 },
  formFields: { gap: 14 },
  formFieldsWide: { flexDirection: 'row' },
  fieldGroup: { flex: 1, minWidth: 0 },
  label: { color: ClayColors.textPrimary, fontSize: 12, fontWeight: '800', marginBottom: 8 },
  input: {
    minHeight: 46,
    backgroundColor: ClayColors.input,
    borderWidth: 1.5,
    borderColor: ClayColors.borderDarker,
    borderRadius: 16,
    color: ClayColors.textPrimary,
    fontSize: 13,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  inputError: { borderColor: ClayColors.danger },
  classChoices: { gap: 8, paddingBottom: 14 },
  classChoice: {
    maxWidth: 190,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: ClayColors.input,
    borderWidth: 1.5,
    borderColor: ClayColors.borderDarker,
    justifyContent: 'center',
  },
  classChoiceActive: { backgroundColor: ClayColors.cardIndigo, borderColor: ClayColors.primary },
  classChoiceText: { color: ClayColors.textMuted, fontSize: 12, fontWeight: '700' },
  classChoiceTextActive: { color: ClayColors.primary, fontWeight: '800' },
  questionChoices: { gap: 8, paddingBottom: 14 },
  countChoice: {
    minWidth: 48,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: ClayColors.input,
    borderWidth: 1.5,
    borderColor: ClayColors.borderDarker,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countChoiceActive: { backgroundColor: ClayColors.cardIndigo, borderColor: ClayColors.primary },
  countChoiceText: { color: ClayColors.textMuted, fontSize: 12, fontWeight: '700' },
  countChoiceTextActive: { color: ClayColors.primary, fontWeight: '800' },
  compactSettings: { flex: 1, minWidth: 250, flexDirection: 'row', gap: 12 },
  optionSetting: { flex: 1 },
  scoreSetting: { width: 120 },
  segmentedControl: {
    height: 46,
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    backgroundColor: ClayColors.input,
    borderWidth: 1.5,
    borderColor: ClayColors.borderDarker,
  },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  segmentActive: { backgroundColor: ClayColors.onPrimary, shadowColor: ClayColors.shadow, shadowOffset: { width: 2, height: 3 }, shadowOpacity: 0.2, shadowRadius: 4 },
  segmentText: { color: ClayColors.textMuted, fontSize: 12, fontWeight: '700' },
  segmentTextActive: { color: ClayColors.primary, fontWeight: '800' },
  scoreInputWrap: { position: 'relative' },
  scoreInput: { marginBottom: 0, paddingRight: 32 },
  percent: { position: 'absolute', right: 14, top: 14, color: ClayColors.textMuted, fontSize: 13, fontWeight: '700' },
  errorText: { color: ClayColors.danger, fontSize: 12, fontWeight: '700', marginTop: 4 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  secondaryButton: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: ClayColors.borderDarker,
    backgroundColor: ClayColors.cardIndigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: ClayColors.primary, fontSize: 12, fontWeight: '800' },
  primaryButton: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: ClayColors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomWidth: 3.5,
    borderBottomColor: ClayColors.success,
    shadowColor: ClayColors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryButtonText: { color: ClayColors.onPrimary, fontSize: 13, fontWeight: '800' },
  searchBar: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    backgroundColor: ClayColors.onPrimary,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    shadowColor: ClayColors.shadow,
    shadowOffset: { width: 3, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '4px 4px 12px rgba(160, 175, 195, 0.3), -3px -3px 10px rgba(255, 255, 255, 0.9)',
        } as any)
      : {}),
  },
  searchInput: { flex: 1, minWidth: 0, height: 48, borderWidth: 0, backgroundColor: 'transparent', color: ClayColors.textPrimary, fontSize: 13, paddingVertical: 0, fontWeight: '600' },
  clearSearch: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 14, marginBottom: 20 },
  filters: { flexDirection: 'row', gap: 8 },
  filterButton: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: ClayColors.borderDarker,
    backgroundColor: ClayColors.onPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: { backgroundColor: ClayColors.cardIndigo, borderColor: ClayColors.primary },
  filterText: { color: ClayColors.textMuted, fontSize: 11, fontWeight: '700' },
  filterTextActive: { color: ClayColors.primary, fontWeight: '800' },
  sortButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: ClayColors.onPrimary, borderWidth: 1.5, borderColor: ClayColors.borderDarker },
  sortText: { color: ClayColors.textPrimary, fontSize: 11, fontWeight: '700' },
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: ClayColors.cardMint,
    borderWidth: 1.5,
    borderColor: ClayColors.mintBorder,
    marginBottom: 18,
  },
  feedbackText: { flex: 1, color: ClayColors.success, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { color: ClayColors.textPrimary, fontSize: 18, fontWeight: '800', letterSpacing: 0 },
  countText: { color: ClayColors.textMuted, fontSize: 12, fontWeight: '700' },
  examGrid: { gap: 14 },
  examGridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  examCard: {
    ...ClayCardStyle,
    padding: 18,
  },
  examCardWide: { width: '48.8%' },
  examCardArchived: { opacity: 0.75 },
  examTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 },
  documentIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: ClayColors.cardIndigo,
    borderWidth: 1.5,
    borderColor: ClayColors.indigoBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  examTopActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  moreButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: ClayColors.surfaceInset, alignItems: 'center', justifyContent: 'center' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: ClayColors.cardAmber, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#FDE68A' },
  statusBadgeReady: { backgroundColor: ClayColors.cardMint, borderColor: ClayColors.mintBorder },
  statusBadgeArchived: { backgroundColor: ClayColors.surfaceInset, borderColor: ClayColors.borderSubtle },
  statusText: { color: ClayColors.warning, fontSize: 10, fontWeight: '800' },
  statusTextReady: { color: ClayColors.success },
  statusTextArchived: { color: ClayColors.textMuted },
  examTitle: { color: ClayColors.textPrimary, fontSize: 17, fontWeight: '800', lineHeight: 22 },
  examSub: { color: ClayColors.textMuted, fontSize: 12, marginTop: 4, fontWeight: '600' },
  examMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  metaText: { color: ClayColors.textMuted, fontSize: 11, fontWeight: '700' },
  metaDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: ClayColors.borderDarker },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  openButton: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: ClayColors.cardIndigo,
    borderWidth: 1.5,
    borderColor: ClayColors.indigoBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  openButtonText: { color: ClayColors.primary, fontSize: 12, fontWeight: '800' },
  scanButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: ClayColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomWidth: 3,
    borderBottomColor: ClayColors.primaryBevel,
    shadowColor: ClayColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  emptyState: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: ClayColors.onPrimary,
    borderWidth: 2,
    borderColor: ClayColors.borderSubtle,
    borderRadius: 22,
  },
  emptyTitle: { color: ClayColors.textPrimary, fontSize: 16, fontWeight: '800', marginTop: 12 },
  emptyText: { color: ClayColors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 4 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  actionMenu: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: ClayColors.onPrimary,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    padding: 14,
    shadowColor: ClayColors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  actionMenuHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, marginBottom: 4 },
  actionMenuCopy: { flex: 1, minWidth: 0 },
  actionMenuTitle: { color: ClayColors.textPrimary, fontSize: 15, fontWeight: '800' },
  actionMenuSub: { color: ClayColors.textMuted, fontSize: 10, marginTop: 2, textTransform: 'uppercase', fontWeight: '700' },
  actionRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: 14, backgroundColor: ClayColors.surfaceMuted, marginBottom: 4 },
  actionRowText: { color: ClayColors.textPrimary, fontSize: 13, fontWeight: '700' },
  actionRowDanger: { color: ClayColors.danger },
  menuDivider: { height: 1.5, backgroundColor: ClayColors.borderSubtle, marginVertical: 6 },
  confirmPanel: {
    width: '100%',
    maxWidth: 430,
    backgroundColor: ClayColors.onPrimary,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    padding: 22,
    shadowColor: ClayColors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  dangerIcon: { width: 48, height: 48, borderRadius: 18, backgroundColor: ClayColors.cardRose, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  confirmTitle: { color: ClayColors.textPrimary, fontSize: 18, fontWeight: '800' },
  confirmText: { color: ClayColors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 8 },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 22 },
  deleteButton: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: ClayColors.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomWidth: 3.5,
    borderBottomColor: ClayColors.dangerBevel,
    shadowColor: ClayColors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  deleteButtonText: { color: ClayColors.onPrimary, fontSize: 13, fontWeight: '800' },
});
