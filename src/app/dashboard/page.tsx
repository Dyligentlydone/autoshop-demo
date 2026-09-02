 'use client';

import { useEffect, useRef, useState } from 'react';

import type { ActiveRepairOrderItem, RepairOrderStatus } from '@/types';
import { useActiveRepairOrders } from '@/hooks/use-active-repair-orders';
import OfflineBanner from '@/components/OfflineBanner';

const formatVehicleDisplay = (vehicle: ActiveRepairOrderItem['vehicle']) => {
  if (!vehicle) return '';
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
};

const formatVin = (vin: string | undefined) => {
  const v = (vin || '').trim();
  if (!v) return '';
  return v;
};

const formatDuration = (ms: number) => {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const statusBadgeClasses = (status: RepairOrderStatus) => {
  switch (status) {
    case 'New':
      return 'bg-blue-500/15 text-blue-200 ring-blue-400/25';
    case 'Scheduled':
      return 'bg-indigo-500/15 text-indigo-200 ring-indigo-400/25';
    case 'Dropped Off':
      return 'bg-orange-500/30 text-orange-100 ring-orange-400/50';
    case 'Diagnosing':
      return 'bg-cyan-500/15 text-cyan-200 ring-cyan-400/25';
    case 'Waiting Approval':
      return 'bg-violet-500/15 text-violet-200 ring-violet-400/25';
    case 'Repair Approved':
      return 'bg-yellow-400/25 text-yellow-100 ring-yellow-300/50';
    case 'Awaiting Parts':
      return 'bg-amber-500/20 text-amber-100 ring-amber-400/40';
    case 'In Progress':
      return 'bg-lime-500/15 text-lime-200 ring-lime-400/25';
    case 'Ready For Pickup':
      return 'bg-green-500/15 text-green-200 ring-green-400/25';
    case 'Completed':
      return 'bg-[#D4AF37]/15 text-[#F6E7B7] ring-[#D4AF37]/35';
    default:
      return 'bg-slate-500/15 text-slate-200 ring-slate-400/25';
  }
};

export default function DashboardPage() {
  const { data: result, isLoading, isError, error } = useActiveRepairOrders();
  const data = result?.data ?? [];
  const isFromCache = result?.fromCache ?? false;
  const cacheTimestamp = result?.cacheTimestamp ?? null;
  const [now, setNow] = useState(() => Date.now());
  const tableHeaderRef = useRef<HTMLDivElement | null>(null);
  const [rowPx, setRowPx] = useState<number | null>(null);
  const [scale, setScale] = useState<number>(1);
  const clampLines = rowPx ? (rowPx >= 92 ? 4 : rowPx >= 72 ? 3 : 2) : 3;


  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const recalc = () => {
      const count = (data || []).length;
      if (!count) {
        setRowPx(null);
        setScale(1);
        return;
      }

      const tableHeaderH = tableHeaderRef.current?.getBoundingClientRect().height || 0;

      const viewportH = window.innerHeight;
      const paddingAllowance = 80; // Increased padding to account for page padding
      const available = Math.max(0, viewportH - tableHeaderH - paddingAllowance);
      
      // Set minimum row height to 56px to prevent entries from being too small
      const minRowHeight = 56;
      const nextRowPx = Math.max(minRowHeight, Math.floor(available / count));

      const base = 56;
      const nextScale = Math.max(0.85, Math.min(1.25, nextRowPx / base));

      setRowPx(nextRowPx);
      setScale(nextScale);
    };

    recalc();
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, [data]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden px-6 py-6">
      {isFromCache && cacheTimestamp && <OfflineBanner timestamp={cacheTimestamp} />}
      {isLoading ? (
        <div className="surface p-4 text-sm text-slate-300">Loading…</div>
      ) : isError ? (
        <div className="surface p-4 text-sm text-red-200">
          {(error as any)?.message || 'Failed to load active repair orders'}
        </div>
      ) : data.length === 0 ? (
        <div className="surface p-6">
          <div className="text-sm text-slate-300">No diagnosing / in-progress repair orders.</div>
          <div className="mt-2 text-xs text-slate-400">
            This view is intentionally limited to the statuses that need active attention.
          </div>
        </div>
      ) : (
        <div className="surface mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-hidden">
          <div
            ref={tableHeaderRef}
            className="grid grid-cols-12 gap-3 border-b border-white/10 bg-white/3 px-4 py-3 text-xs font-medium text-slate-300 flex-shrink-0"
          >
            <div className="col-span-2">Status</div>
            <div className="col-span-4">Vehicle</div>
            <div className="col-span-2">Service</div>
            <div className="col-span-3">Description</div>
            <div className="col-span-1 text-right">View</div>
          </div>
          <div className="min-h-0 flex-1 divide-y divide-white/10 overflow-y-auto">
            {data.map((item) => {
              const vehicleDisplay = formatVehicleDisplay(item.vehicle);
              const vinDisplay = formatVin(item.vehicle?.vin);

              const raw = item.repairOrder.updated_time || item.repairOrder.created_time;
              const t = raw ? new Date(raw).getTime() : NaN;
              const sinceMs = Number.isFinite(t) ? Math.max(0, now - t) : 0;

              return (
                <div
                  key={item.repairOrder.id}
                  className="grid grid-cols-12 gap-3 px-4 text-sm overflow-hidden"
                  style={{ height: rowPx ? `${rowPx}px` : undefined, fontSize: `${14 * scale}px` }}
                >
                  <div className="col-span-2 min-w-0 overflow-hidden">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset ${statusBadgeClasses(
                        item.repairOrder.status
                      )}`}
                    >
                      {item.repairOrder.status}
                    </span>
                    <div className="mt-1 text-xs text-slate-400" style={{ fontSize: `${12 * scale}px` }}>
                      {formatDuration(sinceMs)}
                    </div>
                  </div>
                  <div className="col-span-4 min-w-0 overflow-hidden">
                    <div className="font-medium text-slate-100 truncate leading-tight">
                      {vehicleDisplay || 'Unknown vehicle'}
                    </div>
                    <div
                      className="text-xs text-slate-400 truncate leading-tight"
                      style={{ fontSize: `${12 * scale}px` }}
                    >
                      Engine: {item.vehicle?.engine_size || '—'}
                    </div>
                    <div
                      className="text-xs text-slate-400 truncate leading-tight"
                      style={{ fontSize: `${12 * scale}px` }}
                    >
                      VIN: {vinDisplay || '—'}
                    </div>
                  </div>
                  <div className="col-span-2 min-w-0 overflow-hidden">
                    <div
                      className="text-slate-100 leading-tight"
                      style={{
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: clampLines,
                        overflow: 'hidden',
                      }}
                      title={item.repairOrder.service_type || ''}
                    >
                      {item.repairOrder.service_type || '—'}
                    </div>
                  </div>
                  <div className="col-span-3 min-w-0 overflow-hidden">
                    <div
                      className="text-slate-100 leading-tight"
                      style={{
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: clampLines,
                        overflow: 'hidden',
                      }}
                      title={item.repairOrder.job_description || ''}
                    >
                      {item.repairOrder.job_description || '—'}
                    </div>
                  </div>
                  <div className="col-span-1 min-w-0 text-right overflow-hidden">
                    <a
                      className="text-sm font-semibold text-[#D4AF37] hover:opacity-90"
                      href={`/repair-orders/${item.repairOrder.id}`}
                    >
                      Open
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
