import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { UserProfile } from '../../shared/contracts';
import * as api from '../api';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string, signal?: AbortSignal) => Promise<void>;
  register: (email: string, password: string, displayName: string, signal?: AbortSignal) => Promise<void>;
  logout: () => Promise<void>;
  upgradeToPremium: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    api.me(controller.signal)
      .then(setUser)
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const login = useCallback(async (email: string, password: string, signal?: AbortSignal) => {
    const result = await api.login(email, password, signal);
    setUser(result);
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string, signal?: AbortSignal) => {
    const result = await api.register(email, password, displayName, signal);
    setUser(result);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const upgradeToPremium = useCallback(async () => {
    setUser(await api.upgradeToPremium());
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    login,
    register,
    logout,
    upgradeToPremium,
  }), [user, loading, login, register, logout, upgradeToPremium]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
