import { useAppTheme, useThemedStyles, AppTheme } from '../constants/theme';
import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { AppShell } from '../components/common/AppShell';
import { ActionButton } from '../components/common/Controls';
import { Spacing } from '../constants/theme';
import { useSettingsStore } from '../store/useSettingsStore';
import { SyncSettings } from '../components/auth/SyncSettings';
import { AppearanceControl } from '../components/common/AppearanceControl';

export default function SettingsScreen() {
  const { ClayColors } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { showConfidence, highlightFlagged, setPreference } = useSettingsStore();
  return <AppShell title="Settings">
    <ScrollView contentContainerStyle={styles.content}>
      <ActionButton accessibilityLabel="Back to Home" style={styles.back} onPress={() => router.replace('/')}>
        <ChevronLeft size={20} color={ClayColors.primary} /><Text style={styles.backText}>Home</Text>
      </ActionButton>
      <Text style={styles.title}>Settings</Text>
      <AppearanceControl />
      <SyncSettings />
      <Text style={styles.sectionTitle}>Scan review</Text>
      {[
        { key: 'showConfidence' as const, label: 'Confidence scores', value: showConfidence },
        { key: 'highlightFlagged' as const, label: 'Highlight answers needing review', value: highlightFlagged },
      ].map((item) => <View style={styles.row} key={item.key}>
        <Text style={styles.label}>{item.label}</Text>
        <Switch accessibilityLabel={item.label} value={item.value} onValueChange={(value) => setPreference(item.key, value)}
          trackColor={{ false: ClayColors.borderDarker, true: ClayColors.primary }} />
      </View>)}
    </ScrollView>
  </AppShell>;
}

const createStyles = ({ ClayColors }: AppTheme) => StyleSheet.create({
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: Spacing.four, gap: Spacing.three },
  back: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  backText: { color: ClayColors.primary, fontWeight: '700' },
  title: { color: ClayColors.textPrimary, fontSize: 26, fontWeight: '800' },
  sectionTitle: { color: ClayColors.textSecondary, fontSize: 16, fontWeight: '700', marginTop: Spacing.three },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderBottomColor: ClayColors.borderSubtle, borderBottomWidth: 1, paddingVertical: Spacing.two },
  label: { flex: 1, color: ClayColors.textPrimary, fontSize: 15, lineHeight: 22 },
});
