'use client';

import { useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { markAllNotificationsRead, markNotificationRead, useNotifications } from './useNotifications';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell() {
  const { session } = useAuth();
  const { notifications, unreadCount, reload } = useNotifications(session?.user.id);
  const [open, setOpen] = useState(false);

  const handleOpen = () => setOpen((v) => !v);

  const handleMarkAll = async () => {
    if (!session?.user.id) return;
    await markAllNotificationsRead(session.user.id);
    await reload();
  };

  return (
    <div style={{ position: 'relative' }}>
      <div className="ub-icon-btn" onClick={handleOpen} role="button" tabIndex={0}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
          <path d="M9.5 20a2.5 2.5 0 0 0 5 0" />
        </svg>
        {unreadCount > 0 && (
          <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: 'var(--ub-danger)', border: '1.5px solid var(--ub-bg)' }} />
        )}
      </div>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 30 }} onClick={() => setOpen(false)} />
          <div
            className="ub-card"
            style={{ position: 'absolute', right: 0, top: 44, width: 340, maxHeight: 420, overflowY: 'auto', zIndex: 31, padding: 0 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--ub-border)' }}>
              <b style={{ fontSize: 14 }}>Notifications</b>
              {unreadCount > 0 && (
                <button
                  onClick={() => void handleMarkAll()}
                  style={{ border: 0, background: 'none', color: 'var(--ub-accent-dark)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
                >
                  Mark all read
                </button>
              )}
            </div>
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => void markNotificationRead(n.id).then(reload)}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--ub-border-2)',
                  cursor: 'pointer',
                  background: n.is_read ? 'transparent' : 'var(--ub-accent-soft)',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700 }}>{n.title}</div>
                {n.message && <div style={{ fontSize: 12.5, color: 'var(--ub-ink-soft)', marginTop: 3 }}>{n.message}</div>}
                <div style={{ fontSize: 11, color: 'var(--ub-ink-faint)', marginTop: 4 }}>{timeAgo(n.created_at)}</div>
              </div>
            ))}
            {!notifications.length && <div className="ub-empty" style={{ border: 'none', margin: 8 }}>No notifications yet.</div>}
          </div>
        </>
      )}
    </div>
  );
}
