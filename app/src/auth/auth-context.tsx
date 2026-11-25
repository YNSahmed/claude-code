import { useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';

import { ApiError, api, setAuthToken, setUnauthorizedHandler } from '@/api/client';
import type { User } from '@/api/types';

/**
 * The signed-in session. The access token lives in the device keychain (iOS Keychain /
 * Android Keystore via expo-secure-store), never in plain storage. On web, where there is no
 * keychain, it falls back to localStorage, which is fine for testing but not for real use.
 */

const TOKEN_KEY = 'clutch-arena.session';

const tokenStore = {
  async get(): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null;
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(TOKEN_KEY);
  },
  async set(token: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.setItem(TOKEN_KEY, token);
      } catch {
        // Private browsing: the session lasts until the tab closes.
      }
      return;
    }
    await SecureStore.setItemAsync(TOKEN_KEY, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  async clear(): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.removeItem(TOKEN_KEY);
      } catch {
        // Nothing stored.
      }
      return;
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};

type AuthState =
  { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; user: User };

interface AuthValue {
  state: AuthState;
  user: User | null;
  isAdmin: boolean;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const signOut = useCallback(async () => {
    setAuthToken(null);
    await tokenStore.clear().catch(() => {});
    queryClient.clear(); // Drop every cached response that belonged to this account.
    setState({ status: 'signedOut' });
  }, [queryClient]);

  useEffect(() => {
    setUnauthorizedHandler(() => void signOut());
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  // Restore the session on launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await tokenStore.get().catch(() => null);
      if (!token) {
        if (!cancelled) setState({ status: 'signedOut' });
        return;
      }
      setAuthToken(token);
      try {
        const { user } = await api<{ user: User }>('/users/me');
        if (!cancelled) setState({ status: 'signedIn', user });
      } catch (error) {
        if (error instanceof ApiError && error.status === 0) {
          // Offline: keep the session but we cannot show the user yet. Ask them to sign in again later.
          if (!cancelled) setState({ status: 'signedOut' });
          return;
        }
        await signOut();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signOut]);

  const value = useMemo<AuthValue>(
    () => ({
      state,
      user: state.status === 'signedIn' ? state.user : null,
      isAdmin: state.status === 'signedIn' && state.user.role === 'admin',
      async signIn(token, user) {
        setAuthToken(token);
        await tokenStore.set(token);
        setState({ status: 'signedIn', user });
      },
      signOut,
      setUser(user) {
        setState({ status: 'signedIn', user });
      },
    }),
    [state, signOut]
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthValue {
  const value = use(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
