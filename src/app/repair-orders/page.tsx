 'use client';

import { useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import type { ActiveRepairOrderItem, RepairOrderStatus } from '@/types';
import { useRepairOrdersEnriched } from '@/hooks/use-repair-orders-enriched';
import { useUpdateRepairOrder } from '@/hooks/use-update-repair-order';
import { useCheckInVin } from '@/hooks/use-check-in-vin';
import { useUpdateVehicle } from '@/hooks/use-update-vehicle';
import { useRepairOrderAttachments } from '@/hooks/use-repair-order-attachments';
import { useUploadAttachment } from '@/hooks/use-upload-attachment';
import { useDeleteAttachment } from '@/hooks/use-delete-attachment';
import { useDeleteRepairOrder } from '@/hooks/use-delete-repair-order';
import GlobalSearch from '@/components/global-search';
import OfflineBanner from '@/components/OfflineBanner';
import { useFailedBookings } from '@/hooks/use-failed-bookings';
import { apiClient } from '@/lib/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { DateTimePicker } from '@/components/DateTimePicker';
import SendEstimateModal from '@/components/SendEstimateModal';

const isoToDatetimeLocal = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
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

const STATUS_OPTIONS: Array<RepairOrderStatus | 'All'> = [
  'All',
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

const RO_STATUS_OPTIONS: RepairOrderStatus[] = [
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

const getRoStatusOptions = (current: RepairOrderStatus) => {
  if (current === 'New') return ['New', ...RO_STATUS_OPTIONS];
  return RO_STATUS_OPTIONS;
};

const REPAIR_ORDERS_MODULE = 'Repair_Orders';

const RepairOrderRow = ({
  item,
  formatVehicleDisplay,
}: {
  item: ActiveRepairOrderItem;
  formatVehicleDisplay: (vehicle: ActiveRepairOrderItem['vehicle']) => string;
}) => {
  const update = useUpdateRepairOrder();
  const deleteRepairOrder = useDeleteRepairOrder();
  const checkInVin = useCheckInVin();
  const updateVehicle = useUpdateVehicle();
  
  const [expanded, setExpanded] = useState(false);
  const [showSendEstimate, setShowSendEstimate] = useState(false);

  const attachments = useRepairOrderAttachments(item.repairOrder.id, expanded || showSendEstimate);
  const uploadAttachment = useUploadAttachment(item.repairOrder.id);
  const deleteAttachment = useDeleteAttachment(item.repairOrder.id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [showPhotos, setShowPhotos] = useState(false);
  const [status, setStatus] = useState<RepairOrderStatus>(item.repairOrder.status);
  const [serviceType, setServiceType] = useState(item.repairOrder.service_type || '');
  const [jobDescription, setJobDescription] = useState(item.repairOrder.job_description || '');
  const [note, setNote] = useState(item.repairOrder.note || '');
  const [estimatedTotal, setEstimatedTotal] = useState(
    item.repairOrder.estimated_total !== undefined ? String(item.repairOrder.estimated_total) : ''
  );
  const [finalChargeTotal, setFinalChargeTotal] = useState(
    item.repairOrder.final_charge_total !== undefined ? String(item.repairOrder.final_charge_total) : ''
  );
  const [estimatedCompletion, setEstimatedCompletion] = useState(
    isoToDatetimeLocal(item.repairOrder.estimated_completion || '')
  );
  const [scheduledDropOff, setScheduledDropOff] = useState(
    isoToDatetimeLocal(item.repairOrder.scheduled_drop_off || '')
  );
  const [vin, setVin] = useState(item.vehicle?.vin || '');
  const [licensePlate, setLicensePlate] = useState(item.vehicle?.license_plate || '');

  const customerName = item.customer
    ? `${item.customer.first_name} ${item.customer.last_name}`.trim()
    : '';

  const vehicleDisplay = formatVehicleDisplay(item.vehicle);
  const vehicleVin = item.vehicle?.vin ? `VIN: ${item.vehicle.vin}` : 'VIN: —';
  const vehiclePlate = item.vehicle?.license_plate ? `Plate: ${item.vehicle.license_plate}` : 'Plate: —';

  const didChangeVin = vin.trim() !== (item.vehicle?.vin || '');
  const didChangePlate = licensePlate.trim() !== (item.vehicle?.license_plate || '');

  const canSave =
    status !== item.repairOrder.status ||
    (serviceType || '') !== (item.repairOrder.service_type || '') ||
    (jobDescription || '') !== (item.repairOrder.job_description || '') ||
    (note || '') !== (item.repairOrder.note || '') ||
    (estimatedTotal.trim() ? Number(estimatedTotal) : undefined) !== item.repairOrder.estimated_total ||
    (finalChargeTotal.trim() ? Number(finalChargeTotal) : undefined) !== item.repairOrder.final_charge_total ||
    datetimeLocalToIso(estimatedCompletion) !== (item.repairOrder.estimated_completion || '') ||
    scheduledDropOff !== (item.repairOrder.scheduled_drop_off || '') ||
    (didChangeVin && Boolean(vin.trim())) ||
    didChangePlate;

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

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return;
    try {
      await deleteAttachment.mutateAsync(attachmentId);
    } catch (err) {
      console.error('Failed to delete attachment:', err);
    }
  };

  return (
    <div className="px-3 py-3 lg:px-4">
      <div className="grid grid-cols-12 gap-2 text-sm lg:gap-3">
        <div className="col-span-2 min-w-0">
          <div className="relative">
            <select
              className={`w-full appearance-none rounded-full px-2 py-1.5 pr-7 text-xs font-medium ring-1 ring-inset focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 lg:px-3 lg:py-2 lg:pr-8 ${statusBadgeClasses(
                status
              )}`}
              value={status}
              disabled={update.isPending}
              onChange={(e) => {
                const next = e.target.value as RepairOrderStatus;
                setStatus(next);
                update.mutate({ id: item.repairOrder.id, status: next });
              }}
            >
              {getRoStatusOptions(status).map((s) => (
                <option key={s} value={s} disabled={s === 'New'}>
                  {s}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 opacity-80"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          {update.isPending ? (
            <div className="mt-1 text-xs text-slate-400">Saving…</div>
          ) : update.isError ? (
            <div className="mt-1 text-xs text-red-400">Save failed</div>
          ) : null}
        </div>
        <div className="col-span-3 min-w-0">
          {item.vehicle?.id ? (
            <Link href={`/vehicles/${encodeURIComponent(item.vehicle.id)}`} className="block min-w-0 hover:opacity-95">
              <div className="truncate font-medium text-slate-100">{vehicleDisplay || 'Unknown vehicle'}</div>
              <div className="truncate text-xs text-slate-400">
                {vehicleVin} {' · '} {vehiclePlate}
              </div>
            </Link>
          ) : (
            <>
              <div className="truncate font-medium text-slate-100">{vehicleDisplay || 'Unknown vehicle'}</div>
              <div className="truncate text-xs text-slate-400">
                {vehicleVin} {' · '} {vehiclePlate}
              </div>
            </>
          )}
        </div>
        <div className="col-span-2 min-w-0">
          {item.customer?.id ? (
            <Link href={`/customers/${encodeURIComponent(item.customer.id)}`} className="block min-w-0 hover:opacity-95">
              <div className="truncate font-medium text-slate-100">{customerName || 'Unknown customer'}</div>
              <div className="truncate text-xs text-slate-400">{item.customer?.phone || ''}</div>
            </Link>
          ) : (
            <>
              <div className="truncate font-medium text-slate-100">{customerName || 'Unknown customer'}</div>
              <div className="truncate text-xs text-slate-400">{item.customer?.phone || ''}</div>
            </>
          )}
        </div>
        <div className="col-span-2 min-w-0 truncate">{item.repairOrder.service_type || '—'}</div>
        <div className="col-span-3 flex min-w-0 items-center justify-end gap-1 lg:gap-2">
          {item.customer?.phone && (
            <button
              className="shrink-0 rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/15 px-2 py-1 text-xs font-semibold text-[#F6E7B7] backdrop-blur hover:bg-[#D4AF37]/22 active:bg-[#D4AF37]/28 lg:px-3 lg:py-1.5 lg:text-sm"
              onClick={() => setShowSendEstimate(true)}
              title="Send estimate via SMS"
            >
              📱
            </button>
          )}
          <Link
            href={`/repair-orders/${item.repairOrder.id}/estimate`}
            className="shrink-0 rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/15 px-2.5 py-1 text-xs font-semibold text-[#F6E7B7] backdrop-blur hover:bg-[#D4AF37]/22 active:bg-[#D4AF37]/28 lg:px-4 lg:py-1.5 lg:text-sm"
          >
            <span className="hidden lg:inline">Estimate</span>
            <span className="lg:hidden">Est</span>
          </Link>
          <button
            className="shrink-0 rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/15 px-2.5 py-1 text-xs font-semibold text-[#F6E7B7] backdrop-blur hover:bg-[#D4AF37]/22 active:bg-[#D4AF37]/28 lg:px-4 lg:py-1.5 lg:text-sm"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Close' : 'Open'}
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-4 space-y-4 rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs font-medium text-slate-300">Status</div>
              <div className="relative mt-1">
                <select
                  className={`w-full appearance-none rounded-full px-4 py-2 pr-9 text-sm font-medium ring-1 ring-inset focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 ${statusBadgeClasses(
                    status
                  )}`}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as RepairOrderStatus)}
                >
                  {getRoStatusOptions(status).map((s) => (
                    <option key={s} value={s} disabled={s === 'New'}>
                      {s}
                    </option>
                  ))}
                </select>
                <svg
                  className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 opacity-80"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-300">Service type</div>
              <div className="mt-1 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-2 backdrop-blur">
                <input
                  className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none"
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-300">Job description</div>
            <div className="mt-1 rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-3 backdrop-blur">
              <textarea
                className="w-full resize-none bg-transparent text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none"
                rows={3}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-300">Note</div>
            <div className="mt-1 rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-3 backdrop-blur">
              <textarea
                className="w-full resize-none bg-transparent text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs font-medium text-slate-300">Estimated Total</div>
              <div className="mt-1 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-2 backdrop-blur">
                <input
                  className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none"
                  type="number"
                  step="0.01"
                  min="0"
                  value={estimatedTotal}
                  onChange={(e) => setEstimatedTotal(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-300">Final Charge Total</div>
              <div className="mt-1 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-2 backdrop-blur">
                <input
                  className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none"
                  type="number"
                  step="0.01"
                  min="0"
                  value={finalChargeTotal}
                  onChange={(e) => setFinalChargeTotal(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <DateTimePicker
              label="Scheduled Drop Off"
              value={scheduledDropOff}
              onChange={setScheduledDropOff}
            />
            <DateTimePicker
              label="Estimated Completion"
              value={estimatedCompletion}
              onChange={setEstimatedCompletion}
            />
          </div>

          <div className="space-y-2 rounded-lg border border-white/10 bg-white/3 p-3 backdrop-blur">
            <div className="text-xs font-medium text-slate-300">VIN / License plate</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-slate-300">VIN</div>
                  <div className="mt-1 w-full rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-2 backdrop-blur">
                    <input
                      className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none"
                      value={vin}
                      onChange={(e) => setVin(e.target.value)}
                      placeholder="Enter VIN"
                    />
                  </div>
                </div>
                <button
                  className="rounded-full bg-[#D4AF37] px-5 py-2 text-sm font-semibold text-black hover:bg-[#C9A534] disabled:opacity-40"
                  disabled={!vin.trim() || checkInVin.isPending}
                  onClick={() => {
                    const nextVin = vin.trim();
                    checkInVin.mutate(
                      { repair_order_id: item.repairOrder.id, vin: nextVin },
                      {
                        onSuccess: (data) => {
                          setVin(data.vehicle.vin || nextVin);
                          setLicensePlate(data.vehicle.license_plate || licensePlate);
                        },
                      }
                    );
                  }}
                >
                  {checkInVin.isPending ? 'Saving…' : 'Save VIN'}
                </button>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-slate-300">License plate</div>
                  <div className="mt-1 w-full rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-2 backdrop-blur">
                    <input
                      className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none"
                      value={licensePlate}
                      onChange={(e) => setLicensePlate(e.target.value)}
                      placeholder="Enter plate"
                    />
                  </div>
                </div>
                <button
                  className="rounded-full bg-[#D4AF37] px-5 py-2 text-sm font-semibold text-black hover:bg-[#C9A534] disabled:opacity-40"
                  disabled={!item.vehicle?.id || updateVehicle.isPending}
                  onClick={() =>
                    updateVehicle.mutate(
                      { id: item.vehicle!.id, license_plate: licensePlate.trim() || undefined },
                      {
                        onSuccess: (data) => {
                          setLicensePlate(data.data.license_plate || '');
                        },
                      }
                    )
                  }
                >
                  {updateVehicle.isPending ? 'Saving…' : 'Save plate'}
                </button>
              </div>
            </div>

            {checkInVin.isError ? <div className="text-sm text-red-400">Failed to save VIN</div> : null}
            {checkInVin.isSuccess ? (
              <div className="text-sm text-emerald-400">
                {checkInVin.data.action === 'linked_existing_vehicle'
                  ? 'VIN matched an existing vehicle. Repair order linked.'
                  : 'VIN saved to vehicle.'}
              </div>
            ) : null}
            {updateVehicle.isError ? <div className="text-sm text-red-400">Failed to save plate</div> : null}
            {updateVehicle.isSuccess ? <div className="text-sm text-emerald-400">Plate saved</div> : null}
          </div>

          <div className="space-y-2 rounded-lg border border-white/10 bg-white/3 p-3 backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-slate-300">Photos</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-full bg-[#D4AF37]/10 px-3 py-1.5 text-xs font-semibold hover:bg-[#D4AF37]/20"
                  style={{ color: '#d7b73f' }}
                  disabled={uploadAttachment.isPending}
                >
                  {uploadAttachment.isPending ? 'Uploading...' : '+ Add Photos'}
                </button>
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="rounded-full bg-[#D4AF37]/10 px-3 py-1.5 text-xs font-semibold hover:bg-[#D4AF37]/20"
                  style={{ color: '#d7b73f' }}
                  disabled={uploadAttachment.isPending}
                >
                  {uploadAttachment.isPending ? 'Uploading...' : '+ Add Videos'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPhotos(!showPhotos)}
                  className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10"
                >
                  {showPhotos ? 'Hide' : 'Show'} ({attachments.data?.data?.length || 0})
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

            {showPhotos && (
              <div className="mt-3">
                {attachments.isLoading ? (
                  <div className="text-center text-xs text-slate-400">Loading photos...</div>
                ) : attachments.isError ? (
                  <div className="text-center text-xs text-red-400">Failed to load photos</div>
                ) : !attachments.data?.data || attachments.data.data.length === 0 ? (
                  <div className="text-center text-xs text-slate-400">No photos yet</div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                    {attachments.data.data.map((attachment: any) => {
                      const mime = attachment.mime_type || attachment.Mime_Type || '';
                      const isVideo = mime.startsWith('video/');
                      const src = `/api/crm/repair-orders/${item.repairOrder.id}/attachments/${attachment.id}/download`;
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
                            href={`/api/crm/repair-orders/${item.repairOrder.id}/attachments/${attachment.id}/download`}
                            download={attachment.File_Name}
                            className="rounded-full bg-[#D4AF37]/80 px-2 py-1 text-xs font-semibold text-black hover:bg-[#D4AF37]"
                          >
                            Download
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDeleteAttachment(attachment.id)}
                            className="rounded-full bg-red-500/80 px-2 py-1 text-xs font-semibold text-white hover:bg-red-500"
                            disabled={deleteAttachment.isPending}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {uploadAttachment.isError && (
              <div className="text-xs text-red-400">Failed to upload photo</div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              className="rounded-full border border-red-900/30 bg-red-950/20 px-6 py-2 text-sm font-semibold text-red-400/90 hover:border-red-900/50 hover:bg-red-950/30 hover:text-red-300 disabled:opacity-40 transition-all"
              disabled={deleteRepairOrder.isPending}
              onClick={() => {
                if (confirm('Are you sure you want to delete this repair order? This action cannot be undone.')) {
                  deleteRepairOrder.mutate(item.repairOrder.id);
                }
              }}
            >
              {deleteRepairOrder.isPending ? 'Deleting…' : 'Delete'}
            </button>
            <div className="flex items-center gap-3">
              {update.isError ? <div className="text-sm text-red-400">Failed to save</div> : null}
              {update.isSuccess ? <div className="text-sm text-emerald-400">Saved</div> : null}
              <button
                className="rounded-full bg-[#D4AF37] px-6 py-2 text-sm font-semibold text-black hover:bg-[#C9A534] disabled:opacity-40"
                disabled={!canSave || update.isPending}
                onClick={async () => {
                  const nextVin = vin.trim();
                  const nextPlate = licensePlate.trim();

                  if (didChangeVin && nextVin) {
                    await checkInVin.mutateAsync(
                      { repair_order_id: item.repairOrder.id, vin: nextVin },
                      {
                        onSuccess: (data) => {
                          setVin(data.vehicle.vin || nextVin);
                          setLicensePlate(data.vehicle.license_plate || nextPlate);
                        },
                      }
                    );
                  }

                  if (didChangePlate && item.vehicle?.id) {
                    await updateVehicle.mutateAsync({
                      id: item.vehicle.id,
                      license_plate: nextPlate || undefined,
                    });
                  }

                  update.mutate({
                    id: item.repairOrder.id,
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
                }}
              >
                {update.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Send Estimate Modal */}
      {item.customer && (
        <SendEstimateModal
          isOpen={showSendEstimate}
          onClose={() => setShowSendEstimate(false)}
          repairOrder={{
            id: item.repairOrder.id,
            service_type: item.repairOrder.service_type || '',
            estimated_total: item.repairOrder.estimated_total,
            estimated_completion: item.repairOrder.estimated_completion,
          }}
          customer={{
            id: item.customer.id,
            first_name: item.customer.first_name || '',
            last_name: item.customer.last_name || '',
            phone: item.customer.phone || '',
          }}
          photoUrls={
            Array.isArray(attachments.data?.data)
              ? attachments.data.data
                  .filter((a: any) => {
                    const mime = a.mime_type || a.Mime_Type || '';
                    return !mime || mime.startsWith('image/');
                  })
                  .map((a: any) => `/api/crm/repair-orders/${item.repairOrder.id}/attachments/${a.id}/download`)
              : []
          }
          videoUrls={
            Array.isArray(attachments.data?.data)
              ? attachments.data.data
                  .filter((a: any) => {
                    const mime = a.mime_type || a.Mime_Type || '';
                    return mime.startsWith('video/');
                  })
                  .map((a: any) => `/api/crm/repair-orders/${item.repairOrder.id}/attachments/${a.id}/download`)
              : []
          }
        />
      )}
    </div>
  );
};

export default function RepairOrdersPage() {
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>('All');
  const [page, setPage] = useState(1);
  const [expandedAlert, setExpandedAlert] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const failedBookings = useFailedBookings();

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      await apiClient.post(`/api/dashboard/crm-backup/${id}/sync`);
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'failed-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'active-repair-orders'] });
      queryClient.invalidateQueries({ queryKey: ['repair-orders'] });
    } catch (err) {
      console.error('Failed to sync booking:', err);
      alert('Failed to add to repair orders. Please try again.');
    } finally {
      setSyncingId(null);
    }
  };

  const failedCount = failedBookings.data?.count || 0;
  const failedList = failedBookings.data?.data || [];
  const hasFailedBookings = failedCount > 0;

  const queryStatus = status === 'All' ? undefined : status;
  const { data: result, isLoading, isError, error } = useRepairOrdersEnriched({
    status: queryStatus,
    page,
    perPage: 100, // Fetch 100 per page - balance between status sorting and page load speed
  });

  const data = result?.data;
  const isFromCache = result?.fromCache ?? false;
  const cacheTimestamp = result?.cacheTimestamp ?? null;

  const rows = useMemo(() => (data?.data || []) as ActiveRepairOrderItem[], [data]);
  const hasMoreRecords = data?.info?.more_records ?? false;
  const totalCount = data?.info?.count ?? rows.length;

  // Sort by status priority, then by most recently updated within each status
  const sortedRows = useMemo(() => {
    const rank = (s: RepairOrderStatus) => {
      switch (s) {
        case 'New':
          return 0;
        case 'Scheduled':
          return 1;
        case 'Dropped Off':
          return 2;
        case 'Diagnosing':
          return 3;
        case 'Waiting Approval':
          return 4;
        case 'Repair Approved':
          return 5;
        case 'Awaiting Parts':
          return 6;
        case 'In Progress':
          return 7;
        case 'Ready For Pickup':
          return 8;
        case 'Completed':
          return 9;
        default:
          return 99;
      }
    };

    return [...rows].sort((a, b) => {
      const r = rank(a.repairOrder.status) - rank(b.repairOrder.status);
      if (r !== 0) return r;

      const aT = a.repairOrder.updated_time || a.repairOrder.created_time || '';
      const bT = b.repairOrder.updated_time || b.repairOrder.created_time || '';
      return bT.localeCompare(aT);
    });
  }, [rows]);

  const formatVehicleDisplay = (vehicle: ActiveRepairOrderItem['vehicle']) => {
    if (!vehicle) return '';
    return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
  };

  return (
    <div className="space-y-6">
      {isFromCache && cacheTimestamp && <OfflineBanner timestamp={cacheTimestamp} />}
      {/* Failed Bookings Alert Banner */}
      {hasFailedBookings && (
        <div className="rounded-lg border border-orange-500/50 bg-orange-500/10 backdrop-blur">
          <button
            onClick={() => setExpandedAlert(!expandedAlert)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <div className="font-semibold text-orange-200">
                  NEW repair order{failedCount > 1 ? 's' : ''} via Autonomous Agent
                </div>
                <div className="text-sm text-orange-300/80">
                  {failedCount} booking{failedCount > 1 ? 's' : ''} captured — click to review
                </div>
              </div>
            </div>
            <svg
              className={`h-5 w-5 text-orange-200 transition-transform ${expandedAlert ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expandedAlert && (
            <div className="border-t border-orange-500/30 px-4 py-3">
              <div className="space-y-3">
                {failedList.map((booking) => {
                  const vehicle = [booking.vehicle_year, booking.vehicle_make, booking.vehicle_model]
                    .filter(Boolean)
                    .join(' ');
                  const time = new Date(booking.created_at).toLocaleString();

                  return (
                    <div
                      key={booking.id}
                      className="flex items-start justify-between rounded-lg border border-orange-500/20 bg-orange-500/5 p-3"
                    >
                      <div className="flex-1 space-y-1 text-sm">
                        <div className="font-medium text-orange-100">
                          {booking.customer_name || 'Unknown Customer'} • {booking.phone}
                        </div>
                        <div className="text-orange-200/70">
                          {vehicle || 'Vehicle info not provided'}
                        </div>
                        <div className="text-orange-200/70">
                          Service: {booking.service_type || booking.job_description || 'Not specified'}
                        </div>
                        <div className="text-xs text-orange-300/60">{time}</div>
                      </div>
                      <button
                        onClick={() => handleSync(booking.id)}
                        disabled={syncingId === booking.id}
                        className="ml-4 rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                      >
                        {syncingId === booking.id ? 'Adding...' : 'Add to Repair Orders'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Repair Orders</h1>
          <p className="mt-1 text-sm text-slate-300">Browse and manage repair orders</p>
        </div>
        <a
          className="rounded-full bg-[#D4AF37] px-6 py-2 text-sm font-semibold text-black hover:bg-[#C9A534]"
          href="/repair-orders/new"
        >
          New Repair Order
        </a>
      </div>

      <GlobalSearch placeholder="Search customers, vehicles, repair orders…" />

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-300" htmlFor="status">
          Status
        </label>
        <div className="rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-2 backdrop-blur">
          <select
            id="status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as any);
              setPage(1); // Reset to page 1 when filter changes
            }}
            className="bg-transparent text-sm text-slate-100 focus:outline-none"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="surface p-4 text-sm text-slate-300">Loading…</div>
      ) : isError ? (
        <div className="surface p-4 text-sm text-red-200">
          {(error as any)?.message || 'Failed to load repair orders'}
        </div>
      ) : rows.length === 0 ? (
        <div className="surface p-6">
          <div className="text-sm text-slate-300">No repair orders found.</div>
        </div>
      ) : (
        <div className="surface overflow-hidden">
          <div className="grid grid-cols-12 gap-2 border-b border-white/10 bg-white/3 px-3 py-3 text-xs font-medium text-slate-300 lg:gap-3 lg:px-4">
            <div className="col-span-2">Status</div>
            <div className="col-span-3">Vehicle</div>
            <div className="col-span-2">Customer</div>
            <div className="col-span-2">Service</div>
            <div className="col-span-3 text-right">Actions</div>
          </div>
          <div className="divide-y divide-white/10">
            {sortedRows.map((item) => (
              <RepairOrderRow
                key={item.repairOrder.id}
                item={item}
                formatVehicleDisplay={formatVehicleDisplay}
              />
            ))}
          </div>
        </div>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-400">
            Showing page {page} {hasMoreRecords && '(more records available)'}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-[#D4AF37]/15 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-slate-300">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMoreRecords}
              className="rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-[#D4AF37]/15 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
