import { useAppTheme } from '../constants/theme';

import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { startAuthentication } from '../services/auth/session';
import { useAuthStore } from '../store/useAuthStore';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function RootLayout() {
  const { ClayColors, mode } = useAppTheme();
  const { isLoading, session, recovery } = useAuthStore();
  useEffect(() => startAuthentication(), []);
  useEffect(() => { queryClient.clear(); }, [session?.user.id]);
  if (isLoading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, backgroundColor: ClayColors.bg }}>
    <ActivityIndicator color={ClayColors.primary} /><Text style={{ color: ClayColors.textPrimary }}>Opening CheckMate...</Text>
  </View>;
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: ClayColors.bg },
          animation: 'slide_from_right',
        }}>
        <Stack.Protected guard={!session || recovery}>
          <Stack.Screen name="auth" />
        </Stack.Protected>
        <Stack.Protected guard={!!session && !recovery}>
        <Stack.Screen name="index" />
        <Stack.Screen name="scan/index" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="scan/review" options={{ presentation: 'modal' }} />
        <Stack.Screen name="exams/index" />
        <Stack.Screen name="exams/[id]/index" />
        <Stack.Screen name="exams/[id]/answer-key" />
        <Stack.Screen name="exams/[id]/analytics" />
        <Stack.Screen name="answer-sheets/index" />
        <Stack.Screen name="rosters/index" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="help" />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}
