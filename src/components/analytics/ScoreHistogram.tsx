import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ClayCardStyle, ClayColors } from '../../constants/theme';

interface HistogramProps {
  data: { range: string; count: number }[];
}

export const ScoreHistogram: React.FC<HistogramProps> = ({ data }) => {
  const maxCount = Math.max(1, ...data.map((d) => d.count));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Score Distribution</Text>
      <View style={styles.chartArea}>
        {data.map((item, index) => {
          const heightPercent = Math.round((item.count / maxCount) * 100);
          return (
            <View key={index} style={styles.barColumn}>
              <Text style={styles.countLabel}>{item.count}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { height: `${Math.max(8, heightPercent)}%` },
                  ]}
                />
              </View>
              <Text style={styles.rangeLabel}>{item.range}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...ClayCardStyle,
    padding: 16,
    marginBottom: 16,
  },
  title: {
    color: ClayColors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 140,
    paddingTop: 20,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
  },
  countLabel: {
    color: ClayColors.primary,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  barTrack: {
    width: 26,
    height: 90,
    backgroundColor: ClayColors.borderSubtle,
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: ClayColors.borderDarker,
  },
  barFill: {
    width: '100%',
    backgroundColor: ClayColors.primary,
    borderRadius: 6,
  },
  rangeLabel: {
    color: ClayColors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },
});
