'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
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
  const [unreadCount, setUnreadCount] = useState(0);
  const [voicemailUnreadCount, setVoicemailUnreadCount] = useState(0);
  const [waitingApprovalCount, setWaitingApprovalCount] = useState(0);
  const pathname = usePathname();
  const router = useRouter();

  // Poll unread SMS count every 15s
  useEffect(() => {
    let cancelled = false;
    const fetchUnread = async () => {
      try {
        const res = await fetch('/api/sms/unread-count', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setUnreadCount(json?.count ?? 0);
      } catch {
        // silently ignore polling errors
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Poll voicemail unread count every 30s
  useEffect(() => {
    let cancelled = false;
    const fetchVoicemailUnread = async () => {
      try {
        const res = await fetch('/api/voicemails', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        const data = json?.data || [];
        const count = data.filter((v: any) => v.status === 'new' || v.status === 'transcribed').length;
        if (!cancelled) setVoicemailUnreadCount(count);
      } catch {
        // silently ignore
      }
    };
    fetchVoicemailUnread();
    const interval = setInterval(fetchVoicemailUnread, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Poll waiting approval repair order count every 15s
  useEffect(() => {
    let cancelled = false;
    const fetchWaiting = async () => {
      try {
        const res = await fetch('/api/crm/repair-orders/waiting-approval-count', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setWaitingApprovalCount(json?.count ?? 0);
      } catch {
        // silently ignore polling errors
      }
    };
    fetchWaiting();
    const interval = setInterval(fetchWaiting, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

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

  const isDev = process.env.NODE_ENV !== 'production';

  const items: NavItem[] = useMemo(
    () => [
      { label: 'Command Center', href: '/' },
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Estimate', href: '/estimate' },
      { label: 'Repair orders', href: '/repair-orders' },
      { label: 'New repair', href: '/repair-orders/new' },
      { label: 'Communications', href: '/communications' },
      { label: 'Settings', href: '/settings' },
      ...(isDev ? [{ label: 'Assistant', href: '/assistant' }] : []),
    ],
    [isDev]
  );

  // Public pages (customer-facing) bypass the app shell entirely.
  // Match /approve exactly or /approve/* but NOT /approved/* (internal staff page).
  const isPublicPage = pathname === '/approve' || pathname?.startsWith('/approve/');
  if (isPublicPage) {
    return <>{children}</>;
  }

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
              <span
                className={
                  'font-bold tracking-tight ' +
                  (collapsed && !isCompact ? 'text-sm' : 'text-base')
                }
                style={{ color: '#d7b73f' }}
              >
                {collapsed && !isCompact ? 'DAS' : 'Demo Auto Shop'}
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
              const isCommunications = item.href === '/communications';
              const isRepairOrders = item.href === '/repair-orders';
              const commsBadgeCount = unreadCount + voicemailUnreadCount;
              const showBadge =
                (isCommunications && commsBadgeCount > 0) ||
                (isRepairOrders && waitingApprovalCount > 0);
              const badgeCount = isCommunications ? commsBadgeCount : isRepairOrders ? waitingApprovalCount : 0;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={
                    'flex items-center justify-between rounded-full px-3 py-2 text-sm font-medium transition ' +
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
                  {showBadge && showFull ? (
                    <span
                      className={
                        'ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-medium ring-1 ring-inset ' +
                        (isRepairOrders
                          ? 'bg-violet-500/15 text-violet-200 ring-violet-400/25'
                          : voicemailUnreadCount > 0 && isCommunications
                          ? 'bg-red-500/20 text-red-300 ring-red-500/30'
                          : 'bg-[#d7b73f]/15 text-[#d7b73f] ring-[#d7b73f]/25')
                      }
                      aria-label={`${badgeCount} ${isCommunications ? 'unread messages' : 'waiting approval'}`}
                    >
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  ) : null}
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
