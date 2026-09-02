import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Check, ChevronDown, ChevronUp, Plus, Search, UserRound, X } from 'lucide-react-native';
import { AppShell } from '../../components/common/AppShell';
import { useExamStore } from '../../store/useExamStore';
import { ClassSection, Student } from '../../types';

const INITIAL_STUDENTS: Student[] = [
  {
    id: 's-1',
    teacher_id: 'demo-teacher-id',
    student_number: '2026-001',
    first_name: 'Alex',
    last_name: 'Rivera',
    email: 'arivera@student.edu',
    created_at: new Date().toISOString(),
  },
  {
    id: 's-2',
    teacher_id: 'demo-teacher-id',
    student_number: '2026-002',
    first_name: 'Marcus',
    last_name: 'Vance',
    email: 'mvance@student.edu',
    created_at: new Date().toISOString(),
  },
  {
    id: 's-3',
    teacher_id: 'demo-teacher-id',
    student_number: '2026-003',
    first_name: 'Sophia',
    last_name: 'Chen',
    email: 'schen@student.edu',
    created_at: new Date().toISOString(),
  },
];

export default function RosterScreen() {
  const { classes, selectedClassId, setSelectedClass, addClass } = useExamStore();
  const [studentsByClassId, setStudentsByClassId] = useState<Record<string, Student[]>>({
    'class-1': INITIAL_STUDENTS,
    'class-2': [],
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [studentNum, setStudentNum] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [className, setClassName] = useState('');
  const [classSubject, setClassSubject] = useState('');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [classError, setClassError] = useState('');
  const [isClassPickerOpen, setIsClassPickerOpen] = useState(false);
  const [classQuery, setClassQuery] = useState('');

  const selectedClass = selectedClassId
    ? classes.find((cls) => cls.id === selectedClassId)
    : undefined;
  const visibleStudents = selectedClassId
    ? studentsByClassId[selectedClassId] ?? []
    : Object.values(studentsByClassId).flat();
  const filteredClasses = classes.filter((cls) => {
    const query = classQuery.trim().toLowerCase();
    return !query || cls.name.toLowerCase().includes(query) || cls.subject.toLowerCase().includes(query);
  });

  const chooseClass = (classId: string | null) => {
    setSelectedClass(classId);
    setIsClassPickerOpen(false);
    setClassQuery('');
    setIsAdding(false);
  };

  const handleAddClass = () => {
    if (!className.trim() || !classSubject.trim()) {
      setClassError('Enter both a class name and subject.');
      return;
    }

    const newClass: ClassSection = {
      id: `class-${Date.now()}`,
      teacher_id: 'demo-teacher-id',
      name: className.trim(),
      subject: classSubject.trim(),
      academic_year: academicYear.trim() || '2026-2027',
      created_at: new Date().toISOString(),
      student_count: 0,
    };

    addClass(newClass);
    setStudentsByClassId((current) => ({ ...current, [newClass.id]: [] }));
    setClassName('');
    setClassSubject('');
    setAcademicYear('2026-2027');
    setClassError('');
    setIsAddingClass(false);
  };

  const handleAddStudent = () => {
    if (!firstName.trim() || !studentNum.trim() || !selectedClassId) return;

    const newStudent: Student = {
      id: `s-${Date.now()}`,
      teacher_id: 'demo-teacher-id',
      student_number: studentNum,
      first_name: firstName,
      last_name: lastName || 'Student',
      created_at: new Date().toISOString(),
    };

    setStudentsByClassId((current) => ({
      ...current,
      [selectedClassId]: [newStudent, ...(current[selectedClassId] ?? [])],
    }));
    setFirstName('');
    setLastName('');
    setStudentNum('');
    setIsAdding(false);
  };

  const filteredStudents = visibleStudents.filter(
    (s) =>
      s.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.student_number.includes(searchQuery)
  );

  return (
    <AppShell title="Classes">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>CLASS MANAGEMENT</Text>
            <Text style={styles.sectionTitle}>Student directory</Text>
            <Text style={styles.sectionSub}>Choose a class, then manage its roster.</Text>
          </View>
        </View>

        <View style={styles.pageActions}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => {
              setIsAddingClass((current) => !current);
              setIsAdding(false);
              setClassError('');
            }}>
            {isAddingClass ? <X size={17} color="#CBD5E1" /> : <Plus size={17} color="#CBD5E1" />}
            <Text style={styles.secondaryBtnText}>{isAddingClass ? 'Close' : 'Add class'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addBtn, !selectedClassId && styles.disabledBtn]}
            disabled={!selectedClassId}
            onPress={() => {
              setIsAdding((current) => !current);
              setIsAddingClass(false);
            }}>
            {isAdding ? <X size={17} color="#FFFFFF" /> : <Plus size={17} color="#FFFFFF" />}
            <Text style={styles.addBtnText}>{isAdding ? 'Close' : 'Add student'}</Text>
          </TouchableOpacity>
        </View>

        {isAddingClass && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Create class</Text>
            <Text style={styles.formSub}>Add the class details, then build its roster.</Text>
            <Text style={styles.inputLabel}>Class name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Chemistry 201 - Sec B"
              placeholderTextColor="#64748B"
              value={className}
              onChangeText={(value) => {
                setClassName(value);
                setClassError('');
              }}
            />
            <Text style={styles.inputLabel}>Subject</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Chemistry"
              placeholderTextColor="#64748B"
              value={classSubject}
              onChangeText={(value) => {
                setClassSubject(value);
                setClassError('');
              }}
            />
            <Text style={styles.inputLabel}>Academic year</Text>
            <TextInput
              style={styles.input}
              placeholder="2026-2027"
              placeholderTextColor="#64748B"
              value={academicYear}
              onChangeText={setAcademicYear}
            />
            {!!classError && <Text style={styles.formError}>{classError}</Text>}
            <TouchableOpacity style={styles.submitBtn} onPress={handleAddClass}>
              <Text style={styles.submitText}>Create class</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.classSelectorCard}>
          <Text style={styles.classSelectorTitle}>Class section</Text>
          <TouchableOpacity
            style={[styles.classPickerButton, isClassPickerOpen && styles.classPickerButtonOpen]}
            onPress={() => setIsClassPickerOpen((current) => !current)}>
            <View style={styles.classPickerCopy}>
              <Text style={styles.classPickerValue} numberOfLines={1}>
                {selectedClass?.name ?? 'All classes'}
              </Text>
              <Text style={styles.classPickerMeta} numberOfLines={1}>
                {selectedClass
                  ? `${selectedClass.subject} • ${selectedClass.academic_year} • ${visibleStudents.length} students`
                  : `${classes.length} class${classes.length === 1 ? '' : 'es'} • ${visibleStudents.length} students`}
              </Text>
            </View>
            {isClassPickerOpen
              ? <ChevronUp size={20} color="#94A3B8" />
              : <ChevronDown size={20} color="#94A3B8" />}
          </TouchableOpacity>

          {isClassPickerOpen && (
            <View style={styles.classPickerPanel}>
              <View style={styles.classSearchBar}>
                <Search size={17} color="#64748B" />
                <TextInput
                  style={styles.classSearchInput}
                  placeholder="Search class or subject"
                  placeholderTextColor="#64748B"
                  value={classQuery}
                  onChangeText={setClassQuery}
                  autoFocus
                />
              </View>
              <ScrollView
                style={styles.classOptionsList}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={filteredClasses.length > 5}>
              <TouchableOpacity
                style={[styles.classOption, !selectedClassId && styles.classOptionActive]}
                onPress={() => chooseClass(null)}>
                <View style={styles.classOptionCopy}>
                  <Text style={styles.classOptionName}>All classes</Text>
                  <Text style={styles.classOptionMeta}>{classes.length} class sections</Text>
                </View>
                {!selectedClassId && <Check size={18} color="#22D3EE" />}
              </TouchableOpacity>
              {filteredClasses.map((cls) => (
                <TouchableOpacity
                  key={cls.id}
                  style={[styles.classOption, selectedClassId === cls.id && styles.classOptionActive]}
                  onPress={() => chooseClass(cls.id)}>
                  <View style={styles.classOptionCopy}>
                    <Text style={styles.classOptionName} numberOfLines={1}>{cls.name}</Text>
                    <Text style={styles.classOptionMeta} numberOfLines={1}>
                      {cls.subject} • {(studentsByClassId[cls.id] ?? []).length} students
                    </Text>
                  </View>
                  {selectedClassId === cls.id && <Check size={18} color="#22D3EE" />}
                </TouchableOpacity>
              ))}
              {filteredClasses.length === 0 && (
                <View style={styles.noClassResults}>
                  <Text style={styles.noClassResultsText}>No matching classes</Text>
                </View>
              )}
              </ScrollView>
            </View>
          )}

        </View>

        {/* Add Student Card Form */}
        {isAdding && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Add New Student to Roster</Text>
            <Text style={styles.formSub}>Adding to {selectedClass?.name}.</Text>
            <TextInput
              style={styles.input}
              placeholder="Student ID # (e.g. 2026-045)"
              placeholderTextColor="#64748B"
              value={studentNum}
              onChangeText={setStudentNum}
            />
            <TextInput
              style={styles.input}
              placeholder="First Name"
              placeholderTextColor="#64748B"
              value={firstName}
              onChangeText={setFirstName}
            />
            <TextInput
              style={styles.input}
              placeholder="Last Name"
              placeholderTextColor="#64748B"
              value={lastName}
              onChangeText={setLastName}
            />

            <TouchableOpacity style={styles.submitBtn} onPress={handleAddStudent}>
              <Text style={styles.submitText}>Save Student Record</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search size={18} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search student name or ID"
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.rosterHeader}>
          <Text style={styles.rosterTitle}>Students</Text>
          <Text style={styles.rosterCount}>{filteredStudents.length} shown</Text>
        </View>

        {/* Student Roster Table List */}
        {filteredStudents.map((s) => (
          <View key={s.id} style={styles.studentCard}>
            <View style={styles.avatarPill}>
              <Text style={styles.avatarText}>
                {s.first_name[0]}
                {s.last_name[0]}
              </Text>
            </View>

            <View style={styles.studentDetails}>
              <Text style={styles.studentName}>
                {s.last_name}, {s.first_name}
              </Text>
              <Text style={styles.studentSub}>
                ID: {s.student_number} • {s.email || 'No email registered'}
              </Text>
            </View>

            <UserRound size={18} color="#64748B" />
          </View>
        ))}

        {filteredStudents.length === 0 && (
          <View style={styles.emptyState}>
            <Search size={24} color="#64748B" />
            <Text style={styles.emptyTitle}>No students found</Text>
            <Text style={styles.emptyText}>Try another name or student ID.</Text>
          </View>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F172A' },
  content: { width: '100%', maxWidth: 980, alignSelf: 'center', padding: 20, paddingBottom: 30 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headingCopy: { flex: 1 },
  eyebrow: { color: '#22D3EE', fontSize: 10, fontWeight: '800' },
  sectionTitle: { color: '#F8FAFC', fontSize: 23, fontWeight: '800', marginTop: 4 },
  sectionSub: { color: '#94A3B8', fontSize: 11, marginTop: 5 },
  pageActions: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  secondaryBtn: { minHeight: 42, flex: 1, borderWidth: 1, borderColor: '#475569', borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  secondaryBtnText: { color: '#CBD5E1', fontSize: 12, fontWeight: '700' },
  addBtn: { minHeight: 42, flex: 1, justifyContent: 'center', backgroundColor: '#4F46E5', paddingHorizontal: 14, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 7 },
  addBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  disabledBtn: { opacity: 0.45 },
  classSelectorCard: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  classSelectorTitle: { color: '#94A3B8', fontSize: 11, fontWeight: '600', marginBottom: 10 },
  classPickerButton: {
    minHeight: 58,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  classPickerButtonOpen: { borderColor: '#6366F1' },
  classPickerCopy: { flex: 1, minWidth: 0 },
  classPickerValue: { color: '#F8FAFC', fontSize: 13, fontWeight: '800' },
  classPickerMeta: { color: '#94A3B8', fontSize: 10, marginTop: 3 },
  classPickerPanel: {
    marginTop: 8,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 8,
  },
  classSearchBar: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 6,
  },
  classSearchInput: { flex: 1, color: '#F8FAFC', fontSize: 12, paddingVertical: 8 },
  classOptionsList: { maxHeight: 238 },
  classOption: {
    minHeight: 52,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  classOptionActive: { backgroundColor: 'rgba(79, 70, 229, 0.18)' },
  classOptionCopy: { flex: 1, minWidth: 0 },
  classOptionName: { color: '#E2E8F0', fontSize: 12, fontWeight: '700' },
  classOptionMeta: { color: '#64748B', fontSize: 10, marginTop: 3 },
  noClassResults: { paddingVertical: 24, alignItems: 'center' },
  noClassResultsText: { color: '#64748B', fontSize: 11 },
  searchBar: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: 46,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  searchInput: { flex: 1, color: '#F8FAFC', fontSize: 13, paddingVertical: 10 },
  rosterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 },
  rosterTitle: { color: '#E2E8F0', fontSize: 13, fontWeight: '800' },
  rosterCount: { color: '#64748B', fontSize: 10, fontWeight: '600' },
  formCard: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  formTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '700', marginBottom: 12 },
  formSub: { color: '#94A3B8', fontSize: 11, marginTop: -6, marginBottom: 12 },
  inputLabel: { color: '#CBD5E1', fontSize: 11, fontWeight: '700', marginBottom: 6 },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    color: '#F8FAFC',
    fontSize: 13,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  submitBtn: { backgroundColor: '#10B981', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  submitText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  formError: { color: '#FCA5A5', fontSize: 11, fontWeight: '700', marginBottom: 10 },
  studentCard: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  avatarPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  studentDetails: { flex: 1 },
  studentName: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  studentSub: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyTitle: { color: '#CBD5E1', fontSize: 13, fontWeight: '800', marginTop: 10 },
  emptyText: { color: '#64748B', fontSize: 10, marginTop: 4 },
});
