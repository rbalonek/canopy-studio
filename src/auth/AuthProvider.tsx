import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Provider, Session, User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

/** OAuth providers we expose in the UI. Must be enabled in the Supabase dashboard before they work. */
export type OAuthProvider = Extract<Provider, 'google' | 'azure' | 'apple'>;

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

type AuthContextValue = AuthState & {
  signIn(email: string, password: string): Promise<{ error: Error | null }>;
  signUp(
    email: string,
    password: string,
  ): Promise<{ error: Error | null; needsConfirmation: boolean }>;
  signInWithOAuth(provider: OAuthProvider): Promise<{ error: Error | null }>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<{ error: Error | null }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, user: null, loading: true });

  useEffect(() => {
    if (!supabase) {
      setState({ session: null, user: null, loading: false });
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setState({ session: data.session, user: data.session?.user ?? null, loading: false });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, user: session?.user ?? null, loading: false });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthContextValue = {
    ...state,
    async signIn(email, password) {
      if (!supabase) return { error: new Error('Supabase not configured') };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    },
    async signUp(email, password) {
      if (!supabase) {
        return { error: new Error('Supabase not configured'), needsConfirmation: false };
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      // With email confirmation on, session is null until the user clicks
      // the link in their inbox.
      const needsConfirmation = !error && !data.session;
      return { error, needsConfirmation };
    },
    async signInWithOAuth(provider) {
      if (!supabase) return { error: new Error('Supabase not configured') };
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/` },
      });
      // On success the browser navigates to the provider — code below
      // only runs when the redirect itself failed.
      return { error };
    },
    async signOut() {
      if (!supabase) return;
      await supabase.auth.signOut();
    },
    async resetPassword(email) {
      if (!supabase) return { error: new Error('Supabase not configured') };
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
      });
      return { error };
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
