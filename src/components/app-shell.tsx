'use client';

import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import logo from '/public/logo.png';
import GlobalSearch from '@/components/global-search';

type NavItem = {
  label: string;
  href: string;
};

// Treat anything <= 1024px (iPad portrait, phones) as "compact" — sidebar
// becomes an overlay drawer instead of pushing content.
const COMPACT_BREAKPOINT = 1024;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);
  const [isCompact, setIsCompact] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Detect viewport size and default collapsed on small/tablet screens.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(max-width: ${COMPACT_BREAKPOINT}px)`);
    const apply = () => {
      setIsCompact(mq.matches);
      if (mq.matches) setCollapsed(true);
      else setCollapsed(false);
    };
    apply();
    // Cross-browser: iOS 12 Safari uses addListener, not addEventListener.
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    } else {
      mq.addListener(apply);
      return () => mq.removeListener(apply);
    }
  }, []);

  const isDashboard = pathname === '/dashboard';

  const items: NavItem[] = useMemo(
    () => [
      { label: 'Command Center', href: '/' },
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Estimate', href: '/estimate' },
      { label: 'Repair orders', href: '/repair-orders' },
      { label: 'New repair', href: '/repair-orders/new' },
      { label: 'Communications', href: '/communications' },
      { label: 'Settings', href: '/settings' },
    ],
    []
  );

  // Overlay mode: when compact + expanded, sidebar floats over content.
  const overlayOpen = isCompact && !collapsed;

  const sidebarWidth = collapsed ? 72 : 280;

  return (
    <div className="min-h-screen bg-black text-slate-100">
      <div className="relative flex min-h-screen">
        {/* Dim backdrop when drawer is open on compact screens */}
        {overlayOpen ? (
          <div
            className="fixed inset-0 z-30 bg-black/60"
            onClick={() => setCollapsed(true)}
            aria-hidden="true"
          />
        ) : null}

        <aside
          className={
            'border-r border-white/10 bg-black/95 backdrop-blur ' +
            (isCompact
              ? 'fixed inset-y-0 left-0 z-40 transition-transform duration-200 ' +
                (collapsed ? '-translate-x-full' : 'translate-x-0')
              : 'relative')
          }
          style={{ width: isCompact ? 280 : sidebarWidth }}
        >
          <div className="flex items-center justify-between gap-2 px-4 py-4">
            <a className="flex items-center" href="/">
              <span className="text-sm font-semibold tracking-wide text-[#d7b73f]">
                Demo
              </span>
            </a>
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="rounded-full border border-[#d7b73f]/30 bg-[#d7b73f]/10 px-3 py-1 text-xs font-semibold"
              style={{ color: '#d7b73f' }}
              aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
              title={collapsed ? 'Expand menu' : 'Collapse menu'}
            >
              {collapsed ? '>' : '<'}
            </button>
          </div>

          {(!collapsed || isCompact) ? (
            <div className="px-4 pb-4">
              <GlobalSearch placeholder="Search…" />
            </div>
          ) : null}

          <nav className="relative z-20 px-2 pb-4">
            {items.map((item) => {
              const active = pathname === item.href;
              const showFull = !collapsed || isCompact;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={
                    'flex items-center rounded-full px-3 py-2 text-sm font-medium transition ' +
                    (active
                      ? 'bg-[#d7b73f]/15'
                      : 'hover:bg-[#d7b73f]/10 active:bg-[#d7b73f]/15')
                  }
                  style={{ color: '#d7b73f' }}
                  title={!showFull ? item.label : undefined}
                  onClick={() => {
                    if (isCompact) setCollapsed(true);
                  }}
                >
                  <span className={showFull ? 'truncate' : 'sr-only'}>{item.label}</span>
                  {!showFull ? <span className="mx-auto">•</span> : null}
                </a>
              );
            })}
          </nav>
        </aside>

        <main className="relative z-0 min-w-0 flex-1">
          <div className={isDashboard ? 'h-dvh px-0 py-0' : 'mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8'}>
            {!isDashboard ? (
              <div className="mb-6 flex items-center justify-between gap-2">
                {isCompact ? (
                  <button
                    type="button"
                    className="rounded-full border border-[#d7b73f]/30 bg-[#d7b73f]/10 px-3 py-2 text-xs font-semibold"
                    style={{ color: '#d7b73f' }}
                    onClick={() => setCollapsed(false)}
                    aria-label="Open menu"
                    title="Open menu"
                  >
                    ☰ Menu
                  </button>
                ) : (
                  <div />
                )}
                <button
                  type="button"
                  className="rounded-full border border-[#d7b73f]/30 bg-[#d7b73f]/10 px-4 py-2 text-xs font-semibold"
                  style={{ color: '#d7b73f' }}
                  onClick={async () => {
                    try {
                      await fetch('/api/auth/logout', { method: 'POST' });
                    } finally {
                      const next = pathname || '/';
                      router.replace(`/login?next=${encodeURIComponent(next)}`);
                      router.refresh();
                    }
                  }}
                  aria-label="Lock"
                  title="Lock"
                >
                  Lock
                </button>
              </div>
            ) : null}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
