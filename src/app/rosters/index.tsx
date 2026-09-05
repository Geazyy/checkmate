import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Check, ChevronDown, ChevronUp, Plus, Search, UserRound, X } from 'lucide-react-native';
import { AppShell } from '../../components/common/AppShell';
import { useExamStore } from '../../store/useExamStore';
import { ClassSection, Student } from '../../types';
import { ClayCardStyle, ClayColors } from '../../constants/theme';

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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headingCopy}>
            <View style={styles.eyebrowChip}>
              <Text style={styles.eyebrow}>CLASS MANAGEMENT</Text>
            </View>
            <Text style={styles.sectionTitle}>Student Directory</Text>
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
            {isAddingClass ? <X size={17} color="#4F46E5" /> : <Plus size={17} color="#4F46E5" strokeWidth={2.4} />}
            <Text style={styles.secondaryBtnText}>{isAddingClass ? 'Close' : 'Add Class'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addBtn, !selectedClassId && styles.disabledBtn]}
            disabled={!selectedClassId}
            onPress={() => {
              setIsAdding((current) => !current);
              setIsAddingClass(false);
            }}>
            {isAdding ? <X size={17} color="#FFFFFF" /> : <Plus size={17} color="#FFFFFF" strokeWidth={2.4} />}
            <Text style={styles.addBtnText}>{isAdding ? 'Close' : 'Add Student'}</Text>
          </TouchableOpacity>
        </View>

        {isAddingClass && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Create Class Section</Text>
            <Text style={styles.formSub}>Add the class details, then build its roster.</Text>
            <Text style={styles.inputLabel}>Class Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Chemistry 201 - Sec B"
              placeholderTextColor="#94A3B8"
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
              placeholderTextColor="#94A3B8"
              value={classSubject}
              onChangeText={(value) => {
                setClassSubject(value);
                setClassError('');
              }}
            />
            <Text style={styles.inputLabel}>Academic Year</Text>
            <TextInput
              style={styles.input}
              placeholder="2026-2027"
              placeholderTextColor="#94A3B8"
              value={academicYear}
              onChangeText={setAcademicYear}
            />
            {!!classError && <Text style={styles.formError}>{classError}</Text>}
            <TouchableOpacity style={styles.submitBtn} onPress={handleAddClass}>
              <Text style={styles.submitText}>Save Class Section</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.classSelectorCard}>
          <Text style={styles.classSelectorTitle}>ACTIVE CLASS SECTION</Text>
          <TouchableOpacity
            style={[styles.classPickerButton, isClassPickerOpen && styles.classPickerButtonOpen]}
            onPress={() => setIsClassPickerOpen((current) => !current)}>
            <View style={styles.classPickerCopy}>
              <Text style={styles.classPickerValue} numberOfLines={1}>
                {selectedClass?.name ?? 'All Classes'}
              </Text>
              <Text style={styles.classPickerMeta} numberOfLines={1}>
                {selectedClass
                  ? `${selectedClass.subject} • ${selectedClass.academic_year} • ${visibleStudents.length} students`
                  : `${classes.length} class${classes.length === 1 ? '' : 'es'} • ${visibleStudents.length} students`}
              </Text>
            </View>
            {isClassPickerOpen
              ? <ChevronUp size={20} color="#4F46E5" />
              : <ChevronDown size={20} color="#4F46E5" />}
          </TouchableOpacity>

          {isClassPickerOpen && (
            <View style={styles.classPickerPanel}>
              <View style={styles.classSearchBar}>
                <Search size={17} color="#64748B" />
                <TextInput
                  style={styles.classSearchInput}
                  placeholder="Search class or subject"
                  placeholderTextColor="#94A3B8"
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
                  <Text style={styles.classOptionName}>All Classes</Text>
                  <Text style={styles.classOptionMeta}>{classes.length} class sections</Text>
                </View>
                {!selectedClassId && <Check size={18} color="#4F46E5" />}
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
                  {selectedClassId === cls.id && <Check size={18} color="#4F46E5" />}
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
            <Text style={styles.formTitle}>Add Student to Roster</Text>
            <Text style={styles.formSub}>Adding to {selectedClass?.name}.</Text>
            <Text style={styles.inputLabel}>Student ID Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 2026-045"
              placeholderTextColor="#94A3B8"
              value={studentNum}
              onChangeText={setStudentNum}
            />
            <Text style={styles.inputLabel}>First Name</Text>
            <TextInput
              style={styles.input}
              placeholder="First Name"
              placeholderTextColor="#94A3B8"
              value={firstName}
              onChangeText={setFirstName}
            />
            <Text style={styles.inputLabel}>Last Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Last Name"
              placeholderTextColor="#94A3B8"
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
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.rosterHeader}>
          <Text style={styles.rosterTitle}>Students Roster</Text>
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
            <Search size={28} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No students found</Text>
            <Text style={styles.emptyText}>Try another name or student ID.</Text>
          </View>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 980, alignSelf: 'center', padding: 20, paddingBottom: 60 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headingCopy: { flex: 1 },
  eyebrowChip: {
    backgroundColor: '#EEF2FF',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginBottom: 6,
  },
  eyebrow: { color: '#4F46E5', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  sectionTitle: { color: '#0F172A', fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  sectionSub: { color: '#64748B', fontSize: 13, marginTop: 4 },
  pageActions: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  secondaryBtn: {
    minHeight: 46,
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  secondaryBtnText: { color: '#4F46E5', fontSize: 13, fontWeight: '800' },
  addBtn: {
    minHeight: 46,
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomWidth: 3.5,
    borderBottomColor: '#3730A3',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  addBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  disabledBtn: { opacity: 0.5 },
  classSelectorCard: {
    ...ClayCardStyle,
    padding: 18,
    marginBottom: 20,
  },
  classSelectorTitle: { color: '#4F46E5', fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 8 },
  classPickerButton: {
    minHeight: 60,
    backgroundColor: '#EBF0F6',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  classPickerButtonOpen: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  classPickerCopy: { flex: 1, minWidth: 0 },
  classPickerValue: { color: '#0F172A', fontSize: 15, fontWeight: '800' },
  classPickerMeta: { color: '#64748B', fontSize: 11, fontWeight: '600', marginTop: 2 },
  classPickerPanel: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    padding: 10,
    shadowColor: '#8CA0BA',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  classSearchBar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#EBF0F6',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    marginBottom: 8,
  },
  classSearchInput: { flex: 1, color: '#0F172A', fontSize: 13, paddingVertical: 8, fontWeight: '600' },
  classOptionsList: { maxHeight: 238 },
  classOption: {
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  classOptionActive: { backgroundColor: '#EEF2FF' },
  classOptionCopy: { flex: 1, minWidth: 0 },
  classOptionName: { color: '#0F172A', fontSize: 13, fontWeight: '800' },
  classOptionMeta: { color: '#64748B', fontSize: 11, marginTop: 2, fontWeight: '600' },
  noClassResults: { paddingVertical: 24, alignItems: 'center' },
  noClassResultsText: { color: '#64748B', fontSize: 12, fontWeight: '600' },
  searchBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    minHeight: 50,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#8CA0BA',
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
  searchInput: { flex: 1, color: '#0F172A', fontSize: 13, paddingVertical: 10, fontWeight: '600' },
  rosterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  rosterTitle: { color: '#0F172A', fontSize: 16, fontWeight: '800' },
  rosterCount: { color: '#64748B', fontSize: 12, fontWeight: '700' },
  formCard: {
    ...ClayCardStyle,
    padding: 20,
    marginBottom: 20,
  },
  formTitle: { color: '#0F172A', fontSize: 16, fontWeight: '800', marginBottom: 4 },
  formSub: { color: '#64748B', fontSize: 12, marginBottom: 14 },
  inputLabel: { color: '#0F172A', fontSize: 12, fontWeight: '800', marginBottom: 6 },
  input: {
    backgroundColor: '#EBF0F6',
    borderRadius: 16,
    padding: 14,
    color: '#0F172A',
    fontSize: 13,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomWidth: 3.5,
    borderBottomColor: '#047857',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    marginTop: 4,
  },
  submitText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  formError: { color: '#EF4444', fontSize: 12, fontWeight: '700', marginBottom: 10 },
  studentCard: {
    ...ClayCardStyle,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPill: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: { color: '#4F46E5', fontSize: 14, fontWeight: '800' },
  studentDetails: { flex: 1 },
  studentName: { color: '#0F172A', fontSize: 14, fontWeight: '800' },
  studentSub: { color: '#64748B', fontSize: 12, marginTop: 2, fontWeight: '600' },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  emptyTitle: { color: '#0F172A', fontSize: 15, fontWeight: '800', marginTop: 12 },
  emptyText: { color: '#64748B', fontSize: 12, marginTop: 4 },
});
