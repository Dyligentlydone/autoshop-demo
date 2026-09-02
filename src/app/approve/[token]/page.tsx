'use client';

import { use, useState, useEffect } from 'react';
import { pdf } from '@react-pdf/renderer';
import { QuotePDF } from '@/components/quote-pdf';
import type { RepairOrderStatus } from '@/types';

const getStatusColors = (status: RepairOrderStatus) => {
  switch (status) {
    case 'New':
      return { bg: 'bg-blue-500/20', text: 'text-blue-200', border: 'border-blue-400/30' };
    case 'Scheduled':
      return { bg: 'bg-indigo-500/20', text: 'text-indigo-200', border: 'border-indigo-400/30' };
    case 'Dropped Off':
      return { bg: 'bg-orange-500/30', text: 'text-orange-100', border: 'border-orange-400/40' };
    case 'Diagnosing':
      return { bg: 'bg-cyan-500/20', text: 'text-cyan-200', border: 'border-cyan-400/30' };
    case 'Waiting Approval':
      return { bg: 'bg-violet-500/20', text: 'text-violet-200', border: 'border-violet-400/30' };
    case 'Repair Approved':
      return { bg: 'bg-yellow-400/25', text: 'text-yellow-100', border: 'border-yellow-300/40' };
    case 'Awaiting Parts':
      return { bg: 'bg-amber-500/20', text: 'text-amber-100', border: 'border-amber-400/35' };
    case 'In Progress':
      return { bg: 'bg-lime-500/20', text: 'text-lime-200', border: 'border-lime-400/30' };
    case 'Ready For Pickup':
      return { bg: 'bg-green-500/20', text: 'text-green-200', border: 'border-green-400/30' };
    case 'Completed':
      return { bg: 'bg-[#D4AF37]/20', text: 'text-[#F6E7B7]', border: 'border-[#D4AF37]/40' };
    default:
      return { bg: 'bg-slate-500/20', text: 'text-slate-200', border: 'border-slate-400/30' };
  }
};

type EstimateItem = {
  id: string;
  description: string;
  quantity: number;
  parts_price: number;
  labor_price: number;
  taxable?: boolean;
};

type Photo = { id: string; url: string; name: string; mime_type?: string };

type ApprovalData = {
  repairOrder: {
    id: string;
    service_type: string;
    job_description?: string;
    estimated_total?: number;
    estimated_completion?: string;
    vehicle?: {
      make?: string;
      model?: string;
      year?: string;
      vin?: string;
    };
    customer?: {
      first_name?: string;
      last_name?: string;
    };
  };
  estimateItems: EstimateItem[];
  photos?: Photo[];
  settings?: any;
  metadata?: any;
  expiresAt: string;
  isUsed?: boolean;
  usedAt?: string | null;
};

// Build effective line items, falling back to a synthetic item from estimated_total
const buildEffectiveLineItems = (data: ApprovalData) => {
  const items = data.estimateItems || [];
  if (items.length > 0) return items;

  const total = data.repairOrder.estimated_total;
  if (total && total > 0) {
    return [
      {
        id: 'estimated-total',
        description:
          data.repairOrder.job_description ||
          data.repairOrder.service_type ||
          'Repair service',
        quantity: 1,
        parts_price: 0,
        labor_price: total,
        taxable: true,
      } as EstimateItem,
    ];
  }
  return [];
};

export default function ApprovalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<ApprovalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [liveStatus, setLiveStatus] = useState<any>(null);

  // Poll for live status updates when approved (or already approved on load)
  useEffect(() => {
    const isApproved = approved || data?.isUsed;
    if (!isApproved || !token) return;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/approval-tokens/${token}/status`);
        if (res.ok) {
          const json = await res.json();
          setLiveStatus(json.data);
        }
      } catch (err) {
        console.error('Failed to fetch status:', err);
      }
    };

    // Initial fetch
    fetchStatus();

    // Poll every 30 seconds
    const interval = setInterval(fetchStatus, 30000);

    return () => clearInterval(interval);
  }, [approved, data?.isUsed, token]);

  // Generate PDF when data is loaded
  useEffect(() => {
    const generatePdf = async () => {
      if (!data) return;
      
      try {
        const customerName = `${data.repairOrder.customer?.first_name || ''} ${data.repairOrder.customer?.last_name || ''}`.trim();
        const vehicleInfo = data.repairOrder.vehicle
          ? `${data.repairOrder.vehicle.year || ''} ${data.repairOrder.vehicle.make || ''} ${data.repairOrder.vehicle.model || ''}`.trim()
          : '';
        
        const effectiveItems = buildEffectiveLineItems(data);
        const lineItems = effectiveItems.map((item: any) => ({
          id: item.id,
          repair_order_id: data.repairOrder.id,
          description: item.description,
          quantity: item.quantity,
          parts_price: item.parts_price || 0,
          labor_price: item.labor_price || 0,
          part_number: item.part_number || item.parts_source || '',
          condition: item.condition || item.parts_condition || 'new',
          taxable: item.taxable !== false,
          created_at: item.created_at,
          updated_at: item.updated_at,
        }));

        const blob = await pdf(
          <QuotePDF
            lineItems={lineItems as any}
            settings={data.settings}
            repairOrderId={data.repairOrder.id}
            customerName={customerName}
            vehicleInfo={vehicleInfo}
            vin={data.repairOrder.vehicle?.vin}
            estimatedCompletion={data.repairOrder.estimated_completion}
            jobDescription={data.repairOrder.job_description}
          />
        ).toBlob();
        
        const url = URL.createObjectURL(blob);
        setPdfUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch (err) {
        console.error('Failed to generate PDF:', err);
      }
    };
    
    generatePdf();

    return () => {
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [data]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/approval-tokens/${token}`);
        const json = await res.json();

        if (!res.ok) {
          setError(json.error || 'Failed to load estimate');
          return;
        }

        setData(json.data);
      } catch (err: any) {
        setError('Failed to load estimate details');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const handleApprove = async () => {
    setConfirmOpen(false);
    setApproving(true);
    try {
      const form = new FormData();

      // Build snapshot of frozen data
      if (data) {
        const snapshot = {
          repairOrder: data.repairOrder,
          estimateItems: data.estimateItems,
          effectiveItems: buildEffectiveLineItems(data),
          photos: data.photos || [],
          settings: data.settings || null,
          metadata: data.metadata || null,
        };
        form.append('snapshot', JSON.stringify(snapshot));
      }

      // Attach the PDF blob (fetched from the blob URL we already generated)
      if (pdfUrl) {
        try {
          const pdfBlob = await (await fetch(pdfUrl)).blob();
          form.append('pdf', pdfBlob, 'estimate.pdf');
        } catch (pdfErr) {
          console.error('Failed to attach PDF to approval:', pdfErr);
        }
      }

      let success = false;
      try {
        const res = await fetch(`/api/approval-tokens/${token}`, {
          method: 'POST',
          body: form,
        });
        const json = await res.json().catch(() => ({}));
        success = res.ok || Boolean(json?.success);
      } catch (networkErr) {
        // Mobile networks may drop the response even after the server processed
        // the approval. Fall through to a status re-check below.
        console.error('Approval request failed, will verify status:', networkErr);
      }

      if (!success) {
        try {
          const statusRes = await fetch(`/api/approval-tokens/${token}/status`, { cache: 'no-store' });
          if (statusRes.ok) {
            const statusJson = await statusRes.json();
            if (statusJson?.data?.is_used) {
              success = true;
            }
          }
        } catch (statusErr) {
          console.error('Status re-check failed:', statusErr);
        }
      }

      if (success) {
        setApproved(true);
        return;
      }

      alert('We could not confirm the approval. Please check your connection and try again.');
    } catch (err: any) {
      alert('Failed to approve estimate. Please try again.');
      console.error(err);
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center">
          <div className="mb-4 text-lg text-slate-300">Loading estimate...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4">
        <div className="w-full max-w-md rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-center">
          <div className="mb-2 text-xl font-semibold text-red-400">⚠️ Error</div>
          <div className="text-slate-300">{error}</div>
        </div>
      </div>
    );
  }

  if (approved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4">
        <div className="w-full max-w-md rounded-lg border border-green-500/30 bg-green-500/10 p-8 text-center">
          <div className="mb-4 text-6xl">✅</div>
          <div className="mb-2 text-2xl font-semibold text-green-400">Estimate Approved!</div>
          <div className="text-slate-300">
            Thank you for approving your estimate. We'll get started on your repair right away!
          </div>
          {liveStatus && (() => {
            const colors = getStatusColors(liveStatus.status as RepairOrderStatus);
            return (
              <div className={`mt-6 rounded-lg border ${colors.border} ${colors.bg} p-4`}>
                <div className="text-sm font-semibold text-[#d7b73f]">Live Status</div>
                <div className={`mt-2 inline-block rounded-full px-4 py-1.5 text-base font-semibold ${colors.bg} ${colors.text} border ${colors.border}`}>
                  {liveStatus.status}
                </div>
                {liveStatus.estimated_completion && (
                  <div className="mt-3 text-xs text-slate-400">
                    Est. Completion: {new Date(liveStatus.estimated_completion).toLocaleDateString()}
                  </div>
                )}
                <div className="mt-3 text-xs text-slate-500">
                  Updates automatically every 30 seconds
                </div>
              </div>
            );
          })()}
          <div className="mt-6 text-sm text-slate-400">
            You can close this page now.
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { repairOrder } = data;
  const customerName = `${repairOrder.customer?.first_name || ''} ${repairOrder.customer?.last_name || ''}`.trim() || 'Valued Customer';
  const vehicleInfo = repairOrder.vehicle
    ? `${repairOrder.vehicle.year || ''} ${repairOrder.vehicle.make || ''} ${repairOrder.vehicle.model || ''}`.trim()
    : null;

  return (
    <div className="min-h-screen bg-black text-slate-100">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 text-2xl font-bold tracking-tight" style={{ color: '#d7b73f' }}>Demo Auto Shop</div>
          {data.isUsed ? (
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: '#d7b73f' }}>
                Live Status
              </h1>
              {liveStatus ? (() => {
                const colors = getStatusColors(liveStatus.status as RepairOrderStatus);
                return (
                  <div className="mt-3">
                    <div className={`inline-block rounded-full px-4 py-1.5 text-base font-semibold ${colors.bg} ${colors.text} border ${colors.border}`}>
                      {liveStatus.status}
                    </div>
                    {liveStatus.estimated_completion && (
                      <div className="mt-2 text-sm text-slate-400">
                        Est. Completion: {new Date(liveStatus.estimated_completion).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                    )}
                  </div>
                );
              })() : (
                <div className="mt-2 text-lg font-medium text-slate-400">Loading...</div>
              )}
            </div>
          ) : (
            <h1 className="text-2xl font-semibold" style={{ color: '#d7b73f' }}>
              Estimate Approval
            </h1>
          )}
        </div>

        {/* Message Preview */}
        <div className="mb-6 rounded-lg border border-white/10 bg-black/50 p-6 backdrop-blur">
          <div className="whitespace-pre-wrap text-slate-200">
            Hi {customerName}!
            {'\n\n'}
            Your {repairOrder.service_type || 'service'} estimate is ready:
            {'\n'}
            {repairOrder.estimated_total !== undefined && repairOrder.estimated_total !== null && (
              `💰 Estimated Total: $${repairOrder.estimated_total.toFixed(2)}\n`
            )}
            {repairOrder.estimated_completion && (
              `📅 Est. Completion: ${new Date(repairOrder.estimated_completion).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}\n`
            )}
            {'\n'}
            Questions? Reply to this message or call us!
            {'\n\n'}
            - Demo Auto Shop
          </div>
        </div>

        {/* PDF Thumbnail - click to expand */}
        <div className="mb-6">
          {pdfUrl ? (
            <button
              type="button"
              onClick={() => setPdfModalOpen(true)}
              className="group w-full overflow-hidden rounded-lg border border-white/10 bg-white/5 transition hover:border-[#d7b73f]/50 hover:bg-white/10"
            >
              <div className="relative">
                <iframe
                  src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                  className="pointer-events-none w-full"
                  style={{ height: '560px' }}
                  title="Estimate PDF preview"
                />
                {/* Overlay hint */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/40">
                  <div className="rounded-full bg-black/80 px-4 py-2 text-sm font-medium text-white opacity-0 transition group-hover:opacity-100">
                    Click to view full estimate
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 bg-black/40 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <span style={{ color: '#d7b73f' }}>📄</span>
                  <span>Estimate PDF</span>
                </div>
                <div className="text-xs text-slate-400">Tap to expand</div>
              </div>
            </button>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-lg border border-white/10 bg-white/5">
              <div className="text-sm text-slate-400">Generating PDF...</div>
            </div>
          )}
        </div>

        {/* Line Items (inline) */}
        {(() => {
          const effectiveItems = buildEffectiveLineItems(data);
          if (effectiveItems.length === 0) return null;

          const subtotal = effectiveItems.reduce(
            (sum, it) => sum + (it.parts_price || 0) * (it.quantity || 1) + (it.labor_price || 0),
            0
          );
          const taxableSubtotal = effectiveItems.reduce(
            (sum, it) =>
              sum +
              (it.taxable !== false
                ? (it.parts_price || 0) * (it.quantity || 1) + (it.labor_price || 0)
                : 0),
            0
          );
          const taxEnabled = data.settings?.tax?.enabled !== false;
          const taxRate = taxEnabled ? Number(data.settings?.tax?.rate ?? 6) : 0;
          const tax = taxableSubtotal * (taxRate / 100);
          const total = subtotal + tax;
          return (
            <div className="mb-6 overflow-hidden rounded-lg border border-white/10 bg-black/50 backdrop-blur">
              <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold" style={{ color: '#d7b73f' }}>
                Line Items
              </div>
              <div className="divide-y divide-white/10">
                {effectiveItems.map((item) => {
                  const lineTotal = (item.parts_price || 0) * (item.quantity || 1) + (item.labor_price || 0);
                  return (
                    <div key={item.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-slate-100">{item.description}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            Qty {item.quantity || 1}
                            {item.parts_price ? ` · Parts $${(item.parts_price || 0).toFixed(2)}` : ''}
                            {item.labor_price ? ` · Labor $${(item.labor_price || 0).toFixed(2)}` : ''}
                          </div>
                        </div>
                        <div className="whitespace-nowrap text-sm font-semibold text-slate-100">
                          ${lineTotal.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-1 border-t border-white/10 bg-black/40 px-4 py-3 text-sm">
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
                <div className="flex justify-between border-t border-white/10 pt-2 text-base font-semibold" style={{ color: '#d7b73f' }}>
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Photos + Videos (inline) */}
        {data.photos && data.photos.length > 0 && (() => {
          const photoCount = data.photos.filter(
            (p) => !p.mime_type || p.mime_type.startsWith('image/')
          ).length;
          const videoCount = data.photos.filter((p) =>
            p.mime_type?.startsWith('video/')
          ).length;
          const titleParts: string[] = [];
          if (photoCount > 0) titleParts.push(`${photoCount} photo${photoCount === 1 ? '' : 's'}`);
          if (videoCount > 0) titleParts.push(`${videoCount} video${videoCount === 1 ? '' : 's'}`);

          return (
            <div className="mb-6 overflow-hidden rounded-lg border border-white/10 bg-black/50 backdrop-blur">
              <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold" style={{ color: '#d7b73f' }}>
                {titleParts.join(' · ')}
              </div>
              <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
                {data.photos.map((photo) => {
                  const isVideo = photo.mime_type?.startsWith('video/');
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setLightboxPhoto(photo)}
                      className="group relative aspect-square overflow-hidden rounded-md border border-white/10 bg-black/40"
                    >
                      {isVideo ? (
                        <>
                          <video
                            src={photo.url}
                            className="h-full w-full object-cover"
                            preload="metadata"
                            muted
                            playsInline
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/70 text-2xl text-white">
                              ▶
                            </div>
                          </div>
                        </>
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={photo.url}
                          alt={photo.name}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                          loading="lazy"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Approve Button OR Approved Banner */}
        {data.isUsed ? (
          <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-6 text-center backdrop-blur">
            <div className="mb-1 text-4xl">✓</div>
            <div className="text-2xl font-semibold text-green-400">Repair Approved</div>
            {data.usedAt && (
              <div className="mt-1 text-xs text-green-300/80">
                Approved on{' '}
                {new Date(data.usedAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </div>
            )}
            <div className="mt-3 text-sm text-slate-300">
              We're working on your repair. Save this page for your records.
            </div>
            {liveStatus && (() => {
              const colors = getStatusColors(liveStatus.status as RepairOrderStatus);
              return (
                <div className={`mt-6 rounded-lg border ${colors.border} ${colors.bg} p-4`}>
                  <div className="text-sm font-semibold text-[#d7b73f]">Live Status</div>
                  <div className={`mt-2 inline-block rounded-full px-4 py-1.5 text-base font-semibold ${colors.bg} ${colors.text} border ${colors.border}`}>
                    {liveStatus.status}
                  </div>
                  {liveStatus.estimated_completion && (
                    <div className="mt-3 text-xs text-slate-400">
                      Est. Completion: {new Date(liveStatus.estimated_completion).toLocaleDateString()}
                    </div>
                  )}
                  <div className="mt-3 text-xs text-slate-500">
                    Updates automatically every 30 seconds
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 bg-black/50 p-6 backdrop-blur">
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={approving}
              className="w-full rounded-full bg-[#d7b73f] px-8 py-4 text-lg font-semibold text-black transition hover:bg-[#c9a534] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {approving ? 'Approving...' : '✓ Approve Estimate'}
            </button>

            <div className="mt-4 text-center text-sm text-slate-400">
              By approving, you authorize us to proceed with the repair.
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-slate-500">
          Questions? Call us or reply to our text message.
        </div>
      </div>

      {/* Full-screen PDF Modal */}
      {pdfModalOpen && pdfUrl && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col bg-black/95"
          onClick={() => setPdfModalOpen(false)}
        >
          {/* Modal Header */}
          <div
            className="flex items-center justify-between border-b border-white/10 bg-black px-4 py-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-medium text-slate-200">Estimate PDF</div>
            <div className="flex items-center gap-2">
              <a
                href={pdfUrl}
                download={`estimate-${data.repairOrder.id.slice(0, 8)}.pdf`}
                className="rounded-full bg-[#d7b73f] px-4 py-2 text-sm font-semibold text-black hover:bg-[#c9a534]"
              >
                ↓ Save
              </a>
              <button
                type="button"
                onClick={() => setPdfModalOpen(false)}
                className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                ✕ Close
              </button>
            </div>
          </div>
          
          {/* PDF Viewer */}
          <div
            className="flex-1 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={pdfUrl}
              className="h-full w-full"
              title="Estimate PDF"
            />
          </div>
        </div>
      )}

      {/* Custom Confirm Modal */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-[#d7b73f]/30 bg-black p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 text-center text-4xl">✓</div>
            <h2 className="mb-2 text-center text-xl font-semibold" style={{ color: '#d7b73f' }}>
              Confirm Approval
            </h2>
            <p className="mb-6 text-center text-sm text-slate-300">
              By approving, you authorize Demo Auto Shop to proceed with the repair as outlined in this estimate.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving}
                className="flex-1 rounded-full bg-[#d7b73f] px-6 py-3 text-sm font-semibold text-black transition hover:bg-[#c9a534] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {approving ? 'Approving...' : 'Yes, Approve'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={approving}
                className="flex-1 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col bg-black/95"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="flex items-center justify-between border-b border-white/10 bg-black px-4 py-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="truncate text-sm font-medium text-slate-200">{lightboxPhoto.name}</div>
            <button
              type="button"
              onClick={() => setLightboxPhoto(null)}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              ✕ Close
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            {lightboxPhoto.mime_type?.startsWith('video/') ? (
              <video
                src={lightboxPhoto.url}
                className="max-h-full max-w-full"
                controls
                autoPlay
                playsInline
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={lightboxPhoto.url}
                alt={lightboxPhoto.name}
                className="max-h-full max-w-full object-contain"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
