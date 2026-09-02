import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/useAuthStore';
import { useScanStore } from '../../store/useScanStore';
import { syncPendingScansToCloud } from '../../services/database/localDb';

export const AppHeader: React.FC<{ title?: string; compact?: boolean }> = ({ title = 'CheckMate', compact = false }) => {
  const insets = useSafeAreaInsets();
  const { user, isOnline } = useAuthStore();
  const { pendingSyncCount, setPendingSyncCount } = useScanStore();

  const handleSync = async () => {
    if (pendingSyncCount === 0) return;
    const { syncedCount } = await syncPendingScansToCloud();
    setPendingSyncCount(Math.max(0, pendingSyncCount - syncedCount));
  };

  return (
    <View style={[styles.container, { paddingTop: compact ? 18 : Math.max(16, insets.top + 10) }]}>
      <View>
        <Text style={styles.brandTitle}>{title}</Text>
        {user && <Text style={styles.welcomeText}>Hello, {user.full_name}</Text>}
      </View>

      <View style={styles.statusRow}>
        <View
          style={[
            styles.badge,
            { backgroundColor: isOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' },
          ]}>
          <View
            style={[
              styles.dot,
              { backgroundColor: isOnline ? '#10B981' : '#EF4444' },
            ]}
          />
          <Text style={[styles.badgeText, { color: isOnline ? '#10B981' : '#EF4444' }]}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>

        {pendingSyncCount > 0 && (
          <TouchableOpacity onPress={handleSync} style={styles.syncBtn}>
            <Text style={styles.syncText}>Sync ({pendingSyncCount})</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0,
  },
  welcomeText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  syncBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  syncText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
