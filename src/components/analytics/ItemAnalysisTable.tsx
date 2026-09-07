import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { QuestionItemAnalysis } from '../../types';
import { ClayCardStyle, ClayColors } from '../../constants/theme';

interface ItemAnalysisTableProps {
  items: QuestionItemAnalysis[];
}

export const ItemAnalysisTable: React.FC<ItemAnalysisTableProps> = ({ items }) => {
  const getBadgeStyle = (label: string) => {
    switch (label) {
      case 'Excellent':
      case 'Easy':
      case 'Moderate':
        return { bg: ClayColors.cardMint, text: ClayColors.success };
      case 'Good':
      case 'Acceptable':
        return { bg: ClayColors.cardSky, text: ClayColors.skyText };
      case 'Poor':
      case 'Hard':
        return { bg: ClayColors.cardAmber, text: ClayColors.warning };
      default:
        return { bg: ClayColors.cardRose, text: ClayColors.danger };
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
    ...ClayCardStyle,
    padding: 16,
    marginBottom: 20,
  },
  headerTitle: {
    color: ClayColors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
    borderBottomColor: ClayColors.borderSubtle,
    paddingBottom: 8,
    marginBottom: 8,
  },
  colHeader: {
    color: ClayColors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: ClayColors.surfaceInset,
  },
  cellText: {
    color: ClayColors.textPrimary,
    fontSize: 13,
  },
  valText: {
    color: ClayColors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  subText: {
    color: ClayColors.textMuted,
    fontSize: 11,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
