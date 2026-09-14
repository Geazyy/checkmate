import React from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { styles } from '../../components/auth/AuthForm';
import { cloudConfigured } from '../../services/supabase/client';
export default function Callback() {
 const { session, recovery, isLoading, error } = useAuthStore();
 if (isLoading) return <ActivityIndicator />;
 if (session) return <Redirect href={recovery ? '/auth/reset-password' : '/'} />;
 if (error || !cloudConfigured) return <Redirect href="/auth/login" />;
 return <View style={styles.container}><ActivityIndicator /><Text style={styles.label}>Verifying link...</Text></View>;
}
