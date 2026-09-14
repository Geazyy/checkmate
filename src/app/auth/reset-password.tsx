import { Redirect } from 'expo-router';
import { AuthForm } from '../../components/auth/AuthForm';
import { useAuthStore } from '../../store/useAuthStore';
export default function ResetPassword() { const recovery = useAuthStore(s => s.recovery); return recovery ? <AuthForm mode="reset-password" /> : <Redirect href="/auth/forgot-password" />; }
