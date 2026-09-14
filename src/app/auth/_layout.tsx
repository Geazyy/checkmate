import { Stack, Redirect, usePathname } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
export default function AuthLayout() {
 const recovery = useAuthStore(s => s.recovery);
 const path = usePathname();
 if (recovery && !path.endsWith('/reset-password') && !path.endsWith('/callback')) return <Redirect href="/auth/reset-password" />;
 return <Stack initialRouteName="login" screenOptions={{ headerShown: false }} />;
}
