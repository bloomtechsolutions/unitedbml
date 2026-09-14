'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../lib/AuthContext';
import { Layout } from '../../components/Layout';

const STAFF_ALLOWED_PREFIXES = ['/dashboard', '/portal', '/settings'];

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const { session, loading, isCommitteeUser, committeeChecked } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !session) router.replace('/login');
  }, [loading, session, router]);

  useEffect(() => {
    if (!committeeChecked || isCommitteeUser) return;
    if (!STAFF_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p))) {
      router.replace('/dashboard');
    }
  }, [committeeChecked, isCommitteeUser, pathname, router]);

  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;
  if (!session) return null;

  return <Layout>{children}</Layout>;
}
