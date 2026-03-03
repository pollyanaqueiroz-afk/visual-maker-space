import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- DEV BYPASS START ---
const DEV_BYPASS_KEY = 'dev_bypass';
const isDevEnvironment = () => {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h.includes('lovable.app');
};
const FAKE_USER = {
  id: 'dev-bypass-user',
  email: 'dev@curseduca.com',
  app_metadata: {},
  user_metadata: { display_name: 'Dev User' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as unknown as User;
// --- DEV BYPASS END ---

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // --- DEV BYPASS START ---
  const [devBypass, setDevBypass] = useState(() =>
    isDevEnvironment() && sessionStorage.getItem(DEV_BYPASS_KEY) === 'true'
  );
  // --- DEV BYPASS END ---

  useEffect(() => {
    // --- DEV BYPASS START ---
    if (devBypass) {
      setLoading(false);
      return;
    }
    // --- DEV BYPASS END ---

    const handleSession = async (session: Session | null) => {
      if (session?.user?.email && !session.user.email.endsWith('@curseduca.com')) {
        await supabase.auth.signOut();
        return;
      }
      setSession(session);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    return () => subscription.unsubscribe();
  }, [devBypass]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    // --- DEV BYPASS START ---
    if (devBypass) {
      sessionStorage.removeItem(DEV_BYPASS_KEY);
      setDevBypass(false);
      return;
    }
    // --- DEV BYPASS END ---
    await supabase.auth.signOut();
  };

  // --- DEV BYPASS START ---
  const user = devBypass ? FAKE_USER : session?.user ?? null;
  // --- DEV BYPASS END ---

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
