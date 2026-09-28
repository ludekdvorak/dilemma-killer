import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import type { UserProfile } from '../../shared/contracts';
import * as api from '../api';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string, signal?: AbortSignal) => Promise<void>;
  loginWithGoogle: (credential: string, signal?: AbortSignal) => Promise<void>;
  register: (email: string, password: string, displayName: string, signal?: AbortSignal) => Promise<void>;
  logout: () => Promise<void>;
  upgradeToPremium: () => Promise<void>;
  updateProfile: (email: string, displayName: string, currentPassword?: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const initialRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    initialRequest.current = controller;
    api.me(controller.signal)
      .then((result) => { if (!controller.signal.aborted) setUser(result); })
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const finishAuthentication = useCallback((result: UserProfile) => {
    // A slow startup check must never overwrite a more recent sign-in.
    initialRequest.current?.abort();
    setLoading(false);
    setUser(result);
  }, []);

  const login = useCallback(async (email: string, password: string, signal?: AbortSignal) => {
    const result = await api.login(email, password, signal);
    finishAuthentication(result);
  }, [finishAuthentication]);

  const loginWithGoogle = useCallback(async (credential: string, signal?: AbortSignal) => {
    finishAuthentication(await api.loginWithGoogle(credential, signal));
  }, [finishAuthentication]);

  const register = useCallback(async (email: string, password: string, displayName: string, signal?: AbortSignal) => {
    const result = await api.register(email, password, displayName, signal);
    finishAuthentication(result);
  }, [finishAuthentication]);

  const logout = useCallback(async () => {
    initialRequest.current?.abort();
    setLoading(false);
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const upgradeToPremium = useCallback(async () => {
    setUser(await api.upgradeToPremium());
  }, []);

  const updateProfile = useCallback(async (
    email: string,
    displayName: string,
    currentPassword?: string,
  ) => {
    setUser(await api.updateProfile(email, displayName, currentPassword));
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await api.changePassword(currentPassword, newPassword);
  }, []);

  const refreshUser = useCallback(async () => {
    setUser(await api.me());
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    login,
    loginWithGoogle,
    register,
    logout,
    upgradeToPremium,
    updateProfile,
    changePassword,
    refreshUser,
  }), [
    user,
    loading,
    login,
    loginWithGoogle,
    register,
    logout,
    upgradeToPremium,
    updateProfile,
    changePassword,
    refreshUser,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
