'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { User } from '@/types/api';
import {
  apiClient,
  clearTokens,
  getStoredUser,
  setTokens,
} from '@/lib/api-client';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  loginWithPasskey: () => Promise<void>;
  register: (
    email: string,
    username: string,
    password: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Initialise user from localStorage synchronously so the value is
  // available on the very first render
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // On mount: if we have a token, validate it once with /auth/me.
  // This is the ONLY place that can clear stale tokens.
  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('gompp_access_token');

    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    apiClient<{ data: User }>('/auth/me')
      .then((res) => {
        if (!cancelled) {
          setUser(res.data);
          localStorage.setItem('gompp_user', JSON.stringify(res.data));
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearTokens();
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiClient<{
        data: {
          access_token: string;
          refresh_token: string;
          user: User;
        };
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      // Write tokens FIRST, then update React state
      setTokens(res.data.access_token, res.data.refresh_token);
      localStorage.setItem('gompp_user', JSON.stringify(res.data.user));
      setUser(res.data.user);
      setIsLoading(false);
      router.push('/analytics');
    },
    [router],
  );

  const loginWithGoogle = useCallback(
    async (credential: string) => {
      const res = await apiClient<{
        data: {
          access_token: string;
          refresh_token: string;
          user: User;
        };
      }>('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential }),
      });

      setTokens(res.data.access_token, res.data.refresh_token);
      localStorage.setItem('gompp_user', JSON.stringify(res.data.user));
      setUser(res.data.user);
      setIsLoading(false);
      router.push('/analytics');
    },
    [router],
  );

  const loginWithPasskey = useCallback(async () => {
    // Step 1: Begin discoverable login
    const beginRes = await apiClient<{
      data: {
        options: { publicKey: PublicKeyCredentialRequestOptionsJSON };
        session: string;
      };
    }>('/auth/passkey/begin', { method: 'POST' });

    // Browser authenticator
    const { startAuthentication } = await import('@simplewebauthn/browser');
    const credential = await startAuthentication({
      optionsJSON: beginRes.data.options.publicKey,
    });

    // Finish login
    const res = await apiClient<{
      data: {
        access_token: string;
        refresh_token: string;
        user: User;
      };
    }>('/auth/passkey/finish', {
      method: 'POST',
      body: JSON.stringify({
        session: beginRes.data.session,
        credential,
      }),
    });

    setTokens(res.data.access_token, res.data.refresh_token);
    localStorage.setItem('gompp_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    setIsLoading(false);
    router.push('/analytics');
  }, [router]);

  const register = useCallback(
    async (email: string, username: string, password: string) => {
      await apiClient('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, username, password }),
      });
      await login(email, password);
    },
    [login],
  );

  const logout = useCallback(async () => {
    try {
      await apiClient('/auth/logout', { method: 'POST' });
    } catch {}
    clearTokens();
    setUser(null);
    router.push('/signin');
  }, [router]);

  const refreshUser = useCallback(async () => {
    try {
      const res = await apiClient<{ data: User }>('/auth/me');
      setUser(res.data);
      localStorage.setItem('gompp_user', JSON.stringify(res.data));
    } catch {}
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      loginWithGoogle,
      loginWithPasskey,
      register,
      logout,
      refreshUser,
    }),
    [
      user,
      isLoading,
      login,
      loginWithGoogle,
      loginWithPasskey,
      register,
      logout,
      refreshUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
