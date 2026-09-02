'use client';

import { use, useEffect, useState } from 'react';

type Snapshot = {
  repairOrder: any;
  estimateItems: any[];
  effectiveItems: any[];
  photos: Array<{ id: string; url: string; name: string }>;
  settings: any;
  metadata: any;
};

type SnapshotResponse = {
  snapshot: Snapshot | null;
  pdfUrl: string | null;
  usedAt: string;
  approvedIp: string | null;
  approvedUserAgent: string | null;
};

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

export default function ApprovedSnapshotPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [data, setData] = useState<SnapshotResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/approval-tokens/${token}/snapshot`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || 'Failed to load snapshot');
          return;
        }
        setData(json.data);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load snapshot');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return <div className="p-8 text-sm text-slate-300">Loading approved estimate…</div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-red-300">
          {error}
        </div>
      </div>
    );
  }

  if (!data || !data.snapshot) {
    return <div className="p-8 text-sm text-slate-300">Snapshot not available.</div>;
  }

  const { snapshot, pdfUrl, usedAt, approvedIp, approvedUserAgent } = data;
  const { repairOrder, effectiveItems, photos, settings } = snapshot;

  const customerName = `${repairOrder?.customer?.first_name || ''} ${
    repairOrder?.customer?.last_name || ''
  }`.trim() || 'Customer';
  const vehicleInfo = repairOrder?.vehicle
    ? `${repairOrder.vehicle.year || ''} ${repairOrder.vehicle.make || ''} ${
        repairOrder.vehicle.model || ''
      }`.trim()
    : '';

  const subtotal = (effectiveItems || []).reduce(
    (sum: number, it: any) =>
      sum + (it.parts_price || 0) * (it.quantity || 1) + (it.labor_price || 0),
    0
  );
  const taxableSubtotal = (effectiveItems || []).reduce(
    (sum: number, it: any) =>
      sum +
      (it.taxable !== false
        ? (it.parts_price || 0) * (it.quantity || 1) + (it.labor_price || 0)
        : 0),
    0
  );
  const taxEnabled = settings?.tax?.enabled !== false;
  const taxRate = taxEnabled ? Number(settings?.tax?.rate ?? 6) : 0;
  const tax = taxableSubtotal * (taxRate / 100);
  const total = subtotal + tax;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: '#d7b73f' }}>
          Approved Estimate (Snapshot)
        </h1>
        <div className="mt-1 text-sm text-slate-400">
          Permanent record of what the customer approved.
        </div>
      </div>

      {/* Approval banner */}
      <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4">
        <div className="text-sm font-semibold text-green-300">✓ Approved {formatDate(usedAt)}</div>
        <div className="mt-1 text-xs text-green-200/80">
          {customerName} · {vehicleInfo || '—'}
        </div>
      </div>

      {/* Summary */}
      <div className="surface p-6 space-y-4">
        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div>
            <div className="text-xs font-medium" style={{ color: '#d7b73f' }}>
              Customer
            </div>
            <div className="text-slate-200">{customerName}</div>
          </div>
          <div>
            <div className="text-xs font-medium" style={{ color: '#d7b73f' }}>
              Vehicle
            </div>
            <div className="text-slate-200">{vehicleInfo || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-medium" style={{ color: '#d7b73f' }}>
              Service
            </div>
            <div className="text-slate-200">{repairOrder?.service_type || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-medium" style={{ color: '#d7b73f' }}>
              Repair Order
            </div>
            <a
              className="text-blue-400 underline"
              href={`/repair-orders/${repairOrder?.id}`}
            >
              {repairOrder?.id?.slice(0, 8)}…
            </a>
          </div>
        </div>

        {/* Line items */}
        {effectiveItems && effectiveItems.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-white/10">
            <div className="border-b border-white/10 bg-black/40 px-4 py-2 text-xs font-semibold" style={{ color: '#d7b73f' }}>
              Line Items
            </div>
            <div className="divide-y divide-white/10">
              {effectiveItems.map((item: any) => {
                const lineTotal =
                  (item.parts_price || 0) * (item.quantity || 1) + (item.labor_price || 0);
                return (
                  <div key={item.id} className="flex items-start justify-between gap-3 px-4 py-2 text-sm">
                    <div className="flex-1">
                      <div className="text-slate-100">{item.description}</div>
                      <div className="text-xs text-slate-400">
                        Qty {item.quantity || 1}
                        {item.parts_price ? ` · Parts $${(item.parts_price || 0).toFixed(2)}` : ''}
                        {item.labor_price ? ` · Labor $${(item.labor_price || 0).toFixed(2)}` : ''}
                      </div>
                    </div>
                    <div className="font-semibold text-slate-100">${lineTotal.toFixed(2)}</div>
                  </div>
                );
              })}
            </div>
            <div className="space-y-1 border-t border-white/10 bg-black/30 px-4 py-3 text-sm">
              <div className="flex justify-between text-slate-300">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {taxEnabled && (
                <div className="flex justify-between text-slate-300">
                  <span>Tax ({taxRate}%)</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-white/10 pt-2 font-semibold" style={{ color: '#d7b73f' }}>
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* PDF */}
        {pdfUrl && (
          <div className="rounded-lg border border-white/10 bg-black/30 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold" style={{ color: '#d7b73f' }}>
                Approved Estimate PDF
              </div>
              <a
                href={pdfUrl}
                download={`approved-estimate-${token}.pdf`}
                className="rounded-full bg-[#d7b73f] px-3 py-1 text-xs font-semibold text-black hover:bg-[#c9a534]"
              >
                ↓ Download
              </a>
            </div>
            <iframe src={pdfUrl} className="h-[600px] w-full rounded border border-white/10" title="Approved Estimate PDF" />
          </div>
        )}

        {/* Photos */}
        {photos && photos.length > 0 && (
          <div className="rounded-lg border border-white/10 bg-black/30 p-4">
            <div className="mb-2 text-xs font-semibold" style={{ color: '#d7b73f' }}>
              Photos at time of approval ({photos.length})
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {photos.map((p: any) => {
                const src = `/api/crm/repair-orders/${repairOrder?.id}/attachments/${p.id}/download`;
                const isVideo = p.mime_type?.startsWith('video/');
                return (
                  <a
                    key={p.id}
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-square overflow-hidden rounded-md border border-white/10 bg-black/40"
                  >
                    {isVideo ? (
                      <video src={src} className="h-full w-full object-cover" preload="metadata" muted playsInline />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={src} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                    )}
                  </a>
                );
              })}
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              Photos reference the original repair order attachments. If a photo is later deleted from the repair order, it may no longer load here.
            </div>
          </div>
        )}

        {/* Audit info */}
        <div className="rounded-lg border border-white/10 bg-black/30 p-4 text-xs">
          <div className="mb-2 font-semibold" style={{ color: '#d7b73f' }}>
            Audit
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
            <div>
              <dt className="text-slate-400">Approved at</dt>
              <dd className="text-slate-200">{formatDate(usedAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">IP</dt>
              <dd className="font-mono text-slate-200">{approvedIp || '—'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-400">User agent</dt>
              <dd className="break-all font-mono text-[11px] text-slate-300">
                {approvedUserAgent || '—'}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
