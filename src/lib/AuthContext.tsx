"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile } from '../types/database';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAdministrator: boolean;
  isCommitteeUser: boolean;
  /** True once isCommitteeUser reflects a real server answer (not just its false default) —
   * guard any committee-only redirect on this too, or you'll bounce committee users on load. */
  committeeChecked: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCommitteeUser, setIsCommitteeUser] = useState(false);
  const [committeeChecked, setCommitteeChecked] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (!data.session) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setIsCommitteeUser(false);
      setCommitteeChecked(false);
      return;
    }
    let active = true;
    setLoading(true);
    setCommitteeChecked(false);
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to load profile', error);
        }
        setProfile(data ?? null);
        setLoading(false);
      });
    supabase.rpc('is_committee_user').then(({ data, error }) => {
      if (!active) return;
      if (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to resolve committee access', error);
        setCommitteeChecked(true);
        return;
      }
      setIsCommitteeUser(Boolean(data));
      setCommitteeChecked(true);
    });
    return () => {
      active = false;
    };
  }, [session]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (!session) return;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    if (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to refresh profile', error);
      return;
    }
    setProfile(data ?? null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        isAdministrator: profile?.role === 'Administrator',
        isCommitteeUser,
        committeeChecked,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}