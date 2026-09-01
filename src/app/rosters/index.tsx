import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AppHeader } from '../../components/common/Header';
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
    <View style={styles.screen}>
      <AppHeader title="Roster & Student Manager" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>Student Directory</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setIsAdding(!isAdding)}>
            <Text style={styles.addBtnText}>{isAdding ? '✕ Close' : '＋ Add Student'}</Text>
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
        <TextInput
          style={styles.searchBar}
          placeholder="🔍 Search student name or ID..."
          placeholderTextColor="#64748B"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

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

            <TouchableOpacity style={styles.qrBtn}>
              <Text style={styles.qrText}>QR</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 16 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  addBtn: { backgroundColor: '#4F46E5', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14 },
  addBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  classSelectorCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  classSelectorTitle: { color: '#94A3B8', fontSize: 11, fontWeight: '600', marginBottom: 10 },
  classSelectorRow: { gap: 8, paddingBottom: 10 },
  classChip: {
    backgroundColor: '#0F172A',
    borderRadius: 999,
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
    borderRadius: 12,
    padding: 12,
    color: '#F8FAFC',
    fontSize: 13,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  formCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
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
    borderRadius: 14,
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
  qrBtn: { backgroundColor: 'rgba(6, 182, 212, 0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  qrText: { color: '#06B6D4', fontSize: 11, fontWeight: '700' },
});
