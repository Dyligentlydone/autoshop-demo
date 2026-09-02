'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useShopSettings } from '@/hooks/use-shop-settings';
import { useEstimatePresets } from '@/hooks/use-estimate-presets';
import { useCustomerByPhone } from '@/hooks/use-customer-by-phone';
import { useCreateCustomer } from '@/hooks/use-create-customer';
import { useCreateVehicle } from '@/hooks/use-create-vehicle';
import { useVehiclesByCustomer } from '@/hooks/use-vehicles-by-customer';
import { useRepairOrdersEnriched } from '@/hooks/use-repair-orders-enriched';
import type { EstimateItem, PartSource, PartCondition, Vehicle } from '@/types';
import { Plus, Trash2, Edit2, FileDown, ExternalLink } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { QuotePDF } from '@/components/quote-pdf';
import { DateTimePicker } from '@/components/DateTimePicker';

type LocalItem = Omit<EstimateItem, 'id' | 'estimate_id' | 'created_at' | 'updated_at'> & {
  _localId: string;
};

let nextLocalId = 1;
const newLocalId = () =>
  `local-${Date.now().toString(36)}-${(nextLocalId++).toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

const datetimeLocalToIso = (value: string) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
};

export default function EstimatePage() {
  const router = useRouter();
  const { data: settingsData } = useShopSettings();
  const presetsQuery = useEstimatePresets();
  const presets = (presetsQuery.data as any)?.data || [];
  const settings = settingsData?.data;

  // Line items (local state until completion)
  const [items, setItems] = useState<LocalItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  // Customer lookup + creation
  const [phone, setPhone] = useState('');
  const [searchedPhone, setSearchedPhone] = useState<string | null>(null);
  const customerQuery = useCustomerByPhone(searchedPhone || '');
  const createCustomer = useCreateCustomer();
  const createVehicle = useCreateVehicle();
  const selectedCustomer = customerQuery.data || null;
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // Vehicle selection + creation
  const vehiclesQuery = useVehiclesByCustomer(selectedCustomer?.id || '');
  const vehicles: Vehicle[] = vehiclesQuery.data || [];
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [vehicleMode, setVehicleMode] = useState<'existing' | 'new'>('existing');
  const [year, setYear] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [engineSize, setEngineSize] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [scheduledDropOff, setScheduledDropOff] = useState('');
  const [estimatedCompletion, setEstimatedCompletion] = useState('');

  // Complete flow
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completionMode, setCompletionMode] = useState<'complete' | 'order'>('complete');
  const [roMode, setRoMode] = useState<'new' | 'existing'>('new');
  const [selectedRoId, setSelectedRoId] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);

  // RO list for linking
  const repairOrdersQuery = useRepairOrdersEnriched();
  const existingROs = useMemo(() => {
    const raw = (repairOrdersQuery.data as any)?.data?.data || [];
    return raw.filter((ro: any) => ro.repairOrder.status !== 'Completed');
  }, [repairOrdersQuery.data]);

  const canSearch = useMemo(() => phone.trim().length >= 7, [phone]);
  const canCreateCustomer = useMemo(() => {
    return Boolean(searchedPhone) && !customerQuery.isLoading && !selectedCustomer;
  }, [customerQuery.isLoading, searchedPhone, selectedCustomer]);

  // Auto-select first vehicle
  useEffect(() => {
    if (vehicles.length > 0 && !selectedVehicleId) {
      setSelectedVehicleId(vehicles[0].id);
    }
  }, [vehicles, selectedVehicleId]);

  // If no vehicles, default to "new" mode
  useEffect(() => {
    if (selectedCustomer && !vehiclesQuery.isLoading && vehicles.length === 0) {
      setVehicleMode('new');
    }
  }, [selectedCustomer, vehiclesQuery.isLoading, vehicles.length]);

  // Calculate totals
  const taxRate = settings?.tax?.enabled ? (settings.tax.rate || 0) : 0;
  const laborRate = settings?.labor_rates?.hourly_rate || 100;

  const subtotal = items.reduce((sum, item) => {
    return sum + (item.parts_price * item.quantity) + item.labor_price;
  }, 0);

  // Only sum taxable items into the tax base
  const taxableSubtotal = items.reduce((sum, item) => {
    if (item.taxable === false) return sum;
    return sum + (item.parts_price * item.quantity) + item.labor_price;
  }, 0);

  const totalCost = items.reduce((sum, item) => {
    return sum + (item.parts_cost * item.quantity) + item.labor_cost;
  }, 0);

  const taxAmount = taxableSubtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  const totalProfit = subtotal - totalCost;
  const profitMargin = subtotal > 0 ? (totalProfit / subtotal) * 100 : 0;

  // Add preset items to estimate
  const applyPreset = (presetId: string) => {
    const preset = presets.find((p: any) => p.id === presetId);
    if (!preset?.estimate_preset_items?.length) return;

    const newItems: LocalItem[] = preset.estimate_preset_items.map((pi: any, idx: number) => {
      const hours = pi.labor_hours || 0;
      const rate = pi.labor_rate || laborRate;
      const laborPrice = pi.labor_price || (hours * rate);
      const qty = pi.quantity || 1;
      const partsCost = pi.parts_cost || 0;
      const partsPrice = pi.parts_price || 0;

      return {
        _localId: newLocalId(),
        description: pi.description,
        quantity: qty,
        parts_cost: partsCost,
        parts_price: partsPrice,
        labor_hours: hours,
        labor_rate: rate,
        labor_cost: 0,
        labor_price: laborPrice,
        part_number: '',
        supplier: '',
        source: 'manual' as PartSource,
        order_status: 'not_ordered' as const,
        category: pi.category || '',
        notes: pi.notes || '',
        taxable: pi.taxable !== false,
        sort_order: items.length + idx,
      };
    });

    setItems((prev) => [...prev, ...newItems]);
  };

  const removeItem = (localId: string) => {
    setItems((prev) => prev.filter((i) => i._localId !== localId));
  };

  const onQuickCreateCustomer = async () => {
    if (!searchedPhone) return;
    await createCustomer.mutateAsync({
      phone: searchedPhone,
      first_name: firstName || undefined,
      last_name: lastName || undefined,
    });
  };

  // Complete the estimate
  const handleComplete = async () => {
    if (items.length === 0) {
      alert('Add at least one item before completing.');
      return;
    }

    if (!selectedCustomer) {
      alert('Please look up or create a customer first.');
      return;
    }

    // Resolve vehicle ID — create one if needed
    let vehicleId = selectedVehicleId;
    if (vehicleMode === 'new') {
      if (!year.trim() || !make.trim() || !model.trim()) {
        alert('Please enter at least Year, Make, and Model for the vehicle.');
        return;
      }
      // Will create during completion
    } else if (!vehicleId) {
      alert('Please select a vehicle or add a new one.');
      return;
    }

    setIsCompleting(true);
    try {
      // If new vehicle, create it first
      if (vehicleMode === 'new') {
        const newVehicle = await createVehicle.mutateAsync({
          year: year.trim(),
          make: make.trim(),
          model: model.trim(),
          engine_size: engineSize.trim() || undefined,
          license_plate: licensePlate.trim() || undefined,
          customer_id: selectedCustomer.id,
        });
        vehicleId = newVehicle.id;
      }

      // 1. Create the estimate
      const estRes = await fetch('/api/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomer.id,
          vehicle_id: vehicleId,
          notes,
        }),
      });
      const estData = await estRes.json();
      const estimateId = estData.data.id;

      // 2. Add all items
      for (const item of items) {
        await fetch(`/api/estimates/${estimateId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: item.description,
            quantity: item.quantity,
            parts_cost: item.parts_cost,
            parts_price: item.parts_price,
            labor_hours: item.labor_hours,
            labor_rate: item.labor_rate,
            labor_cost: item.labor_cost,
            labor_price: item.labor_price,
            part_number: item.part_number || null,
            supplier: item.supplier || null,
            source: item.source,
            condition: item.condition || null,
            order_status: item.order_status,
            category: item.category || null,
            notes: item.notes || null,
            sort_order: item.sort_order,
          }),
        });
      }

      // 3. Complete — link to RO
      const completeBody: any = {
        order_parts: completionMode === 'order',
      };

      if (roMode === 'existing' && selectedRoId) {
        completeBody.repair_order_id = selectedRoId;
      } else {
        completeBody.create_repair_order = {
          customer_id: selectedCustomer.id,
          vehicle_id: vehicleId,
          service_type: items.map((i) => i.description).slice(0, 3).join(', '),
          scheduled_drop_off: datetimeLocalToIso(scheduledDropOff) || undefined,
          estimated_completion: datetimeLocalToIso(estimatedCompletion) || undefined,
        };
      }

      const completeRes = await fetch(`/api/estimates/${estimateId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completeBody),
      });
      const completeData = await completeRes.json();

      if (!completeRes.ok) {
        throw new Error(completeData.error || 'Failed to complete estimate');
      }

      router.push('/repair-orders');
    } catch (err: any) {
      console.error('Complete estimate error:', err);
      alert(`Failed to complete estimate: ${err.message}`);
    } finally {
      setIsCompleting(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (items.length === 0) {
      alert('Add items before generating a quote.');
      return;
    }

    try {
      const lineItems = items.map((item) => ({
        id: item._localId,
        repair_order_id: '',
        description: item.description,
        quantity: item.quantity,
        parts_cost: item.parts_cost,
        parts_price: item.parts_price,
        labor_hours: item.labor_hours,
        labor_rate: item.labor_rate,
        labor_cost: item.labor_cost,
        labor_price: item.labor_price,
        part_number: item.part_number,
        condition: item.condition,
        category: item.category,
        notes: item.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const blob = await pdf(
        <QuotePDF lineItems={lineItems} settings={settings} repairOrderId="draft" />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `estimate-${Date.now()}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PDF error:', error);
      alert('Failed to generate PDF.');
    }
  };

  const busy =
    customerQuery.isFetching ||
    vehiclesQuery.isFetching ||
    createCustomer.isPending ||
    createVehicle.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold" style={{ color: '#d7b73f' }}>
          Estimate Builder
        </h1>
        <div className="flex gap-2">
          {items.length > 0 && (
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/12 px-4 py-2 text-sm font-semibold text-[#F6E7B7] hover:bg-[#D4AF37]/22"
            >
              <FileDown size={16} />
              PDF
            </button>
          )}
        </div>
      </div>

      {/* ── Parts Search ─────────────────────────────────── */}
      <div className="rounded-lg border border-white/10 bg-black/40 p-4 backdrop-blur">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">Parts Search</h2>
        <input
          type="text"
          placeholder="Search parts by: Vehicle, Customer, Year/Make/Model, VIN, Plate, Recent Vehicles"
          className="w-full rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40"
          disabled
        />
      </div>

      {/* ── 1) Quick Quote Presets ─────────────────────────── */}
      {presets.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-black/40 p-4 backdrop-blur">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">Quick Quote Presets</h2>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset: any) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset.id)}
                className="rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/12 px-4 py-2 text-sm font-semibold text-[#F6E7B7] hover:bg-[#D4AF37]/22 active:bg-[#D4AF37]/28"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 2) Line Items ─────────────────────────────────── */}
      <div className="rounded-lg border border-white/10 bg-black/40 backdrop-blur">
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <h2 className="text-sm font-semibold text-slate-300">
            Line Items ({items.length})
          </h2>
          <button
            onClick={() => { setEditingIdx(null); setShowAddModal(true); }}
            className="flex items-center gap-1 rounded-full bg-[#d7b73f] px-4 py-1.5 text-sm font-semibold text-black hover:bg-[#c5a838]"
          >
            <Plus size={14} /> Add Item
          </button>
        </div>

        {items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No items yet. Add items manually or use a Quick Quote preset above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 bg-white/3">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-400">Description</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-400">Part #</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-400">Source</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-400">Condition</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-400">Qty</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-400">Parts $</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-400">Labor $</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-400">Total</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-400">Profit</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-400"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {items.map((item, idx) => {
                  const partsPrice = item.parts_price * item.quantity;
                  const lineTotal = partsPrice + item.labor_price;
                  const lineCost = (item.parts_cost * item.quantity) + item.labor_cost;
                  const lineProfit = lineTotal - lineCost;
                  const sourceLabel = item.source === 'aftermarket' ? 'AFT' : item.source === 'oem' ? 'OEM' : '—';

                  return (
                    <tr key={item._localId} className="hover:bg-white/3">
                      <td className="px-4 py-2.5">
                        <div className="text-slate-100">{item.description}</div>
                        {item.supplier && (
                          <div className="text-xs text-slate-500">{item.supplier}</div>
                        )}
                        {item.labor_hours > 0 && (
                          <div className="text-xs text-slate-500">
                            {item.labor_hours}h @ ${item.labor_rate}/hr
                          </div>
                        )}
                        {item.notes && (
                          <div className="text-xs text-slate-500 italic">{item.notes}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-400">{item.part_number || '—'}</td>
                      <td className="px-4 py-2.5">
                        {item.source !== 'manual' && (
                          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            item.source === 'aftermarket'
                              ? 'bg-blue-500/15 text-blue-300'
                              : 'bg-purple-500/15 text-purple-300'
                          }`}>
                            {sourceLabel}
                          </span>
                        )}
                        {item.source === 'manual' && <span className="text-xs text-slate-500">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {item.condition ? (
                          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            item.condition === 'new' ? 'bg-green-500/15 text-green-300'
                              : item.condition === 'used' ? 'bg-yellow-500/15 text-yellow-300'
                              : 'bg-orange-500/15 text-orange-300'
                          }`}>
                            {item.condition === 'remanufactured' ? 'Reman' : item.condition.charAt(0).toUpperCase() + item.condition.slice(1)}
                          </span>
                        ) : <span className="text-xs text-slate-500">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-200">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-right">
                        {partsPrice > 0 ? (
                          <div>
                            <div className="text-slate-200">${partsPrice.toFixed(2)}</div>
                            <div className="text-xs text-slate-500">cost: ${(item.parts_cost * item.quantity).toFixed(2)}</div>
                          </div>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {item.labor_price > 0 ? (
                          <div>
                            <div className="text-slate-200">${item.labor_price.toFixed(2)}</div>
                            <div className="text-xs text-slate-500">cost: ${item.labor_cost.toFixed(2)}</div>
                          </div>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-100">
                        ${lineTotal.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={lineProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
                          ${lineProfit.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => { setEditingIdx(idx); setShowAddModal(true); }}
                            className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => removeItem(item._localId)}
                            className="rounded p-1 text-slate-400 hover:bg-red-500/20 hover:text-red-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        {items.length > 0 && (
          <div className="border-t border-white/10 p-4">
            <div className="flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between text-slate-300">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {taxRate > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Tax ({taxRate}%)</span>
                    <span>${taxAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-white/10 pt-1 text-lg font-bold" style={{ color: '#d7b73f' }}>
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Total cost</span>
                  <span className="text-slate-500">${totalCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Profit ({profitMargin.toFixed(1)}%)</span>
                  <span className={totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
                    ${totalProfit.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 3) Notes ──────────────────────────────────────── */}
      <div className="rounded-lg border border-white/10 bg-black/40 p-4 backdrop-blur">
        <label className="mb-2 block text-sm font-semibold text-slate-300">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40"
          placeholder="Estimate notes..."
        />
      </div>

      {/* ── 4) Customer & Vehicle ─────────────────────────── */}
      <div className="rounded-lg border border-white/10 bg-black/40 p-4 backdrop-blur space-y-4">
        <div className="text-sm font-semibold text-slate-300">Customer</div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <div className="text-xs font-medium text-slate-300">Phone</div>
            <div className="mt-1 w-80 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-2 backdrop-blur">
              <input
                className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 6168219153"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSearch) setSearchedPhone(phone.trim());
                }}
              />
            </div>
          </div>
          <button
            className="rounded-full bg-[#D4AF37] px-5 py-2 text-sm font-semibold text-black hover:bg-[#C9A534] disabled:opacity-40"
            disabled={!canSearch || busy}
            onClick={() => setSearchedPhone(phone.trim())}
          >
            Search
          </button>
        </div>

        {searchedPhone && (
          <div className="text-sm text-slate-300">
            Searching for: <span className="font-mono">{searchedPhone}</span>
          </div>
        )}

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

        {/* Scheduled Drop Off & Estimated Completion */}
        {selectedCustomer && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
        )}

        {/* Vehicle */}
        {selectedCustomer && (
          <>
            <div className="text-sm font-semibold text-slate-300">Vehicle</div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium text-slate-300" htmlFor="vehicleMode">
                Use
              </label>
              <select
                id="vehicleMode"
                value={vehicleMode}
                onChange={(e) => setVehicleMode(e.target.value as any)}
                className="select-dark"
              >
                <option value="existing">Existing vehicle</option>
                <option value="new">Add new vehicle</option>
              </select>
            </div>

            {vehicleMode === 'existing' ? (
              <div className="space-y-2">
                {vehiclesQuery.isLoading ? (
                  <div className="text-sm text-slate-300">Loading vehicles…</div>
                ) : vehicles.length === 0 ? (
                  <div className="rounded-md border border-white/10 bg-white/3 p-4">
                    <div className="text-sm text-slate-200">No vehicles found for this customer.</div>
                    <div className="mt-1 text-xs text-slate-400">Switch to "Add new vehicle".</div>
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
                        const meta = [
                          v.license_plate ? `Plate ${v.license_plate}` : '',
                          v.vin ? `VIN ${v.vin}` : '',
                        ]
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
                    />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-300">Make</div>
                    <input
                      className="input-dark mt-1"
                      value={make}
                      onChange={(e) => setMake(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-300">Model</div>
                    <input
                      className="input-dark mt-1"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-300">Engine size (optional)</div>
                    <input
                      className="input-dark mt-1"
                      value={engineSize}
                      onChange={(e) => setEngineSize(e.target.value)}
                      placeholder="e.g. 3.5L"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-300">Plate (optional)</div>
                    <input
                      className="input-dark mt-1"
                      value={licensePlate}
                      onChange={(e) => setLicensePlate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="text-xs text-slate-400">VIN is captured later during check-in.</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 5) Action Buttons ─────────────────────────────── */}
      {items.length > 0 && (
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => { setCompletionMode('complete'); setShowCompleteModal(true); }}
            className="rounded-full bg-[#d7b73f] px-6 py-3 text-sm font-semibold text-black hover:bg-[#c5a838]"
          >
            Complete
          </button>
          <button
            onClick={() => { setCompletionMode('order'); setShowCompleteModal(true); }}
            disabled
            title="Coming soon — connect PartsTech API to enable ordering"
            className="rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/12 px-6 py-3 text-sm font-semibold text-[#F6E7B7] opacity-50 cursor-not-allowed"
          >
            Complete & Order Parts
          </button>
        </div>
      )}

      {/* Add/Edit Item Modal */}
      {showAddModal && (
        <ItemModal
          item={editingIdx !== null ? items[editingIdx] : null}
          laborRate={laborRate}
          markupStandard={settings?.markup_presets?.standard || 30}
          markupPremium={settings?.markup_presets?.premium || 50}
          onSave={(item) => {
            if (editingIdx !== null) {
              setItems((prev) => prev.map((p, i) => (i === editingIdx ? item : p)));
            } else {
              setItems((prev) => [...prev, item]);
            }
            setShowAddModal(false);
            setEditingIdx(null);
          }}
          onClose={() => { setShowAddModal(false); setEditingIdx(null); }}
        />
      )}

      {/* Complete Modal */}
      {showCompleteModal && (
        <CompleteModal
          mode={completionMode}
          customer={selectedCustomer}
          vehicleId={vehicleMode === 'existing' ? selectedVehicleId : 'new-vehicle'}
          existingROs={existingROs}
          roMode={roMode}
          setRoMode={setRoMode}
          selectedRoId={selectedRoId}
          setSelectedRoId={setSelectedRoId}
          isCompleting={isCompleting}
          onConfirm={handleComplete}
          onClose={() => setShowCompleteModal(false)}
          total={total}
          itemCount={items.length}
        />
      )}
    </div>
  );
}

// ─── Item Modal ───────────────────────────────────────────────────────

function ItemModal({
  item,
  laborRate,
  markupStandard,
  markupPremium,
  onSave,
  onClose,
}: {
  item: LocalItem | null;
  laborRate: number;
  markupStandard: number;
  markupPremium: number;
  onSave: (item: LocalItem) => void;
  onClose: () => void;
}) {
  const [description, setDescription] = useState(item?.description || '');
  const [quantity, setQuantity] = useState(String(item?.quantity || 1));
  const [partsCost, setPartsCost] = useState(String(item?.parts_cost || ''));
  const [partsPrice, setPartsPrice] = useState(String(item?.parts_price || ''));
  const [laborHours, setLaborHours] = useState(String(item?.labor_hours || ''));
  const [rate, setRate] = useState(String(item?.labor_rate || laborRate));
  const [partNumber, setPartNumber] = useState(item?.part_number || '');
  const [supplier, setSupplier] = useState(item?.supplier || '');
  const [source, setSource] = useState<PartSource>(item?.source || 'manual');
  const [itemNotes, setItemNotes] = useState(item?.notes || '');
  const [category, setCategory] = useState(item?.category || '');
  const [condition, setCondition] = useState<PartCondition | ''>(item?.condition || 'new');
  const [laborCostInput, setLaborCostInput] = useState(
    item?.labor_cost && item.labor_cost !== item.labor_price ? String(item.labor_cost) : ''
  );
  const [taxable, setTaxable] = useState<boolean>(item?.taxable !== false);
  // Labor price is always computed from hours x rate

  const hours = parseFloat(laborHours) || 0;
  const rateNum = parseFloat(rate) || 0;
  const computedLaborPrice = hours * rateNum;
  const computedLaborCost = laborCostInput !== '' ? (parseFloat(laborCostInput) || 0) : 0;

  const costNum = parseFloat(partsCost) || 0;
  const priceNum = parseFloat(partsPrice) || 0;

  const applyMarkup = (pct: number) => {
    if (costNum > 0) {
      setPartsPrice((costNum * (1 + pct / 100)).toFixed(2));
    }
  };

  const handleSave = () => {
    if (!description.trim()) {
      alert('Description is required');
      return;
    }

    onSave({
      _localId: item?._localId || newLocalId(),
      description: description.trim(),
      quantity: parseInt(quantity) || 1,
      parts_cost: costNum,
      parts_price: priceNum,
      labor_hours: hours,
      labor_rate: rateNum,
      labor_cost: computedLaborCost,
      labor_price: computedLaborPrice,
      part_number: partNumber || undefined,
      supplier: supplier || undefined,
      source,
      condition: condition || undefined,
      order_status: 'not_ordered',
      category: category || undefined,
      notes: itemNotes || undefined,
      taxable,
      sort_order: item?.sort_order || 0,
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-lg border border-white/10 bg-black/95 p-6 backdrop-blur mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold" style={{ color: '#d7b73f' }}>
            {item ? 'Edit Item' : 'Add Item'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="space-y-4">
          {/* Description */}
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: '#d7b73f' }}>Description *</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#d7b73f]/40"
              placeholder="e.g. Front Brake Pads - Ceramic"
            />
          </div>

          {/* Source selector */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Part Source</label>
            <div className="flex gap-2">
              {(['manual', 'aftermarket', 'oem'] as PartSource[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSource(s)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    source === s
                      ? 'bg-[#d7b73f] text-black'
                      : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {s === 'manual' ? 'Manual' : s === 'aftermarket' ? 'Aftermarket' : 'OEM'}
                </button>
              ))}
            </div>
          </div>

          {/* OEM RepairLink helper */}
          {source === 'oem' && (
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
              <div className="flex items-center gap-2 text-sm text-purple-300">
                <ExternalLink size={14} />
                <span className="font-medium">OEM Part — Use RepairLink to find exact part</span>
              </div>
              <a
                href="https://www.repairlink.com"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 rounded-full border border-purple-400/30 bg-purple-400/10 px-3 py-1 text-xs font-medium text-purple-300 hover:bg-purple-400/20"
              >
                Open RepairLink <ExternalLink size={12} />
              </a>
              <p className="mt-2 text-xs text-purple-400/70">
                Find the OEM part, then enter the part number and price below.
              </p>
            </div>
          )}

          {/* Part details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: '#d7b73f' }}>Part Number *</label>
              <input
                type="text"
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
                className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#d7b73f]/40"
                placeholder="e.g. BC1543"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Supplier</label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#d7b73f]/40"
                placeholder="e.g. Bosch, Dorman"
              />
            </div>
          </div>

          {/* Part Condition (MI law compliance) */}
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: '#d7b73f' }}>Part Condition *</label>
            <div className="flex gap-2">
              {([['new', 'New'], ['used', 'Used'], ['remanufactured', 'Reman']] as const).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setCondition(condition === val ? '' : val)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    condition === val
                      ? 'bg-[#d7b73f] text-black'
                      : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Parts pricing */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Parts</label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-0.5 block text-xs" style={{ color: '#d7b73f' }}>Qty *</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#d7b73f]/40"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-xs text-slate-500">Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={partsCost}
                  onChange={(e) => setPartsCost(e.target.value)}
                  className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#d7b73f]/40"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-xs" style={{ color: '#d7b73f' }}>Price ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={partsPrice}
                  onChange={(e) => setPartsPrice(e.target.value)}
                  className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#d7b73f]/40"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => applyMarkup(markupStandard)}
                className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
              >
                +{markupStandard}% Markup
              </button>
              <button
                type="button"
                onClick={() => applyMarkup(markupPremium)}
                className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
              >
                +{markupPremium}% Markup
              </button>
            </div>
          </div>

          {/* Labor */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Labor</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-0.5 block text-xs" style={{ color: '#d7b73f' }}>Hours *</label>
                <input
                  type="number"
                  step="0.25"
                  value={laborHours}
                  onChange={(e) => setLaborHours(e.target.value)}
                  className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#d7b73f]/40"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-xs text-slate-500">Rate ($/hr)</label>
                <input
                  type="number"
                  step="1"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#d7b73f]/40"
                />
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-0.5 block text-xs text-slate-500">Labor Cost ($) <span className="text-slate-600">optional</span></label>
                <input
                  type="number"
                  step="0.01"
                  value={laborCostInput}
                  onChange={(e) => setLaborCostInput(e.target.value)}
                  className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#d7b73f]/40"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-xs text-slate-300">Labor Price ($)</label>
                <div className="flex items-center rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100">
                  ${computedLaborPrice.toFixed(2)}
                </div>
              </div>
            </div>
            {computedLaborPrice > 0 && computedLaborCost < computedLaborPrice && (
              <div className="mt-1 text-xs text-green-400">
                Labor profit: ${(computedLaborPrice - computedLaborCost).toFixed(2)}
              </div>
            )}
          </div>

          {/* Taxable toggle */}
          <div className="flex items-center gap-2 rounded border border-white/10 bg-white/5 px-3 py-2">
            <input
              id="estimate-item-taxable"
              type="checkbox"
              checked={taxable}
              onChange={(e) => setTaxable(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-[#d7b73f]"
            />
            <label htmlFor="estimate-item-taxable" className="text-xs text-slate-300 cursor-pointer select-none">
              Charge sales tax on this item
              {!taxable && (
                <span className="ml-2 text-[10px] text-amber-400">(tax-exempt)</span>
              )}
            </label>
          </div>

          {/* Category & Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#d7b73f]/40"
                placeholder="e.g. Brakes, Engine"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Notes</label>
              <input
                type="text"
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
                className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#d7b73f]/40"
                placeholder="Optional notes"
              />
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-full bg-[#d7b73f] px-5 py-2 text-sm font-semibold text-black hover:bg-[#c5a838]"
          >
            {item ? 'Update' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Complete Modal ───────────────────────────────────────────────────

function CompleteModal({
  mode,
  customer,
  vehicleId,
  existingROs,
  roMode,
  setRoMode,
  selectedRoId,
  setSelectedRoId,
  isCompleting,
  onConfirm,
  onClose,
  total,
  itemCount,
}: {
  mode: 'complete' | 'order';
  customer: any;
  vehicleId: string;
  existingROs: any[];
  roMode: 'new' | 'existing';
  setRoMode: (m: 'new' | 'existing') => void;
  selectedRoId: string;
  setSelectedRoId: (id: string) => void;
  isCompleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
  total: number;
  itemCount: number;
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg border border-white/10 bg-black/95 p-6 backdrop-blur mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold" style={{ color: '#d7b73f' }}>
            {mode === 'order' ? 'Complete & Order Parts' : 'Complete Estimate'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="mb-4 rounded-lg border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-300">{itemCount} items</span>
            <span className="font-bold" style={{ color: '#d7b73f' }}>${total.toFixed(2)}</span>
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm font-semibold text-slate-300">Link to Repair Order</label>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setRoMode('new')}
              className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${
                roMode === 'new'
                  ? 'bg-[#d7b73f] text-black'
                  : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              Create New RO
            </button>
            <button
              onClick={() => setRoMode('existing')}
              className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${
                roMode === 'existing'
                  ? 'bg-[#d7b73f] text-black'
                  : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              Link Existing
            </button>
          </div>

          {roMode === 'existing' && (
            <select
              value={selectedRoId}
              onChange={(e) => setSelectedRoId(e.target.value)}
              className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#d7b73f]/40"
            >
              <option value="">Select a repair order...</option>
              {existingROs.map((ro: any) => (
                <option key={ro.repairOrder.id} value={ro.repairOrder.id}>
                  {ro.repairOrder.status} — {ro.repairOrder.service_type || 'No service type'} ({ro.customer?.first_name} {ro.customer?.last_name})
                </option>
              ))}
            </select>
          )}

          {roMode === 'new' && !customer && (
            <div className="rounded border border-red-500/20 bg-red-500/5 p-2 text-xs text-red-300">
              Look up a customer first to create a new repair order.
            </div>
          )}
        </div>

        {mode === 'order' && (
          <div className="mb-4 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-sm text-blue-300">
            Parts with pricing will be marked as "To Order" and available for ordering when PartsTech is connected.
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10"
            disabled={isCompleting}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={
              isCompleting ||
              (roMode === 'new' && !customer) ||
              (roMode === 'existing' && !selectedRoId)
            }
            className="rounded-full bg-[#d7b73f] px-5 py-2 text-sm font-semibold text-black hover:bg-[#c5a838] disabled:opacity-50"
          >
            {isCompleting ? 'Completing...' : mode === 'order' ? 'Complete & Order' : 'Complete'}
          </button>
        </div>
      </div>
    </div>
  );
}
