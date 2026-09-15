import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { MyCommitteeLeave } from './types';

export async function updateMyProfile(payload: {
  fullName: string;
  memberUid: string;
  contactNo: string;
  avatarUrl: string;
}) {
  const { error } = await supabase.rpc('update_my_profile', {
    p_full_name: payload.fullName,
    p_member_uid: payload.memberUid || null,
    p_contact_no: payload.contactNo || null,
    p_avatar_url: payload.avatarUrl || null,
  });
  if (error) throw error;
}

export async function changeMyPassword(currentPassword: string, newPassword: string) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user?.email) throw new Error('Unable to resolve the current account.');

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: userData.user.email,
    password: currentPassword,
  });
  if (reauthError) throw new Error('Current password is incorrect.');

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) throw updateError;
}

export async function signOutOtherSessions() {
  const { error } = await supabase.auth.signOut({ scope: 'others' });
  if (error) throw error;
}

export function useMyCommitteeLeave() {
  const [leave, setLeave] = useState<MyCommitteeLeave | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_my_committee_leave');
    if (error) {
      setLeave({ isCommitteeMember: false });
      setLoading(false);
      return;
    }
    setLeave(data as MyCommitteeLeave);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { leave, loading, reload };
}

export async function updateMyCommitteeLeave(leaveFrom: string, leaveTo: string) {
  const { error } = await supabase.rpc('update_my_committee_leave', {
    p_leave_from: leaveFrom,
    p_leave_to: leaveTo,
  });
  if (error) throw error;
}

export async function clearMyCommitteeLeave() {
  const { error } = await supabase.rpc('clear_my_committee_leave');
  if (error) throw error;
}

export function useCalendarFeedToken() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setToken(null);
      setLoading(false);
      return;
    }
    const { data: existing } = await supabase.from('calendar_feed_tokens').select('token').eq('user_id', userId).maybeSingle();
    if (existing) {
      setToken(existing.token);
      setLoading(false);
      return;
    }
    const { data: created } = await supabase
      .from('calendar_feed_tokens')
      .insert({ user_id: userId })
      .select('token')
      .single();
    setToken(created?.token ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { token, loading, reload };
}

export async function regenerateCalendarFeedToken() {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in.');
  const { error } = await supabase.from('calendar_feed_tokens').update({ token: crypto.randomUUID() }).eq('user_id', userId);
  if (error) throw error;
}
