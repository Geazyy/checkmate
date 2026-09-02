import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Plus, Search, UserRound, X } from 'lucide-react-native';
import { AppShell } from '../../components/common/AppShell';
import { useExamStore } from '../../store/useExamStore';
import { Student } from '../../types';

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
  const { classes, selectedClassId, setSelectedClass } = useExamStore();
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [studentNum, setStudentNum] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const selectedClass = classes.find((cls) => cls.id === (selectedClassId ?? classes[0]?.id)) ?? classes[0];

  const handleAddStudent = () => {
    if (!firstName.trim() || !studentNum.trim()) return;

    const newStudent: Student = {
      id: `s-${Date.now()}`,
      teacher_id: 'demo-teacher-id',
      student_number: studentNum,
      first_name: firstName,
      last_name: lastName || 'Student',
      created_at: new Date().toISOString(),
    };

    setStudents([newStudent, ...students]);
    setFirstName('');
    setLastName('');
    setStudentNum('');
    setIsAdding(false);
  };

  const filteredStudents = students.filter(
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
          <TouchableOpacity style={styles.addBtn} onPress={() => setIsAdding(!isAdding)}>
            {isAdding ? <X size={17} color="#FFFFFF" /> : <Plus size={17} color="#FFFFFF" />}
            <Text style={styles.addBtnText}>{isAdding ? 'Close' : 'Add student'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.classSelectorCard}>
          <Text style={styles.classSelectorTitle}>Class section</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.classSelectorRow}>
            <TouchableOpacity
              style={[styles.classChip, !selectedClassId && styles.classChipActive]}
              onPress={() => setSelectedClass(null)}>
              <Text style={[styles.classChipText, !selectedClassId && styles.classChipTextActive]}>All</Text>
            </TouchableOpacity>
            {classes.map((cls) => (
              <TouchableOpacity
                key={cls.id}
                style={[styles.classChip, selectedClassId === cls.id && styles.classChipActive]}
                onPress={() => setSelectedClass(cls.id)}>
                <Text style={[styles.classChipText, selectedClassId === cls.id && styles.classChipTextActive]}>
                  {cls.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {selectedClass && (
            <View style={styles.classSummaryRow}>
              <View>
                <Text style={styles.classSummaryTitle}>{selectedClass.name}</Text>
                <Text style={styles.classSummarySub}>{selectedClass.subject} • {selectedClass.student_count ?? students.length} Students</Text>
              </View>
              <Text style={styles.classSummaryBadge}>{students.length} roster</Text>
            </View>
          )}
        </View>

        {/* Add Student Card Form */}
        {isAdding && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Add New Student to Roster</Text>
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
  addBtn: { minHeight: 42, backgroundColor: '#4F46E5', paddingHorizontal: 14, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 7 },
  addBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  classSelectorCard: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  classSelectorTitle: { color: '#94A3B8', fontSize: 11, fontWeight: '600', marginBottom: 10 },
  classSelectorRow: { gap: 8, paddingBottom: 10 },
  classChip: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  classChipActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  classChipText: { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  classChipTextActive: { color: '#FFFFFF' },
  classSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  classSummaryTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '700' },
  classSummarySub: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  classSummaryBadge: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    color: '#06B6D4',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    overflow: 'hidden',
  },
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
