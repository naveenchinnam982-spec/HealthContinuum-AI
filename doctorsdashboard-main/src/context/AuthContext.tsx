import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { DoctorProfile } from '@/types';
import { authService, SERVICE_MODE } from '@/services/api';

interface AuthContextValue {
  doctor: DoctorProfile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error: string | null }>;
  signOut: () => Promise<void>;
  isDemoMode: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const STORAGE_KEY = 'hca_doctor_session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    // Never trust a cached profile by itself: revalidate its bearer token with FastAPI.
    void (async () => {
      try {
        const verifiedDoctor = await authService.checkSession();
        if (!active) return;
        if (verifiedDoctor) {
          setDoctor(verifiedDoctor);
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(verifiedDoctor));
        } else {
          await authService.signOut();
          sessionStorage.removeItem(STORAGE_KEY);
          setDoctor(null);
        }
      } catch {
        if (!active) return;
        setDoctor(null);
        sessionStorage.removeItem(STORAGE_KEY);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { doctor: doc, error: err } = await authService.signIn(email, password);
      if (doc) {
        setDoctor(doc);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
        setLoading(false);
        return { success: true, error: null };
      }
      setError(err || 'Sign-in failed.');
      setLoading(false);
      return { success: false, error: err };
    } catch {
      const message = 'Unable to sign in right now. Please check your connection and try again.';
      setError(message);
      setLoading(false);
      return { success: false, error: message };
    }
  };

  const signOut = async () => {
    await authService.signOut();
    setDoctor(null);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ doctor, loading, error, signIn, signOut, isDemoMode: SERVICE_MODE === 'demo' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
