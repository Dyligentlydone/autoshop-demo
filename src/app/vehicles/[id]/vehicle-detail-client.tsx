'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import GlobalSearch from '@/components/global-search';
import { useCustomer } from '@/hooks/use-customer';
import { useRepairOrdersByVehicle } from '@/hooks/use-repair-orders-by-vehicle';
import { useVehicle } from '@/hooks/use-vehicle';
import { useUpdateVehicle } from '@/hooks/use-update-vehicle';
import { useDeleteVehicle } from '@/hooks/use-delete-vehicle';

export default function VehicleDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const q = useVehicle(id, { full: true });
  const update = useUpdateVehicle();
  const deleteVehicle = useDeleteVehicle();

  const data = q.data?.data;
  const raw = q.data?.raw;

  const [isEditing, setIsEditing] = useState(false);
  const [year, setYear] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [vin, setVin] = useState('');
  const [plate, setPlate] = useState('');
  const [engineSize, setEngineSize] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [color, setColor] = useState('');
  const [note, setNote] = useState('');
  const [vehicleOwnerId, setVehicleOwnerId] = useState('');

  const ownerIdForDisplay = vehicleOwnerId || customerId;
  const ownerQ = useCustomer(ownerIdForDisplay);
  const repairOrdersQ = useRepairOrdersByVehicle(id);

  useEffect(() => {
    if (!data) return;
    setYear(data.year || '');
    setMake(data.make || '');
    setModel(data.model || '');
    setVin(data.vin || '');
    setPlate(data.license_plate || '');
    setEngineSize(data.engine_size || '');
    setCustomerId(data.customer_id || '');
    setColor(typeof raw?.Color === 'string' ? raw.Color : '');
    setNote(typeof raw?.Note === 'string' ? raw.Note : '');
    setVehicleOwnerId(
      raw?.Owner1 && typeof raw.Owner1 === 'object' && typeof raw.Owner1.id === 'string' ? raw.Owner1.id : '',
    );
  }, [data, raw]);

  const displayName = useMemo(() => {
    const name = [data?.year, data?.make, data?.model].filter(Boolean).join(' ').trim();
    return name || data?.vin || id;
  }, [data, id]);

  const onCancel = () => {
    if (data) {
      setYear(data.year || '');
      setMake(data.make || '');
      setModel(data.model || '');
      setVin(data.vin || '');
      setPlate(data.license_plate || '');
      setEngineSize(data.engine_size || '');
      setCustomerId(data.customer_id || '');
      setColor(typeof raw?.Color === 'string' ? raw.Color : '');
      setNote(typeof raw?.Note === 'string' ? raw.Note : '');
      setVehicleOwnerId(
        raw?.Owner1 && typeof raw.Owner1 === 'object' && typeof raw.Owner1.id === 'string' ? raw.Owner1.id : '',
      );
    }
    setIsEditing(false);
  };

  const onSave = async () => {
    await update.mutateAsync({
      id,
      year,
      make,
      model,
      vin,
      license_plate: plate,
      engine_size: engineSize,
      customer_id: customerId,
      rawUpdates: {
        Color: color || null,
        Note: note || null,
        Owner1: vehicleOwnerId ? { id: vehicleOwnerId } : null,
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
          <div className="mt-1 text-sm text-slate-300">Vehicle ID: {id}</div>
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
            <button
              className="rounded-full bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/25 disabled:opacity-50"
              type="button"
              disabled={deleteVehicle.isPending}
              onClick={async () => {
                if (!confirm('Delete this vehicle? This cannot be undone.')) return;
                await deleteVehicle.mutateAsync(id);
                router.push('/repair-orders');
              }}
            >
              {deleteVehicle.isPending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>

      {q.isLoading ? (
        <div className="text-sm text-slate-300">Loading…</div>
      ) : q.isError ? (
        <div className="text-sm text-red-200">Failed to load vehicle.</div>
      ) : !data ? (
        <div className="text-sm text-slate-300">Vehicle not found.</div>
      ) : (
        <>
          <div className="surface p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Year" value={year} onChange={setYear} readOnly={!isEditing} />
              <Field label="Make" value={make} onChange={setMake} readOnly={!isEditing} />
              <Field label="Model" value={model} onChange={setModel} readOnly={!isEditing} />
              <Field label="Engine size" value={engineSize} onChange={setEngineSize} readOnly={!isEditing} />
              <Field label="VIN" value={vin} onChange={setVin} readOnly={!isEditing} />
              <Field label="License plate" value={plate} onChange={setPlate} readOnly={!isEditing} />
              <Field label="Color" value={color} onChange={setColor} readOnly={!isEditing} />
            </div>

            <div className="mt-4">
              <div className="text-xs font-medium" style={{ color: '#d7b73f' }}>
                Note
              </div>
              <textarea
                className={
                  'mt-1 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-slate-100 outline-none ' +
                  (isEditing ? 'focus:border-[#d7b73f]/50' : 'opacity-90')
                }
                rows={6}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                readOnly={!isEditing}
              />
            </div>

            {ownerIdForDisplay ? (
              <div className="mt-4">
                <div className="text-xs font-medium" style={{ color: '#d7b73f' }}>
                  Vehicle owner
                </div>
                {ownerQ.isLoading ? (
                  <div className="mt-2 text-xs text-slate-400">Loading…</div>
                ) : ownerQ.isError || !ownerQ.data?.data ? (
                  <div className="mt-2 text-xs text-slate-400">Owner not found.</div>
                ) : (
                  <Link
                    href={`/customers/${encodeURIComponent(ownerQ.data.data.id)}`}
                    className="mt-2 block rounded-xl border border-[#d7b73f]/30 bg-[#d7b73f]/10 p-3 hover:border-[#d7b73f]/50 hover:bg-[#d7b73f]/15"
                  >
                    <div className="text-sm font-semibold text-[#d7b73f]">
                      {`${ownerQ.data.data.first_name || ''} ${ownerQ.data.data.last_name || ''}`.trim() ||
                        ownerQ.data.data.phone ||
                        ownerQ.data.data.id}
                    </div>
                    {ownerQ.data.data.phone ? (
                      <div className="mt-1 text-xs text-slate-200/90">{ownerQ.data.data.phone}</div>
                    ) : null}
                  </Link>
                )}
              </div>
            ) : null}

            <div className="mt-4">
              <div className="text-xs font-medium" style={{ color: '#d7b73f' }}>
                Vehicle repair(s)
              </div>
              {repairOrdersQ.isLoading ? (
                <div className="mt-2 text-xs text-slate-400">Loading…</div>
              ) : repairOrdersQ.isError ? (
                <div className="mt-2 text-xs text-slate-400">Failed to load repair orders.</div>
              ) : (repairOrdersQ.data?.data || []).length === 0 ? (
                <div className="mt-2 text-xs text-slate-400">No repair orders found.</div>
              ) : (
                <div className="mt-2 space-y-2">
                  {(repairOrdersQ.data?.data || []).map((ro) => (
                    <Link
                      key={ro.id}
                      href={`/repair-orders/${encodeURIComponent(ro.id)}`}
                      className="block rounded-xl border border-[#d7b73f]/30 bg-[#d7b73f]/10 p-3 hover:border-[#d7b73f]/50 hover:bg-[#d7b73f]/15"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-[#d7b73f]">{ro.service_type || ro.id}</div>
                        <div className="text-xs text-slate-300">{ro.status}</div>
                      </div>
                      {ro.estimated_completion ? (
                        <div className="mt-1 text-xs text-slate-300">Estimated completion: {ro.estimated_completion}</div>
                      ) : null}
                    </Link>
                  ))}
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
