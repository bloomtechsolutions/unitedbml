'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import {
  changeMyPassword,
  clearMyCommitteeLeave,
  signOutOtherSessions,
  updateMyCommitteeLeave,
  updateMyProfile,
  useMyCommitteeLeave,
} from './useSettings';

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

function passwordStrength(pw: string): number {
  let score = 0;
  if (pw.length >= 8) score += 20;
  if (pw.length >= 12) score += 20;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 20;
  if (/\d/.test(pw)) score += 20;
  if (/[^a-zA-Z0-9]/.test(pw)) score += 20;
  return score;
}

export function SettingsPage() {
  const { profile, session, signOut, refreshProfile } = useAuth();
  const { leave, loading: leaveLoading, reload: reloadLeave } = useMyCommitteeLeave();
  const toast = useToast();

  const [fullName, setFullName] = useState('');
  const [memberUid, setMemberUid] = useState('');
  const [contactNo, setContactNo] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? '');
    setMemberUid(profile.member_uid ?? '');
    setContactNo(profile.contact_no ?? '');
    setAvatarUrl(profile.avatar_url ?? '');
  }, [profile]);

  const [leaveFrom, setLeaveFrom] = useState('');
  const [leaveTo, setLeaveTo] = useState('');
  const [savingLeave, setSavingLeave] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  useEffect(() => {
    if (leave?.isCommitteeMember) {
      setLeaveFrom(leave.leaveFrom ?? '');
      setLeaveTo(leave.leaveTo ?? '');
    }
  }, [leave]);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      setProfileError('Display name is required.');
      return;
    }
    setSavingProfile(true);
    setProfileError(null);
    try {
      await updateMyProfile({ fullName: fullName.trim(), memberUid, contactNo, avatarUrl });
      await refreshProfile();
      toast('Profile updated');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveLeave = async () => {
    if (!leaveFrom || !leaveTo) {
      setLeaveError('Leave From and Leave To dates are required.');
      return;
    }
    if (leaveTo < leaveFrom) {
      setLeaveError('Leave To date cannot be before Leave From date.');
      return;
    }
    setSavingLeave(true);
    setLeaveError(null);
    try {
      await updateMyCommitteeLeave(leaveFrom, leaveTo);
      await reloadLeave();
      toast('Committee leave updated');
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : 'Failed to update leave.');
    } finally {
      setSavingLeave(false);
    }
  };

  const handleClearLeave = async () => {
    if (!confirm('Clear your committee leave and mark yourself Available?')) return;
    setSavingLeave(true);
    try {
      await clearMyCommitteeLeave();
      await reloadLeave();
      toast('Leave cleared — you are marked Available');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to clear leave.');
    } finally {
      setSavingLeave(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from the current password.');
      return;
    }
    setSavingPassword(true);
    setPasswordError(null);
    try {
      await changeMyPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast('Password updated');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSignOutOthers = async () => {
    try {
      await signOutOtherSessions();
      toast('Other sessions signed out');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to sign out other sessions.');
    }
  };

  const strength = passwordStrength(newPassword);

  return (
    <div>
      <div className="settings-hero">
        <div>
          <h2>Settings</h2>
          <p>Manage your profile, password, and account security.</p>
        </div>
      </div>

      <div className="settings-layout">
        <div className="settings-profile">
          <div className="settings-photo">
            {avatarUrl ? <img src={avatarUrl} alt={fullName} /> : initials(fullName || profile?.full_name || 'U')}
          </div>
          <h3>{profile?.full_name}</h3>
          <div className="role">{profile?.role}</div>
          <div className="settings-profile-lines">
            <div className="settings-profile-line">
              <span>Email</span>
              <strong>{profile?.email}</strong>
            </div>
            <div className="settings-profile-line">
              <span>Member ID</span>
              <strong>{profile?.member_uid || '—'}</strong>
            </div>
            <div className="settings-profile-line">
              <span>Account Status</span>
              <strong>{profile?.status}</strong>
            </div>
            <div className="settings-profile-line">
              <span>Last Sign In</span>
              <strong>{session?.user.last_sign_in_at ? new Date(session.user.last_sign_in_at).toLocaleString() : '—'}</strong>
            </div>
          </div>
        </div>

        <div className="settings-main">
          <div className="settings-section">
            <div className="settings-section-head">
              <div>
                <h3>Personal Profile</h3>
                <p>Email, role, and account status are protected and can only be changed by an Administrator.</p>
              </div>
            </div>
            <div className="settings-form">
              <div>
                <label>Display Name</label>
                <input maxLength={120} value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <label>Member / Staff ID</label>
                <input maxLength={50} value={memberUid} onChange={(e) => setMemberUid(e.target.value)} />
              </div>
              <div>
                <label>Contact Number</label>
                <input maxLength={50} value={contactNo} onChange={(e) => setContactNo(e.target.value)} />
              </div>
              <div>
                <label>Email</label>
                <input value={profile?.email ?? ''} readOnly />
              </div>
              <div className="full">
                <label>Profile Photo URL</label>
                <input type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" />
              </div>
            </div>
            {profileError && <div className="settings-message bad">{profileError}</div>}
            <div className="settings-actions">
              <button className="btn primary" onClick={() => void handleSaveProfile()} disabled={savingProfile}>
                {savingProfile ? 'Saving…' : 'Save Profile'}
              </button>
            </div>
          </div>

          {!leaveLoading && leave?.isCommitteeMember && (
            <div className="settings-section" id="settingsCommitteeLeaveSection">
              <div className="settings-section-head">
                <div>
                  <h3>My Committee Leave</h3>
                  <p>
                    {leave.position} {leave.group ? `· ${leave.group}` : ''} — currently{' '}
                    <span className={`pill ${leave.availability === 'On Leave' ? 'cancel' : 'open'}`}>{leave.availability}</span>
                  </p>
                </div>
              </div>
              <div className="settings-form">
                <div>
                  <label>Leave From</label>
                  <input type="date" value={leaveFrom} onChange={(e) => setLeaveFrom(e.target.value)} />
                </div>
                <div>
                  <label>Leave To</label>
                  <input type="date" value={leaveTo} onChange={(e) => setLeaveTo(e.target.value)} />
                </div>
              </div>
              {leaveError && <div className="settings-message bad">{leaveError}</div>}
              <div className="settings-note">
                Setting your leave marks you On Leave to the Committee and Finance approval routing until cleared.
              </div>
              <div className="settings-actions">
                <button className="btn ghost" onClick={() => void handleClearLeave()} disabled={savingLeave}>
                  Clear Leave
                </button>
                <button className="btn primary" onClick={() => void handleSaveLeave()} disabled={savingLeave}>
                  {savingLeave ? 'Saving…' : 'Save Leave'}
                </button>
              </div>
            </div>
          )}

          <div className="settings-section">
            <div className="settings-section-head">
              <div>
                <h3>Change Password</h3>
                <p>Minimum 8 characters. You'll stay signed in on this device.</p>
              </div>
            </div>
            <div className="settings-form">
              <div className="full">
                <label>Current Password</label>
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              </div>
              <div>
                <label>New Password</label>
                <input type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div>
                <label>Confirm New Password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
              {newPassword && (
                <div className="full">
                  <div className="committee-term-overview-track">
                    <span style={{ width: `${strength}%`, background: strength >= 80 ? '#1fad73' : strength >= 40 ? '#f5a524' : '#ef476f' }} />
                  </div>
                </div>
              )}
            </div>
            {passwordError && <div className="settings-message bad">{passwordError}</div>}
            <div className="settings-actions">
              <button className="btn primary" onClick={() => void handleChangePassword()} disabled={savingPassword}>
                {savingPassword ? 'Updating…' : 'Change Password'}
              </button>
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-section-head">
              <div>
                <h3>Account &amp; Security</h3>
              </div>
            </div>
            <div className="settings-security-row">
              <div>
                <strong>Authentication Email</strong>
                <small>{profile?.email}</small>
              </div>
              <span className="pill open">Protected</span>
            </div>
            <div className="settings-security-row">
              <div>
                <strong>UnitedBML Role</strong>
                <small>{profile?.role}</small>
              </div>
              <span className="pill open">Verified account</span>
            </div>
            <div className="settings-security-row">
              <div>
                <strong>Other Sessions</strong>
                <small>Sign out this account everywhere except this device.</small>
              </div>
              <button className="btn ghost" onClick={() => void handleSignOutOthers()}>
                Sign Out Other Sessions
              </button>
            </div>
            <div className="settings-security-row">
              <div>
                <strong>Current Session</strong>
                <small>Sign out of UnitedBML on this device.</small>
              </div>
              <button className="btn danger" onClick={() => void signOut()}>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
