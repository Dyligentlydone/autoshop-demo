 'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCustomerByPhone } from '@/hooks/use-customer-by-phone';
import { useCreateCustomer } from '@/hooks/use-create-customer';
import { useCreateVehicle } from '@/hooks/use-create-vehicle';
import { useCreateRepairOrder } from '@/hooks/use-create-repair-order';
import { useVehiclesByCustomer } from '@/hooks/use-vehicles-by-customer';
import type { Vehicle } from '@/types';
import { DateTimePicker } from '@/components/DateTimePicker';

 const datetimeLocalToIso = (value: string) => {
   if (!value) return '';
   const d = new Date(value);
   if (Number.isNaN(d.getTime())) return '';
   return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
 };

export default function NewRepairOrderPage() {
  const router = useRouter();

  const [phone, setPhone] = useState('');
  const [searchedPhone, setSearchedPhone] = useState<string | null>(null);

  const customerQuery = useCustomerByPhone(searchedPhone || '');
  const createCustomer = useCreateCustomer();
  const createVehicle = useCreateVehicle();
  const createRepairOrder = useCreateRepairOrder();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const [vehicleMode, setVehicleMode] = useState<'existing' | 'new'>('existing');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');

  const [serviceType, setServiceType] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [note, setNote] = useState('');
  const [estimatedTotal, setEstimatedTotal] = useState('');
  const [finalChargeTotal, setFinalChargeTotal] = useState('');
  const [estimatedCompletion, setEstimatedCompletion] = useState('');
  const [scheduledDropOff, setScheduledDropOff] = useState('');

  const [year, setYear] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [engineSize, setEngineSize] = useState('');
  const [licensePlate, setLicensePlate] = useState('');

  const selectedCustomer = customerQuery.data || null;
  const vehiclesQuery = useVehiclesByCustomer(selectedCustomer?.id || '');
  const vehicles: Vehicle[] = vehiclesQuery.data || [];

  const canSearch = useMemo(() => phone.trim().length >= 7, [phone]);
  const canCreateCustomer = useMemo(() => {
    return Boolean(searchedPhone) && !customerQuery.isLoading && !selectedCustomer;
  }, [customerQuery.isLoading, searchedPhone, selectedCustomer]);

  const canCreateRepairOrder = useMemo(() => {
    if (!selectedCustomer?.id) return false;
    if (!serviceType.trim()) return false;
    if (vehicleMode === 'existing') return Boolean(selectedVehicleId);
    return Boolean(year.trim()) && Boolean(make.trim()) && Boolean(model.trim());
  }, [make, model, selectedCustomer?.id, selectedVehicleId, serviceType, vehicleMode, year]);

  const onSearch = () => {
    const p = phone.trim();
    if (!p) return;
    setSearchedPhone(p);
  };

  const onQuickCreateCustomer = async () => {
    if (!searchedPhone) return;
    await createCustomer.mutateAsync({
      phone: searchedPhone,
      first_name: firstName || undefined,
      last_name: lastName || undefined,
    });
  };

  const onCreate = async () => {
    if (!selectedCustomer?.id) return;

    const estimatedTotalNum = Number(estimatedTotal);
    const finalChargeTotalNum = Number(finalChargeTotal);

    const vehicleId =
      vehicleMode === 'existing'
        ? selectedVehicleId
        : (await createVehicle.mutateAsync({
            year: year.trim(),
            make: make.trim(),
            model: model.trim(),
            engine_size: engineSize.trim() || undefined,
            license_plate: licensePlate.trim() || undefined,
            customer_id: selectedCustomer.id,
          })).id;

    await createRepairOrder.mutateAsync({
      vehicle_id: vehicleId,
      customer_id: selectedCustomer.id,
      status: 'New',
      service_type: serviceType.trim(),
      job_description: jobDescription.trim() || undefined,
      note: note.trim() || undefined,
      estimated_total: estimatedTotal.trim() ? (Number.isFinite(estimatedTotalNum) ? estimatedTotalNum : undefined) : undefined,
      final_charge_total: finalChargeTotal.trim()
        ? (Number.isFinite(finalChargeTotalNum) ? finalChargeTotalNum : undefined)
        : undefined,
      estimated_completion: datetimeLocalToIso(estimatedCompletion) || undefined,
      scheduled_drop_off: datetimeLocalToIso(scheduledDropOff) || undefined,
    });

    router.push('/repair-orders');
  };

  const busy =
    customerQuery.isFetching ||
    vehiclesQuery.isFetching ||
    createCustomer.isPending ||
    createVehicle.isPending ||
    createRepairOrder.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Create Repair Order</h1>
        <p className="mt-1 text-sm text-slate-300">Phone-first intake. VIN can be added later.</p>
      </div>

      <div className="surface p-6 space-y-6">
        <div className="space-y-3">
          <div className="text-sm font-medium text-slate-100">1) Customer</div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <div className="text-xs font-medium text-slate-300">Phone</div>
              <div className="mt-1 w-80 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-2 backdrop-blur">
                <input
                  className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 6168219153"
                />
              </div>
            </div>
            <button
              className="rounded-full bg-[#D4AF37] px-5 py-2 text-sm font-semibold text-black hover:bg-[#C9A534] disabled:opacity-40"
              disabled={!canSearch || busy}
              onClick={onSearch}
            >
              Search
            </button>
          </div>

          {searchedPhone ? (
            <div className="text-sm text-slate-300">
              Searching for: <span className="font-mono">{searchedPhone}</span>
            </div>
          ) : null}

          {customerQuery.isLoading ? (
            <div className="text-sm text-slate-300">Loading customer…</div>
          ) : selectedCustomer ? (
            <div className="rounded-md border border-white/10 bg-white/3 p-4">
              <div className="text-sm font-medium text-slate-100">
                {selectedCustomer.first_name} {selectedCustomer.last_name}
              </div>
              <div className="mt-1 text-xs text-slate-400">{selectedCustomer.phone}</div>
            </div>
          ) : searchedPhone && !customerQuery.isError ? (
            <div className="rounded-md border border-white/10 bg-white/3 p-4 space-y-3">
              <div className="text-sm text-slate-200">No customer found. Quick create:</div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <div className="text-xs font-medium text-slate-300">First name</div>
                  <div className="mt-1 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-2 backdrop-blur">
                    <input
                      className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-300">Last name</div>
                  <div className="mt-1 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-2 backdrop-blur">
                    <input
                      className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <button
                className="rounded-full bg-[#D4AF37] px-5 py-2 text-sm font-semibold text-black hover:bg-[#C9A534] disabled:opacity-40"
                disabled={!canCreateCustomer || busy}
                onClick={onQuickCreateCustomer}
              >
                {createCustomer.isPending ? 'Creating…' : 'Create Customer'}
              </button>
            </div>
          ) : customerQuery.isError ? (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              {(customerQuery.error as any)?.message || 'Failed to search customer'}
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium text-slate-100">2) Repair order details</div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="md:col-span-1">
              <div className="text-xs font-medium text-slate-300">Service type</div>
              <div className="mt-1 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-2 backdrop-blur">
                <input
                  className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none disabled:opacity-40"
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  placeholder="Tires / Oil / Brakes"
                  disabled={!selectedCustomer}
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="text-xs font-medium text-slate-300">Job description</div>
              <div className="mt-1 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-2 backdrop-blur">
                <input
                  className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none disabled:opacity-40"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Customer request"
                  disabled={!selectedCustomer}
                />
              </div>
              <div className="mt-1 text-xs text-slate-400">Example: “Front brakes squeal”</div>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-300">Note</div>
            <div className="mt-1 rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-3 backdrop-blur">
              <textarea
                className="w-full resize-none bg-transparent text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none disabled:opacity-40"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Internal notes"
                disabled={!selectedCustomer}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <div className="text-xs font-medium text-slate-300">Estimated Total</div>
              <div className="mt-1 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-2 backdrop-blur">
                <input
                  className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none disabled:opacity-40"
                  type="number"
                  step="0.01"
                  min="0"
                  value={estimatedTotal}
                  onChange={(e) => setEstimatedTotal(e.target.value)}
                  placeholder="0.00"
                  disabled={!selectedCustomer}
                />
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-300">Final Charge Total</div>
              <div className="mt-1 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-2 backdrop-blur">
                <input
                  className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none disabled:opacity-40"
                  type="number"
                  step="0.01"
                  min="0"
                  value={finalChargeTotal}
                  onChange={(e) => setFinalChargeTotal(e.target.value)}
                  placeholder="0.00"
                  disabled={!selectedCustomer}
                />
              </div>
            </div>
            <DateTimePicker
              label="Scheduled Drop Off"
              value={scheduledDropOff}
              onChange={setScheduledDropOff}
              disabled={!selectedCustomer}
            />
            <DateTimePicker
              label="Estimated Completion"
              value={estimatedCompletion}
              onChange={setEstimatedCompletion}
              disabled={!selectedCustomer}
            />
          </div>

          <div className="text-sm font-medium text-slate-100">3) Vehicle</div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-slate-300" htmlFor="vehicleMode">
              Use
            </label>
            <select
              id="vehicleMode"
              value={vehicleMode}
              onChange={(e) => setVehicleMode(e.target.value as any)}
              className="select-dark"
              disabled={!selectedCustomer}
            >
              <option value="existing">Existing vehicle</option>
              <option value="new">Add new vehicle</option>
            </select>
          </div>

          {vehicleMode === 'existing' ? (
            <div className="space-y-2">
              {!selectedCustomer ? (
                <div className="text-sm text-slate-300">Select a customer first.</div>
              ) : vehiclesQuery.isLoading ? (
                <div className="text-sm text-slate-300">Loading vehicles…</div>
              ) : vehicles.length === 0 ? (
                <div className="rounded-md border border-white/10 bg-white/3 p-4">
                  <div className="text-sm text-slate-200">No vehicles found for this customer.</div>
                  <div className="mt-1 text-xs text-slate-400">Switch to “Add new vehicle”.</div>
                </div>
              ) : (
                <div className="rounded-md border border-white/10 bg-white/3 p-4 space-y-3">
                  <div className="text-sm text-slate-200">Select vehicle:</div>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    className="select-dark w-full"
                  >
                    <option value="">Choose…</option>
                    {vehicles.map((v) => {
                      const label = [v.year, v.make, v.model].filter(Boolean).join(' ');
                      const meta = [v.license_plate ? `Plate ${v.license_plate}` : '', v.vin ? `VIN ${v.vin}` : '']
                        .filter(Boolean)
                        .join(' • ');
                      return (
                        <option key={v.id} value={v.id}>
                          {label || 'Vehicle'}{meta ? ` (${meta})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                <div>
                  <div className="text-xs font-medium text-slate-300">Year</div>
                  <input
                    className="input-dark mt-1"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    disabled={!selectedCustomer}
                  />
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-300">Make</div>
                  <input
                    className="input-dark mt-1"
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    disabled={!selectedCustomer}
                  />
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-300">Model</div>
                  <input
                    className="input-dark mt-1"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    disabled={!selectedCustomer}
                  />
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-300">Engine size (optional)</div>
                  <input
                    className="input-dark mt-1"
                    value={engineSize}
                    onChange={(e) => setEngineSize(e.target.value)}
                    disabled={!selectedCustomer}
                    placeholder="e.g. 3.5L"
                  />
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-300">Plate (optional)</div>
                  <input
                    className="input-dark mt-1"
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value)}
                    disabled={!selectedCustomer}
                  />
                </div>
              </div>
              <div className="text-xs text-slate-400">VIN is captured later during check-in.</div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <a className="text-sm font-medium text-slate-300 hover:text-white" href="/repair-orders">
            Cancel
          </a>
          <button
            className="rounded-full bg-[#D4AF37] px-6 py-2 text-sm font-semibold text-black hover:bg-[#C9A534] disabled:opacity-40"
            disabled={!canCreateRepairOrder || busy}
            onClick={onCreate}
          >
            {busy ? 'Creating…' : 'Create Repair Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
