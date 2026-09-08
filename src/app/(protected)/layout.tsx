'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/AuthContext';
import { Layout } from '../../components/Layout';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) router.replace('/login');
  }, [loading, session, router]);

  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;
  if (!session) return null;

  return <Layout>{children}</Layout>;
}
