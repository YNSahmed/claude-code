import { Rajdhani_600SemiBold, Rajdhani_700Bold, useFonts } from '@expo-google-fonts/rajdhani';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { ApiError } from '@/api/client';
import { AuthProvider, useAuth } from '@/auth/auth-context';
import { Colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.primary,
    background: Colors.background,
    card: Colors.surface,
    text: Colors.text,
    border: Colors.border,
  },
};

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        // Don't retry answers the server gave on purpose (4xx); do retry network blips.
        retry: (count, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
      },
    },
  });
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Rajdhani_600SemiBold, Rajdhani_700Bold });
  const [queryClient] = useState(createQueryClient);

  return (
    <ThemeProvider value={navigationTheme}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="light" />
          <RootNavigator fontsReady={fontsLoaded || !!fontError} />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { state, user, isAdmin } = useAuth();
  const ready = fontsReady && state.status !== 'loading';
  const signedIn = state.status === 'signedIn';
  const needsProfile = !!user?.needsProfile;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'slide_from_right',
      }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && needsProfile}>
        <Stack.Screen name="complete-profile" options={{ animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !needsProfile}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="tournament/[id]" />
        <Stack.Screen name="register/[id]" options={{ animation: 'slide_from_bottom' }} />
      </Stack.Protected>
      {/* Organizer screens. The server enforces this too; hiding them is just good manners. */}
      <Stack.Protected guard={signedIn && !needsProfile && isAdmin}>
        <Stack.Screen name="admin/new" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="admin/[id]" />
        <Stack.Screen name="admin/poster/[id]" />
        <Stack.Screen name="admin/settings" />
        <Stack.Screen name="admin/players" />
      </Stack.Protected>
    </Stack>
  );
}
