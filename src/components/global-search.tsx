'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGlobalSearch } from '@/hooks/use-global-search';

type Props = {
  placeholder?: string;
  autoFocus?: boolean;
  limit?: number;
  className?: string;
  initialValue?: string;
};

type FlatItem =
  | { kind: 'customer'; id: string; href: string }
  | { kind: 'vehicle'; id: string; href: string }
  | { kind: 'repairOrder'; id: string; href: string };

export default function GlobalSearch({
  placeholder = 'Search customers, vehicles, repair orders…',
  autoFocus,
  limit = 5,
  className,
  initialValue,
}: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initialValue || '');
  const [debounced, setDebounced] = useState('');
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  useEffect(() => {
    if (initialValue !== undefined) {
      setValue(initialValue);
      setActiveIndex(-1);
    }
  }, [initialValue]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), 350);
    return () => clearTimeout(t);
  }, [value]);

  const query = useGlobalSearch(debounced, { limit });

  const flatItems: FlatItem[] = useMemo(() => {
    const data = query.data;
    if (!data) return [];

    const out: FlatItem[] = [];

    data.customers.forEach((c) => out.push({ kind: 'customer', id: c.id, href: `/customers/${c.id}` }));
    data.vehicles.forEach((v) => out.push({ kind: 'vehicle', id: v.id, href: `/vehicles/${v.id}` }));
    data.repairOrders.forEach((r) =>
      out.push({ kind: 'repairOrder', id: r.id, href: `/repair-orders/${r.id}` })
    );

    return out;
  }, [query.data]);

  const hasResults = (query.data?.customers?.length || 0) + (query.data?.vehicles?.length || 0) + (query.data?.repairOrders?.length || 0) > 0;

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const openFirst = () => {
    if (!flatItems.length) return;
    router.push(flatItems[0].href);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  };

  const openAt = (idx: number) => {
    const item = flatItems[idx];
    if (!item) return;
    router.push(item.href);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  };

  const viewAllHref = `/search?q=${encodeURIComponent(value.trim() || debounced.trim())}`;

  return (
    <div ref={rootRef} className={className}>
      <div className="relative">
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          className="w-full rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-2 pr-10 text-sm text-slate-100 placeholder:text-slate-400 backdrop-blur focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setOpen(false);
              setActiveIndex(-1);
              inputRef.current?.blur();
              return;
            }

            if (e.key === 'Enter') {
              e.preventDefault();
              if (activeIndex >= 0) {
                openAt(activeIndex);
              } else {
                openFirst();
              }
              return;
            }

            if (e.key === 'ArrowDown') {
              e.preventDefault();
              if (!open) setOpen(true);
              setActiveIndex((i) => {
                const next = Math.min(i + 1, flatItems.length - 1);
                return Math.max(next, 0);
              });
              return;
            }

            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            }
          }}
        />

        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#d7b73f' }}>
          ⌕
        </div>

        {open ? (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-white/15 bg-[#111111] shadow-xl shadow-black/60">
            <div className="max-h-[70vh] overflow-auto p-2">
              {!value.trim() ? (
                <div className="px-3 py-2 text-sm text-slate-300">Start typing to search…</div>
              ) : query.isLoading ? (
                <div className="px-3 py-2 text-sm text-slate-300">Searching…</div>
              ) : query.isError ? (
                <div className="px-3 py-2 text-sm text-red-200">Search failed.</div>
              ) : !hasResults ? (
                <div className="px-3 py-2 text-sm text-slate-300">No results.</div>
              ) : (
                <div className="space-y-2">
                  {query.data?.customers?.length ? (
                    <div>
                      <div className="px-3 py-1 text-xs font-semibold" style={{ color: '#d7b73f' }}>
                        Customers
                      </div>
                      <div className="space-y-1">
                        {query.data.customers.map((c) => {
                          const idx = flatItems.findIndex((x) => x.kind === 'customer' && x.id === c.id);
                          const active = idx === activeIndex;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              className={
                                'w-full rounded-md px-3 py-2 text-left text-sm ' +
                                (active ? 'bg-[#d7b73f]/15' : 'hover:bg-white/5')
                              }
                              onMouseEnter={() => setActiveIndex(idx)}
                              onClick={() => openAt(idx)}
                            >
                              <div className="font-medium" style={{ color: '#d7b73f' }}>
                                {c.name}
                              </div>
                              <div className="text-xs text-slate-300">
                                {[c.phone, c.email].filter(Boolean).join(' • ')}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <a
                        className="mt-1 block px-3 py-2 text-xs font-medium hover:opacity-90"
                        style={{ color: '#d7b73f' }}
                        href={`${viewAllHref}&tab=customers`}
                        onClick={() => setOpen(false)}
                      >
                        View all customers
                      </a>
                    </div>
                  ) : null}

                  {query.data?.vehicles?.length ? (
                    <div>
                      <div className="px-3 py-1 text-xs font-semibold" style={{ color: '#d7b73f' }}>
                        Vehicles
                      </div>
                      <div className="space-y-1">
                        {query.data.vehicles.map((v) => {
                          const idx = flatItems.findIndex((x) => x.kind === 'vehicle' && x.id === v.id);
                          const active = idx === activeIndex;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              className={
                                'w-full rounded-md px-3 py-2 text-left text-sm ' +
                                (active ? 'bg-[#d7b73f]/15' : 'hover:bg-white/5')
                              }
                              onMouseEnter={() => setActiveIndex(idx)}
                              onClick={() => openAt(idx)}
                            >
                              <div className="font-medium" style={{ color: '#d7b73f' }}>
                                {v.display}
                              </div>
                              <div className="text-xs text-slate-300">
                                {[v.vin ? `VIN ${v.vin}` : null, v.plate ? `Plate ${v.plate}` : null]
                                  .filter(Boolean)
                                  .join(' • ')}
                              </div>
                              {v.customerName || v.customerPhone ? (
                                <div className="text-xs text-slate-400">
                                  {[v.customerName, v.customerPhone].filter(Boolean).join(' • ')}
                                </div>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                      <a
                        className="mt-1 block px-3 py-2 text-xs font-medium hover:opacity-90"
                        style={{ color: '#d7b73f' }}
                        href={`${viewAllHref}&tab=vehicles`}
                        onClick={() => setOpen(false)}
                      >
                        View all vehicles
                      </a>
                    </div>
                  ) : null}

                  {query.data?.repairOrders?.length ? (
                    <div>
                      <div className="px-3 py-1 text-xs font-semibold" style={{ color: '#d7b73f' }}>
                        Repair Orders
                      </div>
                      <div className="space-y-1">
                        {query.data.repairOrders.map((r) => {
                          const idx = flatItems.findIndex((x) => x.kind === 'repairOrder' && x.id === r.id);
                          const active = idx === activeIndex;
                          return (
                            <button
                              key={r.id}
                              type="button"
                              className={
                                'w-full rounded-md px-3 py-2 text-left text-sm ' +
                                (active ? 'bg-[#d7b73f]/15' : 'hover:bg-white/5')
                              }
                              onMouseEnter={() => setActiveIndex(idx)}
                              onClick={() => openAt(idx)}
                            >
                              <div className="font-medium" style={{ color: '#d7b73f' }}>
                                <span className="font-mono text-xs text-slate-500">#{r.id.slice(0, 8)}</span>{' '}
                                {r.serviceType || 'Repair Order'}
                              </div>
                              <div className="text-xs text-slate-300">
                                {[r.status, r.vehicleDisplay].filter(Boolean).join(' • ')}
                              </div>
                              {r.customerName || r.customerPhone ? (
                                <div className="text-xs text-slate-400">
                                  {[r.customerName, r.customerPhone].filter(Boolean).join(' • ')}
                                </div>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                      <a
                        className="mt-1 block px-3 py-2 text-xs font-medium hover:opacity-90"
                        style={{ color: '#d7b73f' }}
                        href={`${viewAllHref}&tab=repairOrders`}
                        onClick={() => setOpen(false)}
                      >
                        View all repair orders
                      </a>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
