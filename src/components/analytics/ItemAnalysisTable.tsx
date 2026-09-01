import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { QuestionItemAnalysis } from '../../types';

interface ItemAnalysisTableProps {
  items: QuestionItemAnalysis[];
}

export const ItemAnalysisTable: React.FC<ItemAnalysisTableProps> = ({ items }) => {
  const getBadgeStyle = (label: string) => {
    switch (label) {
      case 'Excellent':
      case 'Easy':
      case 'Moderate':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981' };
      case 'Good':
      case 'Acceptable':
        return { bg: 'rgba(6, 182, 212, 0.15)', text: '#06B6D4' };
      case 'Poor':
      case 'Hard':
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B' };
      default:
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444' };
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Item Analysis & Question Quality</Text>
      
      <View style={styles.tableHeader}>
        <Text style={[styles.colHeader, { flex: 0.8 }]}>Item #</Text>
        <Text style={[styles.colHeader, { flex: 1.2 }]}>Diff (P)</Text>
        <Text style={[styles.colHeader, { flex: 1.2 }]}>Disc (D)</Text>
        <Text style={[styles.colHeader, { flex: 1.5 }]}>Quality</Text>
      </View>

      {items.slice(0, 15).map((item) => {
        const badge = getBadgeStyle(item.discrimination_label);
        return (
          <View key={item.question_number} style={styles.row}>
            <Text style={[styles.cellText, { flex: 0.8, fontWeight: '700' }]}>
              Q{item.question_number}
            </Text>

            <View style={{ flex: 1.2 }}>
              <Text style={styles.valText}>{item.difficulty_index}</Text>
              <Text style={styles.subText}>{item.difficulty_label}</Text>
            </View>

            <View style={{ flex: 1.2 }}>
              <Text style={styles.valText}>{item.discrimination_index}</Text>
              <Text style={styles.subText}>{item.discrimination_label}</Text>
            </View>

            <View style={{ flex: 1.5 }}>
              <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.badgeText, { color: badge.text }]}>
                  {item.discrimination_label === 'Flawed' ? '⚠️ Flawed' : item.discrimination_label}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 14,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 8,
    marginBottom: 8,
  },
  colHeader: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
  },
  cellText: {
    color: '#F8FAFC',
    fontSize: 13,
  },
  valText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
  },
  subText: {
    color: '#94A3B8',
    fontSize: 10,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
