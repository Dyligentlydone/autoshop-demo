'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import GlobalSearch from '@/components/global-search';
import { useGlobalSearch } from '@/hooks/use-global-search';

export default function SearchClient() {
  const sp = useSearchParams();
  const q = sp.get('q') || '';

  const query = useGlobalSearch(q, { limit: 20 });

  const data = query.data;
  const empty =
    !query.isLoading &&
    !!q.trim() &&
    ((data?.customers?.length || 0) + (data?.vehicles?.length || 0) + (data?.repairOrders?.length || 0) === 0);

  const tab = (sp.get('tab') || '').toLowerCase();

  const sections = useMemo(
    () => [
      { key: 'customers', label: 'Customers' },
      { key: 'vehicles', label: 'Vehicles' },
      { key: 'repairorders', label: 'Repair Orders' },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Search</h1>
        <p className="mt-1 text-sm text-slate-300">Global search across customers, vehicles, and repair orders.</p>
      </div>

      <GlobalSearch placeholder="Search…" className="max-w-3xl" initialValue={q} />

      <div className="surface p-4">
        <div className="text-sm" style={{ color: '#d7b73f' }}>
          Results for: <span className="font-mono">{q.trim() || '—'}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {sections.map((s) => {
            const active =
              (tab === '' && s.key === 'customers') ||
              tab === s.key ||
              (tab === 'repairorders' && s.key === 'repairorders');

            const href = `/search?q=${encodeURIComponent(q)}&tab=${encodeURIComponent(s.key)}`;

            return (
              <a
                key={s.key}
                href={href}
                className={
                  'rounded-full px-4 py-2 text-sm font-medium ' +
                  (active ? 'bg-[#d7b73f]/15' : 'bg-white/5 hover:bg-white/8')
                }
                style={{ color: '#d7b73f' }}
              >
                {s.label}
              </a>
            );
          })}
        </div>

        <div className="mt-4">
          {!q.trim() ? (
            <div className="text-sm text-slate-300">Type in the search box above.</div>
          ) : query.isLoading ? (
            <div className="text-sm text-slate-300">Searching…</div>
          ) : query.isError ? (
            <div className="text-sm text-red-200">Search failed.</div>
          ) : empty ? (
            <div className="text-sm text-slate-300">No results.</div>
          ) : tab === 'vehicles' ? (
            <div className="space-y-2">
              {(data?.vehicles || []).map((v) => (
                <a
                  key={v.id}
                  href={`/vehicles/${v.id}`}
                  className="block rounded-lg border border-white/10 bg-white/3 p-3 hover:bg-white/5"
                >
                  <div className="text-sm font-semibold" style={{ color: '#d7b73f' }}>
                    {v.display}
                  </div>
                  <div className="text-xs text-slate-300">
                    {[v.vin ? `VIN ${v.vin}` : null, v.plate ? `Plate ${v.plate}` : null]
                      .filter(Boolean)
                      .join(' • ')}
                  </div>
                  {v.customerName || v.customerPhone ? (
                    <div className="text-xs text-slate-400">{[v.customerName, v.customerPhone].filter(Boolean).join(' • ')}</div>
                  ) : null}
                </a>
              ))}
            </div>
          ) : tab === 'repairorders' ? (
            <div className="space-y-2">
              {(data?.repairOrders || []).map((r) => (
                <a
                  key={r.id}
                  href={`/repair-orders/${r.id}`}
                  className="block rounded-lg border border-white/10 bg-white/3 p-3 hover:bg-white/5"
                >
                  <div className="text-sm font-semibold" style={{ color: '#d7b73f' }}>
                    {r.serviceType || 'Repair Order'}
                  </div>
                  <div className="text-xs text-slate-300">{[r.status, r.vehicleDisplay].filter(Boolean).join(' • ')}</div>
                  {r.customerName || r.customerPhone ? (
                    <div className="text-xs text-slate-400">{[r.customerName, r.customerPhone].filter(Boolean).join(' • ')}</div>
                  ) : null}
                </a>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(data?.customers || []).map((c) => (
                <a
                  key={c.id}
                  href={`/customers/${c.id}`}
                  className="block rounded-lg border border-white/10 bg-white/3 p-3 hover:bg-white/5"
                >
                  <div className="text-sm font-semibold" style={{ color: '#d7b73f' }}>
                    {c.name}
                  </div>
                  <div className="text-xs text-slate-300">{[c.phone, c.email].filter(Boolean).join(' • ')}</div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
