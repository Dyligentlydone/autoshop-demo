'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import GlobalSearch from '@/components/global-search';
import { useCustomer } from '@/hooks/use-customer';
import { useUpdateCustomer } from '@/hooks/use-update-customer';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Vehicle } from '@/types';

export default function CustomerDetailClient({ id }: { id: string }) {
  const q = useCustomer(id, { full: true });
  const update = useUpdateCustomer();

  const data = q.data?.data;
  const raw = q.data?.raw;

  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [preferredContactMethod, setPreferredContactMethod] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  const vehiclesQ = useQuery({
    queryKey: ['vehicles', 'by-customer', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await apiClient.get<{ data: Vehicle[]; info?: { count: number; more_records: boolean } }>(
        `/api/crm/vehicles/by-customer?customer_id=${encodeURIComponent(id)}`
      );
      return res;
    },
  });

  useEffect(() => {
    if (!data) return;
    setFirstName(data.first_name || '');
    setLastName(data.last_name || '');
    setPhone(data.phone || '');
    setEmail(data.email || '');
    setPreferredContactMethod(
      typeof raw?.Preferred_Contact_Method === 'string'
        ? raw.Preferred_Contact_Method
        : Array.isArray(raw?.Preferred_Contact_Method)
          ? raw.Preferred_Contact_Method.filter(Boolean).join(', ')
          : '',
    );
    setAdditionalNotes(typeof raw?.Description === 'string' ? raw.Description : '');
  }, [data, raw]);

  const displayName = useMemo(() => {
    const name = `${data?.first_name || ''} ${data?.last_name || ''}`.trim();
    return name || data?.phone || id;
  }, [data, id]);

  const onCancel = () => {
    if (data) {
      setFirstName(data.first_name || '');
      setLastName(data.last_name || '');
      setPhone(data.phone || '');
      setEmail(data.email || '');
      setPreferredContactMethod(
        typeof raw?.Preferred_Contact_Method === 'string'
          ? raw.Preferred_Contact_Method
          : Array.isArray(raw?.Preferred_Contact_Method)
            ? raw.Preferred_Contact_Method.filter(Boolean).join(', ')
            : '',
      );
      setAdditionalNotes(typeof raw?.Description === 'string' ? raw.Description : '');
    }
    setIsEditing(false);
  };

  const onSave = async () => {
    await update.mutateAsync({
      id,
      first_name: firstName,
      last_name: lastName,
      phone,
      email,
      rawUpdates: {
        Preferred_Contact_Method: preferredContactMethod || null,
        Description: additionalNotes || null,
      },
    });
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#d7b73f' }}>
            {displayName}
          </h1>
          <div className="mt-1 text-sm text-slate-300">Customer ID: {id}</div>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <GlobalSearch placeholder="Search…" className="w-full sm:w-[360px]" />
          <div className="flex gap-2">
            <button
              className="rounded-full bg-[#d7b73f] px-4 py-2 text-sm font-semibold text-black hover:bg-[#d7b73f]/90"
              onClick={() => (isEditing ? onCancel() : setIsEditing(true))}
              type="button"
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
            {isEditing ? (
              <button
                className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-50"
                onClick={onSave}
                type="button"
                disabled={update.isPending}
              >
                {update.isPending ? 'Saving…' : 'Save'}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {q.isLoading ? (
        <div className="text-sm text-slate-300">Loading…</div>
      ) : q.isError ? (
        <div className="text-sm text-red-200">Failed to load customer.</div>
      ) : !data ? (
        <div className="text-sm text-slate-300">Customer not found.</div>
      ) : (
        <>
          <div className="surface p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field
                label="First name"
                value={firstName}
                onChange={setFirstName}
                readOnly={!isEditing}
              />
              <Field
                label="Last name"
                value={lastName}
                onChange={setLastName}
                readOnly={!isEditing}
              />
              <Field label="Phone" value={phone} onChange={setPhone} readOnly={!isEditing} />
              <Field label="Email" value={email} onChange={setEmail} readOnly={!isEditing} />
              <Field
                label="Preferred contact method"
                value={preferredContactMethod}
                onChange={setPreferredContactMethod}
                readOnly={!isEditing}
              />
            </div>

            <div className="mt-4">
              <div className="text-xs font-medium" style={{ color: '#d7b73f' }}>
                Additional notes
              </div>
              <textarea
                className={
                  'mt-1 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-slate-100 outline-none ' +
                  (isEditing ? 'focus:border-[#d7b73f]/50' : 'opacity-90')
                }
                rows={6}
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                readOnly={!isEditing}
              />
            </div>

            <div className="mt-4">
              <div className="text-xs font-medium" style={{ color: '#d7b73f' }}>
                Vehicle(s)
              </div>
              {vehiclesQ.isLoading ? (
                <div className="mt-2 text-xs text-slate-400">Loading…</div>
              ) : vehiclesQ.isError ? (
                <div className="mt-2 text-xs text-slate-400">Failed to load vehicles.</div>
              ) : (vehiclesQ.data?.data || []).length === 0 ? (
                <div className="mt-2 text-xs text-slate-400">No vehicles found.</div>
              ) : (
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {(vehiclesQ.data?.data || []).map((v: Vehicle) => {
                    const title = [v.year, v.make, v.model].filter(Boolean).join(' ').trim();
                    return (
                      <Link
                        key={v.id}
                        href={`/vehicles/${encodeURIComponent(v.id)}`}
                        className="block rounded-xl border border-[#d7b73f]/30 bg-[#d7b73f]/10 p-3 hover:border-[#d7b73f]/50 hover:bg-[#d7b73f]/15"
                      >
                        <div className="text-sm font-semibold text-[#d7b73f]">{title || v.vin || v.id}</div>
                        <div className="mt-1 text-xs text-slate-200/90">
                          {v.vin ? `VIN: ${v.vin}` : null}
                          {v.license_plate ? (v.vin ? ` • Plate: ${v.license_plate}` : `Plate: ${v.license_plate}`) : null}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {update.isError ? (
              <div className="mt-3 text-xs text-red-200">Save failed.</div>
            ) : update.isSuccess ? (
              <div className="mt-3 text-xs text-slate-300">Saved.</div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
}) {
  return (
    <label className="block">
      <div className="text-xs font-medium" style={{ color: '#d7b73f' }}>
        {label}
      </div>
      <input
        className={
          'mt-1 w-full rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-slate-100 outline-none ' +
          (readOnly ? 'opacity-90' : 'focus:border-[#d7b73f]/60')
        }
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
      />
    </label>
  );
}
