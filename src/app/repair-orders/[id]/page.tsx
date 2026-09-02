 'use client';

import { use, useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import type { RepairOrderStatus } from '@/types';
import { useRepairOrder } from '@/hooks/use-repair-order';
import { useVehicle } from '@/hooks/use-vehicle';
import { useCustomer } from '@/hooks/use-customer';
import { useUpdateVehicle } from '@/hooks/use-update-vehicle';
import { useUpdateRepairOrder } from '@/hooks/use-update-repair-order';
import { useCheckInVin } from '@/hooks/use-check-in-vin';
import { useRepairOrderAttachments } from '@/hooks/use-repair-order-attachments';
import { useUploadAttachment } from '@/hooks/use-upload-attachment';
import { useDeleteAttachment } from '@/hooks/use-delete-attachment';
import { useDeleteRepairOrder } from '@/hooks/use-delete-repair-order';
import { DateTimePicker } from '@/components/DateTimePicker';
import SendEstimateModal from '@/components/SendEstimateModal';
import ApprovalAuditTrail from '@/components/ApprovalAuditTrail';

const isoToDatetimeLocal = (iso: string) => {
  if (!iso) return '';
  // Handle date-only format (YYYY-MM-DD) by appending midnight time
  const dateStr = iso.includes('T') ? iso : `${iso}T00:00:00`;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
};

const datetimeLocalToIso = (value: string) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
};

const STATUS_OPTIONS: RepairOrderStatus[] = [
  'Scheduled',
  'Dropped Off',
  'Diagnosing',
  'Waiting Approval',
  'Repair Approved',
  'Awaiting Parts',
  'In Progress',
  'Ready For Pickup',
  'Completed',
];

const getStatusOptions = (current: RepairOrderStatus) => {
  if (current === 'New') return ['New', ...STATUS_OPTIONS];
  return STATUS_OPTIONS;
};

const REPAIR_ORDERS_MODULE = 'Repair_Orders';

export default function RepairOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading, isError, error } = useRepairOrder(id);
  const update = useUpdateRepairOrder();
  const deleteRepairOrder = useDeleteRepairOrder();
  const checkInVin = useCheckInVin();
  const vehicleQ = useVehicle(data?.vehicle_id || '');
  const customerQ = useCustomer(data?.customer_id || '');
  const updateVehicle = useUpdateVehicle();
  
  const attachments = useRepairOrderAttachments(id);
  const uploadAttachment = useUploadAttachment(id);
  const deleteAttachment = useDeleteAttachment(id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showSendEstimate, setShowSendEstimate] = useState(false);

  const [status, setStatus] = useState<RepairOrderStatus>('New');
  const [serviceType, setServiceType] = useState<string>('');
  const [jobDescription, setJobDescription] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [estimatedTotal, setEstimatedTotal] = useState<string>('');
  const [finalChargeTotal, setFinalChargeTotal] = useState<string>('');
  const [estimatedCompletion, setEstimatedCompletion] = useState(
    isoToDatetimeLocal(data?.estimated_completion || '')
  );
  const [scheduledDropOff, setScheduledDropOff] = useState(
    isoToDatetimeLocal(data?.scheduled_drop_off || '')
  );
  const [vin, setVin] = useState<string>('');
  const [licensePlate, setLicensePlate] = useState<string>('');

  useEffect(() => {
    if (data) {
      setStatus(data.status);
      setServiceType(data.service_type || '');
      setJobDescription(data.job_description || '');
      setNote(data.note || '');
      setEstimatedTotal(data.estimated_total !== undefined ? String(data.estimated_total) : '');
      setFinalChargeTotal(data.final_charge_total !== undefined ? String(data.final_charge_total) : '');
      setEstimatedCompletion(isoToDatetimeLocal(data.estimated_completion || ''));
      setScheduledDropOff(isoToDatetimeLocal(data.scheduled_drop_off || ''));
    }
  }, [data]);

  const vehicleVin = vehicleQ.data?.data?.vin || '';
  const vehicleLicensePlate = vehicleQ.data?.data?.license_plate || '';

  useEffect(() => {
    if (isEditing) return;
    setVin(vehicleVin);
    setLicensePlate(vehicleLicensePlate);
  }, [isEditing, vehicleLicensePlate, vehicleVin]);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        await uploadAttachment.mutateAsync(file);
      } catch (err) {
        console.error('Failed to upload file:', err);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return;
    try {
      await deleteAttachment.mutateAsync(attachmentId);
    } catch (err) {
      console.error('Failed to delete attachment:', err);
    }
  };

  const onCancel = () => {
    if (data) {
      setStatus(data.status);
      setServiceType(data.service_type || '');
      setJobDescription(data.job_description || '');
      setNote(data.note || '');
      setEstimatedTotal(data.estimated_total !== undefined ? String(data.estimated_total) : '');
      setFinalChargeTotal(data.final_charge_total !== undefined ? String(data.final_charge_total) : '');
      setEstimatedCompletion(isoToDatetimeLocal(data.estimated_completion || ''));
    }
    setVin(vehicleVin);
    setLicensePlate(vehicleLicensePlate);
    setIsEditing(false);
  };

  const onSave = async () => {
    const nextVin = vin.trim();
    const didChangeVin = nextVin !== (vehicleVin || '');

    const nextPlate = licensePlate.trim();
    const didChangePlate = nextPlate !== (vehicleLicensePlate || '');

    if (didChangeVin) {
      if (!nextVin) {
        throw new Error('VIN is required');
      }
      await checkInVin.mutateAsync({ repair_order_id: id, vin: nextVin });
    }

    if (didChangePlate) {
      if (data?.vehicle_id) {
        await updateVehicle.mutateAsync({
          id: data.vehicle_id,
          license_plate: nextPlate || undefined,
        });
      }
    }

    await update.mutateAsync({
      id,
      status,
      service_type: serviceType,
      job_description: jobDescription,
      note,
      estimated_total: estimatedTotal.trim()
        ? Number.isFinite(Number(estimatedTotal))
          ? Number(estimatedTotal)
          : undefined
        : undefined,
      final_charge_total: finalChargeTotal.trim()
        ? Number.isFinite(Number(finalChargeTotal))
          ? Number(finalChargeTotal)
          : undefined
        : undefined,
      estimated_completion: datetimeLocalToIso(estimatedCompletion) || undefined,
      scheduled_drop_off: datetimeLocalToIso(scheduledDropOff) || undefined,
    });
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (!confirm('Are you sure you want to delete this repair order? This action cannot be undone.')) {
      return;
    }
    deleteRepairOrder.mutate(id);
  };

  const canSave = useMemo(() => {
    if (!data) return false;
    const nextVin = vin.trim();
    const didChangeVin = nextVin !== (vehicleVin || '');

    const nextPlate = licensePlate.trim();
    const didChangePlate = nextPlate !== (vehicleLicensePlate || '');
    return (
      status !== data.status ||
      (serviceType || '') !== (data.service_type || '') ||
      (jobDescription || '') !== (data.job_description || '') ||
      (note || '') !== (data.note || '') ||
      (estimatedTotal.trim() ? Number(estimatedTotal) : undefined) !== data.estimated_total ||
      (finalChargeTotal.trim() ? Number(finalChargeTotal) : undefined) !== data.final_charge_total ||
      datetimeLocalToIso(estimatedCompletion) !== (data.estimated_completion || '') ||
      scheduledDropOff !== (data.scheduled_drop_off || '') ||
      (didChangeVin && Boolean(nextVin)) ||
      didChangePlate
    );
  }, [
    data,
    estimatedCompletion,
    estimatedTotal,
    finalChargeTotal,
    jobDescription,
    licensePlate,
    note,
    scheduledDropOff,
    serviceType,
    status,
    vehicleLicensePlate,
    vehicleVin,
    vin,
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: '#d7b73f' }}>
              Repair Order
            </h1>
            <div className="mt-1 text-sm text-slate-300">ID: {id}</div>
          </div>
          <button
            className="rounded-full border border-red-900/30 bg-red-950/20 px-4 py-2 text-sm font-semibold text-red-400/90 hover:border-red-900/50 hover:bg-red-950/30 hover:text-red-300 disabled:opacity-50 transition-all"
            onClick={handleDelete}
            type="button"
            disabled={!data || deleteRepairOrder.isPending}
          >
            {deleteRepairOrder.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex gap-2">
            {!isEditing && customerQ.data?.data?.phone && (
              <button
                className="rounded-full border border-[#d7b73f]/30 bg-[#d7b73f]/10 px-4 py-2 text-sm font-semibold text-[#d7b73f] hover:border-[#d7b73f]/50 hover:bg-[#d7b73f]/20"
                onClick={() => setShowSendEstimate(true)}
                type="button"
                disabled={!data}
              >
                📱 Send Estimate
              </button>
            )}
            <button
              className="rounded-full bg-[#d7b73f] px-4 py-2 text-sm font-semibold text-black hover:bg-[#d7b73f]/90"
              onClick={() => (isEditing ? onCancel() : setIsEditing(true))}
              type="button"
              disabled={!data}
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
            {isEditing ? (
              <button
                className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-50"
                onClick={onSave}
                type="button"
                disabled={!canSave || update.isPending}
              >
                {update.isPending ? 'Saving…' : 'Save'}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-300">Loading…</div>
      ) : isError ? (
        <div className="text-sm text-red-200">{(error as any)?.message || 'Failed to load repair order.'}</div>
      ) : !data ? (
        <div className="text-sm text-slate-300">Repair order not found.</div>
      ) : (
        <div className="surface p-6 space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs font-medium" style={{ color: '#d7b73f' }}>
                Status
              </div>
              <select
                className="mt-1 w-full rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-slate-100 outline-none disabled:opacity-50"
                value={status}
                onChange={(e) => setStatus(e.target.value as RepairOrderStatus)}
                disabled={!isEditing}
              >
                {getStatusOptions(status).map((s) => (
                  <option key={s} value={s} disabled={s === 'New'}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs font-medium" style={{ color: '#d7b73f' }}>
                Service type
              </div>
              <input
                className="mt-1 w-full rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-slate-100 outline-none disabled:opacity-50"
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                readOnly={!isEditing}
              />
              <div className="mt-1 text-xs text-slate-400">Vehicle ID: {data.vehicle_id}</div>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium" style={{ color: '#d7b73f' }}>
              Job description
            </div>
            <textarea
              className={
                'mt-1 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-slate-100 outline-none ' +
                (isEditing ? 'focus:border-[#d7b73f]/50' : 'opacity-90')
              }
              rows={6}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              readOnly={!isEditing}
            />
          </div>

          <div>
            <div className="text-xs font-medium" style={{ color: '#d7b73f' }}>
              Note
            </div>
            <textarea
              className={
                'mt-1 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-slate-100 outline-none ' +
                (isEditing ? 'focus:border-[#d7b73f]/50' : 'opacity-90')
              }
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              readOnly={!isEditing}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs font-medium" style={{ color: '#d7b73f' }}>
                Estimated Total
              </div>
              <input
                className="mt-1 w-full rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-slate-100 outline-none disabled:opacity-50"
                type="number"
                step="0.01"
                min="0"
                value={estimatedTotal}
                onChange={(e) => setEstimatedTotal(e.target.value)}
                readOnly={!isEditing}
              />
            </div>
            <div>
              <div className="text-xs font-medium" style={{ color: '#d7b73f' }}>
                Final Charge Total
              </div>
              <input
                className="mt-1 w-full rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-slate-100 outline-none disabled:opacity-50"
                type="number"
                step="0.01"
                min="0"
                value={finalChargeTotal}
                onChange={(e) => setFinalChargeTotal(e.target.value)}
                readOnly={!isEditing}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <DateTimePicker
              label="Scheduled Drop Off"
              value={scheduledDropOff}
              onChange={setScheduledDropOff}
              disabled={!isEditing}
            />
            <DateTimePicker
              label="Estimated Completion"
              value={estimatedCompletion}
              onChange={setEstimatedCompletion}
              disabled={!isEditing}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs font-medium" style={{ color: '#d7b73f' }}>
                VIN
              </div>
              <input
                className="mt-1 w-full rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-slate-100 outline-none disabled:opacity-50"
                value={vin}
                onChange={(e) => setVin(e.target.value)}
                readOnly={!isEditing}
                placeholder={vehicleQ.isLoading ? 'Loading…' : '—'}
              />
              {checkInVin.isError ? <div className="mt-2 text-sm text-red-200">Failed to save VIN</div> : null}
            </div>
            <div>
              <div className="text-xs font-medium" style={{ color: '#d7b73f' }}>
                License plate
              </div>
              <input
                className="mt-1 w-full rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-slate-100 outline-none disabled:opacity-50"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
                readOnly={!isEditing}
                placeholder={vehicleQ.isLoading ? 'Loading…' : '—'}
              />
            </div>
          </div>

          <div className="border-t border-white/10 pt-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium" style={{ color: '#d7b73f' }}>
                Photos &amp; Videos
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-full bg-[#d7b73f]/10 px-4 py-2 text-xs font-semibold hover:bg-[#d7b73f]/20"
                  style={{ color: '#d7b73f' }}
                  disabled={uploadAttachment.isPending}
                >
                  {uploadAttachment.isPending ? 'Uploading...' : 'Add Photos'}
                </button>
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="rounded-full bg-[#d7b73f]/10 px-4 py-2 text-xs font-semibold hover:bg-[#d7b73f]/20"
                  style={{ color: '#d7b73f' }}
                  disabled={uploadAttachment.isPending}
                >
                  {uploadAttachment.isPending ? 'Uploading...' : 'Add Videos'}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />
            </div>

            <div
              className={`rounded-xl border-2 border-dashed p-6 transition-colors ${
                isDragging
                  ? 'border-[#d7b73f] bg-[#d7b73f]/5'
                  : 'border-white/10 bg-black/20'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              {attachments.isLoading ? (
                <div className="text-center text-sm text-slate-300">Loading photos...</div>
              ) : attachments.isError ? (
                <div className="text-center text-sm text-red-200">Failed to load photos</div>
              ) : !attachments.data?.data || attachments.data.data.length === 0 ? (
                <div className="text-center">
                  <p className="text-sm text-slate-300">No photos yet</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Drag and drop photos here or click "Add Photos"
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                  {attachments.data.data.map((attachment: any) => {
                    const mime = attachment.mime_type || attachment.Mime_Type || '';
                    const isVideo = mime.startsWith('video/');
                    const src = `/api/crm/repair-orders/${id}/attachments/${attachment.id}/download`;
                    return (
                    <div
                      key={attachment.id}
                      className="group relative overflow-hidden rounded-lg border border-white/10 bg-black/30"
                    >
                      <div className="aspect-square bg-black">
                        {isVideo ? (
                          <video
                            src={src}
                            className="h-full w-full object-cover"
                            controls
                            preload="metadata"
                          />
                        ) : (
                          <img
                            src={src}
                            alt={attachment.File_Name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        )}
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                        <a
                          href={`/api/crm/repair-orders/${id}/attachments/${attachment.id}/download`}
                          download={attachment.File_Name}
                          className="rounded-full bg-[#D4AF37]/80 px-3 py-1 text-xs font-semibold text-black hover:bg-[#D4AF37]"
                        >
                          Download
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeleteAttachment(attachment.id)}
                          className="rounded-full bg-red-500/80 px-3 py-1 text-xs font-semibold text-white hover:bg-red-500"
                          disabled={deleteAttachment.isPending}
                        >
                          Delete
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                        <p className="truncate text-xs text-white">{attachment.File_Name}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(attachment.Created_Time).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>

            {uploadAttachment.isError ? (
              <div className="mt-2 text-sm text-red-200">
                Failed to upload photo. Please try again.
              </div>
            ) : null}
          </div>

          {/* Vehicle Information */}
          {data.vehicle_id && (
            <div className="space-y-2 rounded-lg border border-white/10 bg-white/3 p-3 backdrop-blur">
              <div className="text-xs font-medium text-slate-300">Vehicle</div>
              {vehicleQ.isLoading ? (
                <div className="text-xs text-slate-400">Loading vehicle info...</div>
              ) : vehicleQ.isError || !vehicleQ.data?.data ? (
                <div className="text-xs text-slate-400">Vehicle not found</div>
              ) : (
                <Link
                  href={`/vehicles/${encodeURIComponent(data.vehicle_id)}`}
                  className="block rounded-xl border border-[#d7b73f]/30 bg-[#d7b73f]/10 p-3 hover:border-[#d7b73f]/50 hover:bg-[#d7b73f]/15"
                >
                  <div className="text-sm font-semibold text-[#d7b73f]">
                    {[vehicleQ.data.data.year, vehicleQ.data.data.make, vehicleQ.data.data.model]
                      .filter(Boolean)
                      .join(' ')
                      .trim() || vehicleQ.data.data.vin || data.vehicle_id}
                  </div>
                  <div className="mt-1 text-xs text-slate-200/90">
                    {vehicleQ.data.data.vin ? `VIN: ${vehicleQ.data.data.vin}` : null}
                    {vehicleQ.data.data.license_plate
                      ? (vehicleQ.data.data.vin ? ` • ` : '') + `Plate: ${vehicleQ.data.data.license_plate}`
                      : null}
                  </div>
                </Link>
              )}
            </div>
          )}

          {/* Customer Information */}
          {data.customer_id && (
            <div className="space-y-2 rounded-lg border border-white/10 bg-white/3 p-3 backdrop-blur">
              <div className="text-xs font-medium text-slate-300">Customer</div>
              {customerQ.isLoading ? (
                <div className="text-xs text-slate-400">Loading customer info...</div>
              ) : customerQ.isError || !customerQ.data?.data ? (
                <div className="text-xs text-slate-400">Customer not found</div>
              ) : (
                <Link
                  href={`/customers/${encodeURIComponent(data.customer_id)}`}
                  className="block rounded-xl border border-[#d7b73f]/30 bg-[#d7b73f]/10 p-3 hover:border-[#d7b73f]/50 hover:bg-[#d7b73f]/15"
                >
                  <div className="text-sm font-semibold text-[#d7b73f]">
                    {`${customerQ.data.data.first_name || ''} ${customerQ.data.data.last_name || ''}`
                      .trim() || customerQ.data.data.phone || data.customer_id}
                  </div>
                  {customerQ.data.data.phone && (
                    <div className="mt-1 text-xs text-slate-200/90">{customerQ.data.data.phone}</div>
                  )}
                  {customerQ.data.data.email && (
                    <div className="mt-1 text-xs text-slate-200/90">{customerQ.data.data.email}</div>
                  )}
                </Link>
              )}
            </div>
          )}

          <ApprovalAuditTrail repairOrderId={id} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <a className="text-sm font-medium text-slate-300 hover:text-white" href="/repair-orders">
              Back to list
            </a>
            <div className="flex items-center gap-3">
              {update.isError ? <div className="text-sm text-red-200">Failed to save</div> : null}
              {update.isSuccess ? <div className="text-sm text-slate-300">Saved</div> : null}
            </div>
          </div>
        </div>
      )}

      {/* Send Estimate Modal */}
      {data && customerQ.data?.data ? (
        <SendEstimateModal
          isOpen={showSendEstimate}
          onClose={() => setShowSendEstimate(false)}
          repairOrder={{
            id: data.id,
            service_type: data.service_type || '',
            estimated_total: data.estimated_total,
            estimated_completion: data.estimated_completion,
          }}
          customer={{
            id: customerQ.data.data.id,
            first_name: customerQ.data.data.first_name || '',
            last_name: customerQ.data.data.last_name || '',
            phone: customerQ.data.data.phone || '',
          }}
          photoUrls={
            Array.isArray(attachments.data?.data)
              ? attachments.data.data
                  .filter((a: any) => {
                    const mime = a.mime_type || a.Mime_Type || '';
                    return !mime || mime.startsWith('image/');
                  })
                  .map((a: any) => `/api/crm/repair-orders/${data.id}/attachments/${a.id}/download`)
              : []
          }
          videoUrls={
            Array.isArray(attachments.data?.data)
              ? attachments.data.data
                  .filter((a: any) => {
                    const mime = a.mime_type || a.Mime_Type || '';
                    return mime.startsWith('video/');
                  })
                  .map((a: any) => `/api/crm/repair-orders/${data.id}/attachments/${a.id}/download`)
              : []
          }
        />
      ) : null}
    </div>
  );
}
