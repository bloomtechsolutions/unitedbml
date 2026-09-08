"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/AuthContext';

interface NavItem {
  to: string;
  icon: string;
  label: string;
  adminOnly?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  { label: 'Overview', items: [{ to: '/dashboard', icon: '⌂', label: 'Dashboard' }] },
  {
    label: 'Operations',
    items: [
      { to: '/events', icon: '◉', label: 'Events & Activities' },
      { to: '/tournaments', icon: '🏆', label: 'Tournaments' },
      { to: '/finance', icon: '◫', label: 'Finance' },
      { to: '/reimbursements', icon: '↺', label: 'Reimbursements' },
      { to: '/meetings', icon: '▦', label: 'Meetings' },
      { to: '/committee', icon: '♟', label: 'Committee' },
    ],
  },
  {
    label: 'Engagement',
    items: [
      { to: '/leaderboard', icon: '◈', label: 'Leaderboard' },
      { to: '/communication', icon: '✉', label: 'Communication' },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/documents', icon: '▤', label: 'Documents' },
      { to: '/reports', icon: '▥', label: 'Reports' },
      { to: '/staff-master', icon: '▦', label: 'Staff Master', adminOnly: true },
      { to: '/staff-audience', icon: '⌖', label: 'Location Classification', adminOnly: true },
      { to: '/settings', icon: '⚙', label: 'Settings' },
    ],
  },
];

export function Layout({ children }: { children: ReactNode }) {
  const { profile, isAdministrator, signOut } = useAuth();
  const pathname = usePathname();

  return (
    <div className="app">
      <div className="sidebar">
        <div className="brand">
          <div className="logo">
            <img src="/assets/unitedbml-logo.png" alt="UnitedBML" />
          </div>
          <div>
            <h1>UnitedBML</h1>
            <small>Management Hub</small>
          </div>
        </div>
        <div className="nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items
                .filter((item) => !item.adminOnly || isAdministrator)
                .map((item) => (
                  <Link key={item.to} href={item.to} className={pathname === item.to ? 'active' : ''}>
                    <span>{item.icon}</span>
                    <span className="txt">{item.label}</span>
                  </Link>
                ))}
            </div>
          ))}
        </div>
        <div className="sidebar-utility">
          <div className="sidebar-user">
            <div className="user-avatar2">{(profile?.full_name || 'U').charAt(0)}</div>
            <div className="sidebar-user-meta">
              <b>{profile?.full_name || 'Signing in…'}</b>
              <small>{profile?.role || 'UnitedBML User'}</small>
            </div>
            <button className="sidebar-bell" title="Sign out" onClick={() => void signOut()}>
              ⎋
            </button>
          </div>
        </div>
      </div>
      <div className="content">
        <div className="topbar">
          <div className="search">
            <span>🔍</span>
            <input placeholder="Search…" disabled />
          </div>
          <div className="top-actions" />
        </div>
        <div className="main">{children}</div>
      </div>
    </div>
  );
}