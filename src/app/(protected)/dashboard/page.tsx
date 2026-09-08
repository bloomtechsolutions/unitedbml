'use client';

import { useAuth } from '../../../lib/AuthContext';

export default function DashboardPage() {
  const { profile } = useAuth();
  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}</h2>
          <p style={{ color: 'var(--muted)' }}>UnitedBML Management Hub</p>
        </div>
      </div>
    </div>
  );
}
