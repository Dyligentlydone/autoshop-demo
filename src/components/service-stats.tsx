'use client';

import { useActiveRepairOrders } from '@/hooks/use-active-repair-orders';

export default function ServiceStats() {
  const { data, isLoading } = useActiveRepairOrders();

  if (isLoading) {
    return (
      <div className="surface p-6">
        <div className="text-center text-sm text-slate-400">Loading service stats...</div>
      </div>
    );
  }

  const items = data?.data || [];

  // Count by status - only count "actively servicing" statuses
  const statusCounts: Record<string, number> = {};
  let activeCount = 0;

  items.forEach((item: any) => {
    const status = item.repairOrder.status || 'Unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    // Active statuses (exclude Completed, New, Scheduled)
    const statusLower = status.toLowerCase();
    if (
      statusLower !== 'completed' &&
      statusLower !== 'new' &&
      statusLower !== 'scheduled' &&
      statusLower !== 'ready for pickup'
    ) {
      activeCount++;
    }
  });

  // Sort statuses by count (descending)
  const sortedStatuses = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="surface p-6">
      {/* Total Active */}
      <div className="mb-6 text-center">
        <div className="text-5xl font-bold" style={{ color: '#d7b73f' }}>
          {activeCount}
        </div>
        <div className="mt-2 text-sm text-slate-400">
          Cars Actively Being Serviced
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          By Status
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {sortedStatuses.map(([status, count]) => {
            const statusLower = status.toLowerCase();
            const isActive =
              statusLower !== 'completed' &&
              statusLower !== 'new' &&
              statusLower !== 'scheduled';

            return (
              <div
                key={status}
                className={`rounded-lg border p-3 ${
                  isActive
                    ? 'border-[#d7b73f]/30 bg-[#d7b73f]/5'
                    : 'border-white/10 bg-white/3'
                }`}
              >
                <div
                  className={`text-2xl font-bold ${
                    isActive ? 'text-[#d7b73f]' : 'text-slate-400'
                  }`}
                >
                  {count}
                </div>
                <div className="mt-1 text-xs text-slate-400">{status}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
