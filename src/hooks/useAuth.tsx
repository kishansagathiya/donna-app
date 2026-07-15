import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  getSession,
  onAuthStateChange,
  primeAccessToken,
} from '../services/auth';

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  userId: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const currentSession = await getSession();
      if (mounted) {
        primeAccessToken(currentSession?.access_token ?? null);
        setSession(currentSession);
        setLoading(false);
      }
    }

    void init();

    const unsubscribe = onAuthStateChange(nextSession => {
      primeAccessToken(nextSession?.access_token ?? null);
      if (mounted) {
        setSession(nextSession);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      loading,
      isAuthenticated: !!session,
      userId: session?.user.id ?? null,
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
