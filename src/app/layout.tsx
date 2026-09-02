import type { Metadata } from 'next';
import './globals.css';
import QueryProvider from '@/providers/query-provider';
import AppShell from '@/components/app-shell';

export const metadata: Metadata = {
  title: 'Demo Auto Shop',
  description: 'Auto repair shop CRM frontend',
};

// SECURITY: Force every page to render per-request so the auth middleware always
// runs. Without this, Next.js statically prerenders pages and Railway's CDN serves
// cached HTML, bypassing the PIN gate entirely.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <AppShell>{children}</AppShell>
        </QueryProvider>
      </body>
    </html>
  );
}
