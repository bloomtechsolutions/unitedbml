import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const fontBody = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'UnitedBML - Management Hub',
  icons: { icon: '/assets/unitedbml-logo.png' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontBody.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
