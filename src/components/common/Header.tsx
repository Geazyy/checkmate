import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/useAuthStore';
import { ClayColors } from '../../constants/theme';
import { CheckCircle2 } from 'lucide-react-native';
import { useSyncStatus } from '../../store/storage';

export const AppHeader: React.FC<{ title?: string; compact?: boolean }> = ({ title = 'CheckMate', compact = false }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const sync = useSyncStatus();

  return (
    <View style={[styles.container, { paddingTop: compact ? 16 : Math.max(16, insets.top + 8) }]}>
      <View style={styles.titleGroup}>
        <View style={styles.brandBadge}>
          <Text style={styles.brandTitle}>{title}</Text>
        </View>
        {user && <Text style={styles.welcomeText}>Welcome back, {user.full_name}</Text>}
      </View>

      <View style={styles.rightGroup}>
        <View style={styles.offlineChip}>
          <CheckCircle2 size={13} color={ClayColors.success} />
          <Text style={styles.offlineChipText}>{sync.pending ? 'Saved locally' : sync.status}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: ClayColors.bg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleGroup: {
    flex: 1,
    minWidth: 0,
    marginRight: 10,
    flexDirection: 'column',
    gap: 3,
  },
  brandBadge: {
    maxWidth: '100%',
    backgroundColor: ClayColors.onPrimary,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: ClayColors.shadow,
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '4px 4px 10px rgba(160, 175, 195, 0.35), -3px -3px 8px rgba(255, 255, 255, 0.9)',
        } as any)
      : {}),
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: ClayColors.primary,
    letterSpacing: 0,
  },
  welcomeText: {
    fontSize: 12,
    fontWeight: '600',
    color: ClayColors.textMuted,
    marginTop: 2,
    paddingLeft: 2,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offlineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ClayColors.cardMint,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: ClayColors.mintBorder,
    gap: 6,
    shadowColor: ClayColors.shadow,
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '3px 3px 6px rgba(160, 175, 195, 0.25), -2px -2px 6px rgba(255, 255, 255, 0.9)',
        } as any)
      : {}),
  },
  offlineChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: ClayColors.success,
  },
});
