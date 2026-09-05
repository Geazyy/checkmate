import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#F0F4F8' },
          animation: 'slide_from_right',
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="scan/index" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="scan/review" options={{ presentation: 'modal' }} />
        <Stack.Screen name="exams/index" />
        <Stack.Screen name="exams/[id]/index" />
        <Stack.Screen name="exams/[id]/answer-key" />
        <Stack.Screen name="exams/[id]/analytics" />
        <Stack.Screen name="answer-sheets/index" />
        <Stack.Screen name="rosters/index" />
      </Stack>
    </QueryClientProvider>
  );
}
