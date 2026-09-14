import { Link } from 'expo-router';
import { ScrollView, Text } from 'react-native';
import { AppShell } from '../components/common/AppShell';
import { styles } from '../components/auth/AuthForm';
export default function Help() {
 return <AppShell title="Help"><ScrollView contentContainerStyle={[styles.container, { alignItems: 'flex-start' }]}>
  <Text style={styles.title}>Help and support</Text>
  <Text style={styles.label}>For account access, use password reset or ask your school administrator. Never share your password or verification link.</Text>
  <Text style={styles.label}>Cloud changes retry automatically when connected. Unsynced records stay on this device. Review sync conflicts in Settings before switching devices.</Text>
  <Text style={styles.label}>To scan, select the matching exam and keep every answer bubble visible. Review flagged answers before grading.</Text>
  <Link href="/settings" style={styles.link}>Sync settings</Link>
  <Link href="/" style={styles.link}>Home</Link>
 </ScrollView></AppShell>;
}
