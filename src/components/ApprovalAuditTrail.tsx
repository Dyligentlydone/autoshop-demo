'use client';

import { useEffect, useState } from 'react';

type ApprovalToken = {
  id: string;
  token: string;
  created_at: string;
  expires_at: string;
  first_viewed_at: string | null;
  view_count: number | null;
  used_at: string | null;
  is_used: boolean;
  approved_ip: string | null;
  approved_user_agent: string | null;
};

const formatDate = (iso: string | null) => {
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

const summarizeUserAgent = (ua: string | null) => {
  if (!ua) return '—';
  // Try to extract a friendly device/browser label
  const isIPhone = /iPhone/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isMac = /Macintosh|Mac OS X/.test(ua);
  const isWindows = /Windows/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
  const isChrome = /Chrome/.test(ua);
  const isFirefox = /Firefox/.test(ua);

  const device = isIPhone
    ? 'iPhone'
    : isAndroid
    ? 'Android'
    : isMac
    ? 'Mac'
    : isWindows
    ? 'Windows'
    : 'Unknown device';

  const browser = isChrome
    ? 'Chrome'
    : isSafari
    ? 'Safari'
    : isFirefox
    ? 'Firefox'
    : '';

  return browser ? `${device} · ${browser}` : device;
};

export default function ApprovalAuditTrail({ repairOrderId }: { repairOrderId: string }) {
  const [tokens, setTokens] = useState<ApprovalToken[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchTokens = async () => {
      try {
        const res = await fetch(`/api/approval-tokens/by-repair-order/${repairOrderId}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || 'Failed to load approval history');
          return;
        }
        setTokens(json.data || []);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load approval history');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchTokens();
    return () => {
      cancelled = true;
    };
  }, [repairOrderId]);

  if (loading) {
    return (
      <div className="border-t border-white/10 pt-6">
        <h3 className="mb-3 text-sm font-medium" style={{ color: '#d7b73f' }}>
          Estimate Approval History
        </h3>
        <div className="text-sm text-slate-400">Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-t border-white/10 pt-6">
        <h3 className="mb-3 text-sm font-medium" style={{ color: '#d7b73f' }}>
          Estimate Approval History
        </h3>
        <div className="text-sm text-red-300">{error}</div>
      </div>
    );
  }

  if (!tokens || tokens.length === 0) {
    return (
      <div className="border-t border-white/10 pt-6">
        <h3 className="mb-3 text-sm font-medium" style={{ color: '#d7b73f' }}>
          Estimate Approval History
        </h3>
        <div className="text-sm text-slate-400">
          No estimates have been sent for this repair order yet.
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-white/10 pt-6">
      <h3 className="mb-3 text-sm font-medium" style={{ color: '#d7b73f' }}>
        Estimate Approval History
      </h3>
      <div className="space-y-2">
        {tokens.map((tk) => {
          const isApproved = tk.is_used;
          const isExpired = !isApproved && new Date(tk.expires_at) < new Date();
          const wasViewed = !!tk.first_viewed_at;
          const expanded = expandedId === tk.id;

          let statusLabel: string;
          let statusColor: string;
          if (isApproved) {
            statusLabel = '✓ Approved';
            statusColor = 'text-green-400 border-green-500/30 bg-green-500/10';
          } else if (isExpired) {
            statusLabel = 'Expired';
            statusColor = 'text-slate-400 border-white/10 bg-white/5';
          } else if (wasViewed) {
            statusLabel = 'Viewed · Pending';
            statusColor = 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10';
          } else {
            statusLabel = 'Sent · Not viewed';
            statusColor = 'text-slate-300 border-white/10 bg-white/5';
          }

          return (
            <div
              key={tk.id}
              className="overflow-hidden rounded-lg border border-white/10 bg-black/30"
            >
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : tk.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/5"
              >
                <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                  <span
                    className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-xs font-medium ${statusColor}`}
                  >
                    {statusLabel}
                  </span>
                  <span className="text-xs text-slate-300">
                    Sent {formatDate(tk.created_at)}
                  </span>
                  {tk.view_count ? (
                    <span className="text-xs text-slate-400">
                      {tk.view_count} view{tk.view_count === 1 ? '' : 's'}
                    </span>
                  ) : null}
                </div>
                <span className="text-xs text-slate-400">{expanded ? '▲' : '▼'}</span>
              </button>

              {expanded && (
                <div className="border-t border-white/10 bg-black/20 px-4 py-3 text-xs">
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                    <div>
                      <dt className="text-slate-400">Sent</dt>
                      <dd className="text-slate-200">{formatDate(tk.created_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Expires</dt>
                      <dd className="text-slate-200">{formatDate(tk.expires_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">First viewed</dt>
                      <dd className="text-slate-200">{formatDate(tk.first_viewed_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Total views</dt>
                      <dd className="text-slate-200">{tk.view_count ?? 0}</dd>
                    </div>
                    {isApproved && (
                      <>
                        <div>
                          <dt className="text-slate-400">Approved at</dt>
                          <dd className="text-green-300">{formatDate(tk.used_at)}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-400">Approved from</dt>
                          <dd className="text-slate-200">
                            {summarizeUserAgent(tk.approved_user_agent)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-400">IP address</dt>
                          <dd className="font-mono text-slate-200">
                            {tk.approved_ip || '—'}
                          </dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-slate-400">User agent</dt>
                          <dd className="break-all font-mono text-[11px] text-slate-300">
                            {tk.approved_user_agent || '—'}
                          </dd>
                        </div>
                        <div className="sm:col-span-2">
                          <a
                            href={`/approved/${tk.token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block rounded-full border border-[#d7b73f]/40 bg-[#d7b73f]/10 px-3 py-1 text-xs font-semibold text-[#d7b73f] hover:bg-[#d7b73f]/20"
                          >
                            View approved estimate (snapshot) →
                          </a>
                        </div>
                      </>
                    )}
                  </dl>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
