import type { Metadata } from 'next';
import './globals.css';
import QueryProvider from '@/providers/query-provider';
import AppShell from '@/components/app-shell';

export const metadata: Metadata = {
  title: 'AutoShop Demo',
  description: 'Auto repair shop CRM frontend',
};

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
