import React, { ReactNode, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { ChevronRight, CircleHelp, ClipboardList, Home, LogOut, ScanLine, Settings, UserRound, Users, X } from 'lucide-react-native';
import { Href, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from './Header';
import { useExamStore } from '../../store/useExamStore';
import { useAuthStore } from '../../store/useAuthStore';

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
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const activeExam = useExamStore((state) => state.activeExam);
  const user = useAuthStore((state) => state.user);
  const [profileOpen, setProfileOpen] = useState(false);
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
        style={[sidebar ? styles.sideNavItem : styles.bottomNavItem, active && styles.navItemActive]}
        onPress={() => router.replace(item.href)}>
        <Icon size={20} color={active ? '#FFFFFF' : '#94A3B8'} strokeWidth={2} />
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
        <UserRound size={sidebar ? 18 : 20} color={sidebar ? '#FFFFFF' : '#94A3B8'} />
      </View>
      {sidebar ? (
        <>
          <View style={styles.profileCopy}>
            <Text style={styles.profileName} numberOfLines={1}>{user?.full_name ?? 'Teacher'}</Text>
            <Text style={styles.profileRole}>Teacher account</Text>
          </View>
          <ChevronRight size={16} color="#64748B" />
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
              <Text style={styles.brandSub}>OMR workspace</Text>
            </View>
          </View>
          <View style={styles.sideNav}>
            {NAV_ITEMS.slice(0, 2).map((item) => navButton(item, true))}
            <TouchableOpacity style={styles.sideScan} onPress={openScan}>
              <ScanLine size={20} color="#FFFFFF" />
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
              <ScanLine size={22} color="#FFFFFF" strokeWidth={2.4} />
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
              <View style={styles.largeAvatar}><UserRound size={24} color="#FFFFFF" /></View>
              <View style={styles.profilePanelCopy}>
                <Text style={styles.profilePanelName}>{user?.full_name ?? 'Teacher'}</Text>
                <Text style={styles.profilePanelEmail}>{user?.email ?? 'Account details coming soon'}</Text>
              </View>
              <TouchableOpacity accessibilityLabel="Close profile menu" style={styles.closeButton} onPress={() => setProfileOpen(false)}>
                <X size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <View style={styles.profileMenuDivider} />
            {[
              { label: 'Settings', icon: Settings },
              { label: 'Help and support', icon: CircleHelp },
              { label: 'Log out', icon: LogOut },
            ].map(({ label, icon: Icon }) => (
              <View key={label} style={styles.profileMenuItem}>
                <Icon size={18} color={label === 'Log out' ? '#FCA5A5' : '#94A3B8'} />
                <Text style={[styles.profileMenuLabel, label === 'Log out' && styles.logoutLabel]}>{label}</Text>
                <Text style={styles.soonLabel}>Soon</Text>
              </View>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: '#0F172A' },
  main: { flex: 1, minWidth: 0 },
  content: { flex: 1, paddingBottom: 76 },
  desktopContent: { paddingBottom: 0 },
  sidebar: { width: 236, backgroundColor: '#111C30', borderRightWidth: 1, borderRightColor: '#263449', padding: 18 },
  brandBlock: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 32 },
  brandMark: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  brand: { color: '#F8FAFC', fontSize: 17, fontWeight: '800' },
  brandSub: { color: '#64748B', fontSize: 10, marginTop: 1 },
  sideNav: { gap: 6 },
  sideNavItem: { minHeight: 44, paddingHorizontal: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  bottomNavItem: { flex: 1, minWidth: 0, height: 50, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 8 },
  navItemActive: { backgroundColor: '#263449' },
  navLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  navLabelActive: { color: '#FFFFFF' },
  sideScan: { minHeight: 46, marginVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#4F46E5', flexDirection: 'row', alignItems: 'center', gap: 12 },
  sideScanText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  activeExamBlock: { marginTop: 'auto', padding: 12, backgroundColor: '#0F172A', borderRadius: 8, borderWidth: 1, borderColor: '#263449' },
  activeExamLabel: { color: '#64748B', fontSize: 9, fontWeight: '700' },
  activeExamTitle: { color: '#CBD5E1', fontSize: 12, fontWeight: '600', marginTop: 5, lineHeight: 17 },
  bottomNav: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 68, paddingTop: 7, paddingHorizontal: 8, backgroundColor: '#111C30', borderTopWidth: 1, borderTopColor: '#334155', flexDirection: 'row', alignItems: 'center', zIndex: 50 },
  scanTab: { flex: 1, minWidth: 0, height: 56, marginTop: -10, alignItems: 'center', justifyContent: 'center', gap: 2 },
  scanTabIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#111C30' },
  scanTabText: { color: '#94A3B8', fontSize: 10, fontWeight: '700' },
  profileButton: { minHeight: 56, marginTop: 10, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: '#263449', flexDirection: 'row', alignItems: 'center', gap: 9 },
  profileAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' },
  profileCopy: { flex: 1, minWidth: 0 },
  profileName: { color: '#E2E8F0', fontSize: 11, fontWeight: '700' },
  profileRole: { color: '#64748B', fontSize: 9, marginTop: 2 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.68)', justifyContent: 'flex-end' },
  profilePanel: { backgroundColor: '#182438', borderWidth: 1, borderColor: '#334155', padding: 16 },
  profilePanelDesktop: { position: 'absolute', left: 18, bottom: 18, width: 300, borderRadius: 8 },
  profilePanelMobile: { width: '100%', borderTopLeftRadius: 8, borderTopRightRadius: 8, paddingBottom: 28 },
  profilePanelHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  largeAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center' },
  profilePanelCopy: { flex: 1, minWidth: 0 },
  profilePanelName: { color: '#F8FAFC', fontSize: 14, fontWeight: '800' },
  profilePanelEmail: { color: '#94A3B8', fontSize: 10, marginTop: 3 },
  closeButton: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  profileMenuDivider: { height: 1, backgroundColor: '#334155', marginVertical: 13 },
  profileMenuItem: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, borderRadius: 8, opacity: 0.72 },
  profileMenuLabel: { flex: 1, color: '#CBD5E1', fontSize: 12, fontWeight: '600' },
  logoutLabel: { color: '#FCA5A5' },
  soonLabel: { color: '#64748B', fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
});
