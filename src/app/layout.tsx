import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Baloo_2, Figtree } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const fontDisplay = Baloo_2({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-display' });
const fontBody = Figtree({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'UnitedBML - Management Hub',
  icons: { icon: '/assets/unitedbml-logo.png' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fontDisplay.variable} ${fontBody.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
