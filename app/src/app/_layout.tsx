import { Rajdhani_600SemiBold, Rajdhani_700Bold, useFonts } from '@expo-google-fonts/rajdhani';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Colors } from '@/constants/theme';
import { StoreProvider, useStore } from '@/data/store';

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

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Rajdhani_600SemiBold, Rajdhani_700Bold });

  return (
    <ThemeProvider value={navigationTheme}>
      <StoreProvider>
        <StatusBar style="light" />
        <RootNavigator fontsReady={fontsLoaded || !!fontError} />
      </StoreProvider>
    </ThemeProvider>
  );
}

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { ready, profile } = useStore();
  const appReady = ready && fontsReady;

  useEffect(() => {
    if (appReady) SplashScreen.hideAsync();
  }, [appReady]);

  // Keep the splash screen up until fonts and saved data have loaded.
  if (!appReady) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'slide_from_right',
      }}>
      <Stack.Protected guard={!!profile}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="tournament/[id]" />
        <Stack.Screen name="join/[id]" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="host/new" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="host/[id]" />
      </Stack.Protected>
      <Stack.Protected guard={!profile}>
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      </Stack.Protected>
    </Stack>
  );
}
