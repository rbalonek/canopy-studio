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
    displayName?: string,
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
    let active = true;

    // Skip the INITIAL_SESSION event — it fires with the cached session
    // before our validator below has had a chance to verify it, and would
    // otherwise race our signOut() and put the stale session back.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'INITIAL_SESSION') return;
      setState({ session, user: session?.user ?? null, loading: false });
    });

    // Validate the cached session against the server. getSession() trusts
    // localStorage; getUser() round-trips the JWT to the server. If the
    // underlying user no longer exists (e.g. local DB was reset since the
    // token was issued, or the token is from a different project) we
    // clear the stale session so the UI shows Login instead of silently
    // failing every RLS check.
    (async () => {
      const { data: sessionData } = await supabase!.auth.getSession();
      if (!active) return;
      if (!sessionData.session) {
        setState({ session: null, user: null, loading: false });
        return;
      }
      const { data: userData, error } = await supabase!.auth.getUser();
      if (!active) return;
      if (error || !userData.user) {
        await supabase!.auth.signOut();
        setState({ session: null, user: null, loading: false });
        return;
      }
      setState({ session: sessionData.session, user: userData.user, loading: false });
    })();

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextValue = {
    ...state,
    async signIn(email, password) {
      if (!supabase) return { error: new Error('Supabase not configured') };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    },
    async signUp(email, password, displayName) {
      if (!supabase) {
        return { error: new Error('Supabase not configured'), needsConfirmation: false };
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: displayName ? { display_name: displayName } : undefined,
        },
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
