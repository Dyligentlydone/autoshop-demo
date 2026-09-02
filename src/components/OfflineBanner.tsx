'use client';

import { formatSnapshotAge } from '@/lib/local-snapshot';

type Props = {
  timestamp: number;
};

export default function OfflineBanner({ timestamp }: Props) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5 text-sm text-yellow-200 mb-4">
      <span className="text-base">⚠</span>
      <span>
        <span className="font-semibold">No connection</span> — showing saved data from{' '}
        <span className="font-medium">{formatSnapshotAge(timestamp)}</span>.
        Refresh the page when back online.
      </span>
    </div>
  );
}
