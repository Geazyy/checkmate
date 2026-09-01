import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
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
    color: '#06B6D4',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  barTrack: {
    width: 24,
    height: 90,
    backgroundColor: '#0F172A',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 6,
  },
  rangeLabel: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 6,
  },
});
