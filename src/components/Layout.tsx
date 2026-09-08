'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/AuthContext';

interface SubItem {
  to: string;
  label: string;
  adminOnly?: boolean;
}

interface NavArea {
  label: string;
  to: string;
  icon: ReactNode;
  subItems?: SubItem[];
}

const ICONS = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="2" /><rect x="14" y="3" width="7" height="5" rx="2" />
      <rect x="14" y="12" width="7" height="9" rx="2" /><rect x="3" y="16" width="7" height="5" rx="2" />
    </svg>
  ),
  events: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="3" /><path d="M8 2v4M16 2v4M3 10h18" />
    </svg>
  ),
  finance: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" />
    </svg>
  ),
  people: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <circle cx="18" cy="8" r="2.6" /><path d="M15.7 14.3c2.9.4 4.8 2.4 4.8 5.7" />
    </svg>
  ),
  governance: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" /><path d="M9 13h6M9 17h6M9 9h2" />
    </svg>
  ),
  myspace: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4.5" /><path d="M4.5 21c0-4.1 3.4-6.8 7.5-6.8s7.5 2.7 7.5 6.8" />
    </svg>
  ),
  reports: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19V10M12 19V4M20 19v-7" />
    </svg>
  ),
};

const NAV_AREAS: NavArea[] = [
  { label: 'Dashboard', to: '/dashboard', icon: ICONS.dashboard },
  {
    label: 'Events',
    to: '/events',
    icon: ICONS.events,
    subItems: [
      { to: '/events', label: 'Events & Activities' },
      { to: '/tournaments', label: 'Tournaments' },
    ],
  },
  {
    label: 'Finance',
    to: '/finance',
    icon: ICONS.finance,
    subItems: [
      { to: '/finance', label: 'Requests & Budget' },
      { to: '/reimbursements', label: 'Reimbursements' },
    ],
  },
  {
    label: 'People',
    to: '/committee',
    icon: ICONS.people,
    subItems: [
      { to: '/committee', label: 'Committee' },
      { to: '/staff-master', label: 'Staff Master', adminOnly: true },
      { to: '/staff-audience', label: 'Location Classification', adminOnly: true },
    ],
  },
  {
    label: 'Governance',
    to: '/meetings',
    icon: ICONS.governance,
    subItems: [
      { to: '/meetings', label: 'Meetings' },
      { to: '/documents', label: 'Documents' },
    ],
  },
  {
    label: 'My Space',
    to: '/portal',
    icon: ICONS.myspace,
    subItems: [
      { to: '/portal', label: 'My Hub' },
      { to: '/leaderboard', label: 'Leaderboard' },
      { to: '/settings', label: 'Settings' },
    ],
  },
  { label: 'Reports', to: '/reports', icon: ICONS.reports },
];

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'U';
}

export function Layout({ children }: { children: ReactNode }) {
  const { profile, isAdministrator, signOut } = useAuth();
  const pathname = usePathname();

  const isAreaActive = (area: NavArea) =>
    pathname === area.to || (area.subItems ?? []).some((s) => pathname === s.to);

  return (
    <div className="ub-shell">
      <div className="ub-sidebar">
        <div className="ub-brand">
          <img src="/assets/unitedbml-logo.png" alt="" />
          <span>UnitedBML</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_AREAS.map((area) => {
            const active = isAreaActive(area);
            const visibleSubItems = (area.subItems ?? []).filter((s) => !s.adminOnly || isAdministrator);
            return (
              <div key={area.label}>
                <Link href={area.to} className={`ub-navitem ${active ? 'active' : ''}`}>
                  {area.icon}
                  {area.label}
                </Link>
                {active && visibleSubItems.length > 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, margin: '2px 0 6px 30px' }}>
                    {visibleSubItems.map((sub) => (
                      <Link
                        key={sub.to}
                        href={sub.to}
                        style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          padding: '7px 12px',
                          borderRadius: 10,
                          color: pathname === sub.to ? '#fff' : 'oklch(85% 0.02 60 / 0.55)',
                          background: pathname === sub.to ? 'oklch(100% 0 0 / 0.08)' : 'transparent',
                        }}
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="ub-sidebar-spacer" />

        <div className="ub-sidebar-user">
          <div className="ub-avatar" style={{ width: 38, height: 38, fontSize: 13 }}>
            {initials(profile?.full_name || 'U')}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: 'var(--ub-cream)', fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.full_name || 'Signing in…'}
            </div>
            <div style={{ color: 'oklch(85% 0.02 60 / 0.55)', fontSize: 11.5 }}>{profile?.role || 'UnitedBML User'}</div>
          </div>
          <button title="Sign out" onClick={() => void signOut()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
            </svg>
          </button>
        </div>
      </div>

      <div className="ub-main">{children}</div>
    </div>
  );
}
