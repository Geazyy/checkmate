import { useAppTheme, useThemedStyles, AppTheme } from '../../constants/theme';
import { ActionButton as TouchableOpacity } from './Controls';

import React, { ReactNode, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ChevronRight, CircleHelp, ClipboardList, Home, LogOut, ScanLine, Settings, UserRound, Users, X } from 'lucide-react-native';
import { Href, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from './Header';
import { useExamStore } from '../../store/useExamStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Avatar } from '../auth/Avatar';
import { logout } from '../../services/auth/session';
import { friendlyAuthError } from '../../services/auth/errors';
import { AppearanceControl } from './AppearanceControl';

type AppShellProps = {
  title: string;
  children: ReactNode;
};

const NAV_ITEMS = [
  { label: 'Home', href: '/' as Href, icon: Home, matches: (path: string) => path === '/' },
  { label: 'Exams', href: '/exams' as Href, icon: ClipboardList, matches: (path: string) => path.startsWith('/exams') },
  { label: 'Classes', href: '/rosters' as Href, icon: Users, matches: (path: string) => path.startsWith('/rosters') },
];

export function AppShell({ title, children }: AppShellProps) {
  const { ClayColors } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const activeExam = useExamStore((state) => state.activeExam);
  const user = useAuthStore((state) => state.user);
  const [profileOpen, setProfileOpen] = useState(false);
  const profile = useAuthStore(state => state.profile);
  const session = useAuthStore(state => state.session);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const desktop = width >= 900;
  const showHeader = pathname === '/';

  const openScan = () => {
    router.push('/scan');
  };

  const navButton = (item: (typeof NAV_ITEMS)[number], sidebar: boolean) => {
    const active = item.matches(pathname);
    const Icon = item.icon;
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        key={item.label}
        style={[
          sidebar ? styles.sideNavItem : styles.bottomNavItem,
          active && (sidebar ? styles.sideNavItemActive : styles.bottomNavItemActive),
        ]}
        onPress={() => router.replace(item.href)}>
        <Icon size={20} color={active ? ClayColors.primary : ClayColors.textMuted} strokeWidth={active ? 2.5 : 2} />
        <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
      </TouchableOpacity>
    );
  };

  const profileButton = (sidebar: boolean) => (
    <TouchableOpacity
      accessibilityLabel="Open profile menu"
      style={sidebar ? styles.profileButton : styles.bottomNavItem}
      onPress={() => setProfileOpen(true)}>
      <View style={sidebar ? styles.profileAvatar : undefined}>
        <UserRound size={sidebar ? 18 : 20} color={sidebar ? ClayColors.primary : ClayColors.textMuted} />
      </View>
      {sidebar ? (
        <>
          <View style={styles.profileCopy}>
            <Text style={styles.profileName} numberOfLines={1}>{user?.full_name ?? 'Teacher'}</Text>
            <Text style={styles.profileRole}>{profile?.role ?? 'Teacher'}</Text>
          </View>
          <ChevronRight size={16} color={ClayColors.textMuted} />
        </>
      ) : <Text style={styles.navLabel}>Profile</Text>}
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      {desktop && (
        <View style={[styles.sidebar, { paddingTop: Math.max(24, insets.top + 16) }]}>
          <View style={styles.brandBlock}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>C</Text></View>
            <View>
              <Text style={styles.brand}>CheckMate</Text>
              <Text style={styles.brandSub}>Offline OMR Scanner</Text>
            </View>
          </View>
          <View style={styles.sideNav}>
            {NAV_ITEMS.slice(0, 2).map((item) => navButton(item, true))}
            <TouchableOpacity style={styles.sideScan} onPress={openScan}>
              <ScanLine size={20} color={ClayColors.onPrimary} strokeWidth={2.4} />
              <Text style={styles.sideScanText}>Scan sheet</Text>
            </TouchableOpacity>
            {NAV_ITEMS.slice(2).map((item) => navButton(item, true))}
          </View>
          <View style={styles.activeExamBlock}>
            <Text style={styles.activeExamLabel}>ACTIVE EXAM</Text>
            <Text style={styles.activeExamTitle} numberOfLines={2}>{activeExam?.title ?? 'Select an exam'}</Text>
          </View>
          {profileButton(true)}
        </View>
      )}

      <View style={styles.main}>
        {showHeader && <AppHeader title={title} compact={desktop} />}
        <View
          style={[
            styles.content,
            desktop && styles.desktopContent,
            !showHeader && !desktop && { paddingTop: insets.top },
          ]}>
          {children}
        </View>
      </View>

      {!desktop && (
        <View style={[styles.bottomNav, { paddingBottom: Math.max(8, insets.bottom) }]}>
          {NAV_ITEMS.slice(0, 2).map((item) => navButton(item, false))}
          <TouchableOpacity accessibilityLabel="Scan answer sheet" style={styles.scanTab} onPress={openScan}>
            <View style={styles.scanTabIcon}>
              <ScanLine size={22} color={ClayColors.onPrimary} strokeWidth={2.4} />
            </View>
            <Text style={styles.scanTabText}>Scan</Text>
          </TouchableOpacity>
          {NAV_ITEMS.slice(2).map((item) => navButton(item, false))}
          {profileButton(false)}
        </View>
      )}

      <Modal visible={profileOpen} transparent animationType="fade" onRequestClose={() => setProfileOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setProfileOpen(false)}>
          <Pressable style={[styles.profilePanel, desktop ? styles.profilePanelDesktop : styles.profilePanelMobile]} onPress={() => undefined}>
            <View style={styles.profilePanelHeader}>
              <Avatar />
              <View style={styles.profilePanelCopy}>
                <Text style={styles.profilePanelName}>{user?.full_name ?? 'Teacher'}</Text>
                <Text style={styles.profilePanelEmail}>{user?.email} {session?.user.email_confirmed_at ? '(verified)' : ''}</Text>
                {!!profile?.school_name && <Text style={styles.profilePanelEmail}>{profile.school_name}</Text>}
                {!!profile?.teacher_id && <Text style={styles.profilePanelEmail}>ID: {profile.teacher_id}</Text>}
                <Text style={styles.profilePanelEmail}>{profile?.role ?? 'teacher'}</Text>
              </View>
              <TouchableOpacity accessibilityLabel="Close profile menu" style={styles.closeButton} onPress={() => setProfileOpen(false)}>
                <X size={18} color={ClayColors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.profileMenuDivider} />
            <AppearanceControl />
            {[
              { label: 'Edit profile', icon: UserRound },
              { label: 'Settings', icon: Settings },
              { label: 'Help and support', icon: CircleHelp },
              { label: 'Log out', icon: LogOut },
            ].map(({ label, icon: Icon }) => (
              <TouchableOpacity key={label} disabled={loggingOut} style={styles.profileMenuItem}
                onPress={() => {
                  if (label === 'Log out') { setConfirmLogout(true); setLogoutError(''); return; }
                  setProfileOpen(false);
                  router.push(label === 'Settings' ? '/settings' : label === 'Edit profile' ? '/profile' : '/help');
                }}>
                <Icon size={18} color={label === 'Log out' ? ClayColors.danger : ClayColors.textMuted} />
                <Text style={[styles.profileMenuLabel, label === 'Log out' && styles.logoutLabel]}>{label}</Text>
                <ChevronRight size={18} color={ClayColors.textMuted} />
              </TouchableOpacity>
            ))}
            {confirmLogout && <View style={{ gap: 10, marginTop: 10 }}>
              <Text style={styles.profilePanelEmail}>Log out of CheckMate? Unsynced work will stay in the private local cache for this account.</Text>
              {!!logoutError && <Text accessibilityRole="alert" style={styles.logoutLabel}>{logoutError}</Text>}
              <TouchableOpacity disabled={loggingOut} style={[styles.profileMenuItem, { backgroundColor: ClayColors.cardRose }]}
                onPress={() => {
                  setLoggingOut(true);
                  void logout().catch(error => setLogoutError(friendlyAuthError(error))).finally(() => setLoggingOut(false));
                }}>
                <LogOut color={ClayColors.danger} size={18} /><Text style={styles.logoutLabel}>{loggingOut ? 'Logging out...' : 'Confirm log out'}</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={loggingOut} onPress={() => setConfirmLogout(false)}><Text style={styles.profileMenuLabel}>Cancel</Text></TouchableOpacity>
            </View>}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const createStyles = ({ ClayColors }: AppTheme) => StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: ClayColors.bg },
  main: { flex: 1, minWidth: 0 },
  content: { flex: 1, paddingBottom: 76 },
  desktopContent: { paddingBottom: 0 },
  sidebar: {
    width: 240,
    backgroundColor: ClayColors.cardBg,
    borderRightWidth: 2,
    borderRightColor: ClayColors.borderSubtle,
    padding: 18,
    shadowColor: ClayColors.shadow,
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '6px 0 16px rgba(160, 175, 195, 0.25)',
        } as any)
      : {}),
  },
  brandBlock: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: ClayColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomWidth: 3,
    borderBottomColor: ClayColors.primaryBevel,
    shadowColor: ClayColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  brandMarkText: { color: ClayColors.onPrimary, fontSize: 19, fontWeight: '800' },
  brand: { color: ClayColors.textPrimary, fontSize: 18, fontWeight: '800', letterSpacing: 0 },
  brandSub: { color: ClayColors.textMuted, fontSize: 10, fontWeight: '600', marginTop: 1 },
  sideNav: { gap: 8 },
  sideNavItem: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: ClayColors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  sideNavItemActive: {
    backgroundColor: ClayColors.cardIndigo,
    borderColor: ClayColors.indigoBorder,
    shadowColor: ClayColors.shadow,
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '3px 3px 8px rgba(160, 175, 195, 0.25), -2px -2px 6px rgba(255, 255, 255, 0.9)',
        } as any)
      : {}),
  },
  bottomNavItem: {
    flex: 1,
    minWidth: 0,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 14,
  },
  bottomNavItemActive: {
    backgroundColor: ClayColors.cardIndigo,
    borderRadius: 14,
  },
  navLabel: { color: ClayColors.textMuted, fontSize: 11, fontWeight: '600' },
  navLabelActive: { color: ClayColors.primary, fontWeight: '800' },
  sideScan: {
    minHeight: 48,
    marginVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: ClayColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomWidth: 4,
    borderBottomColor: ClayColors.primaryBevel,
    shadowColor: ClayColors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  sideScanText: { color: ClayColors.onPrimary, fontSize: 13, fontWeight: '700' },
  activeExamBlock: {
    marginTop: 'auto',
    padding: 14,
    backgroundColor: ClayColors.cardIndigo,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: ClayColors.indigoBorder,
    shadowColor: ClayColors.shadow,
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  activeExamLabel: { color: ClayColors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 0 },
  activeExamTitle: { color: ClayColors.textPrimary, fontSize: 12, fontWeight: '700', marginTop: 4, lineHeight: 17 },
  bottomNav: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    minHeight: 64,
    paddingTop: 4,
    paddingHorizontal: 8,
    backgroundColor: ClayColors.cardBg,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 50,
    shadowColor: ClayColors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 8px 24px rgba(160, 175, 195, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.9)',
        } as any)
      : {}),
  },
  scanTab: { flex: 1, minWidth: 0, height: 56, marginTop: -14, alignItems: 'center', justifyContent: 'center', gap: 2 },
  scanTabIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: ClayColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderBottomWidth: 3,
    borderBottomColor: ClayColors.primaryBevel,
    shadowColor: ClayColors.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  scanTabText: { color: ClayColors.primary, fontSize: 10, fontWeight: '800' },
  profileButton: {
    minHeight: 56,
    marginTop: 12,
    paddingHorizontal: 8,
    borderTopWidth: 1.5,
    borderTopColor: ClayColors.borderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profileAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: ClayColors.cardIndigo,
    borderWidth: 1.5,
    borderColor: ClayColors.indigoBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCopy: { flex: 1, minWidth: 0 },
  profileName: { color: ClayColors.textPrimary, fontSize: 12, fontWeight: '700' },
  profileRole: { color: ClayColors.textMuted, fontSize: 9, fontWeight: '600', marginTop: 1 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
  profilePanel: {
    backgroundColor: ClayColors.cardBg,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    padding: 20,
    shadowColor: ClayColors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  profilePanelDesktop: { position: 'absolute', left: 18, bottom: 18, width: 310, borderRadius: 24 },
  profilePanelMobile: { width: '100%', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 32 },
  profilePanelHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  largeAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ClayColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomWidth: 3,
    borderBottomColor: ClayColors.primaryBevel,
  },
  profilePanelCopy: { flex: 1, minWidth: 0 },
  profilePanelName: { color: ClayColors.textPrimary, fontSize: 15, fontWeight: '800' },
  profilePanelEmail: { color: ClayColors.textMuted, fontSize: 11, marginTop: 2 },
  closeButton: { width: 34, height: 34, borderRadius: 12, backgroundColor: ClayColors.surfaceInset, alignItems: 'center', justifyContent: 'center' },
  profileMenuDivider: { height: 1.5, backgroundColor: ClayColors.borderSubtle, marginVertical: 14 },
  profileMenuItem: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, borderRadius: 14, backgroundColor: ClayColors.surfaceMuted, marginBottom: 6 },
  profileMenuLabel: { flex: 1, color: ClayColors.textPrimary, fontSize: 13, fontWeight: '600' },
  logoutLabel: { color: ClayColors.danger, fontWeight: '700' },
  soonLabel: { color: ClayColors.textMuted, fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
});
