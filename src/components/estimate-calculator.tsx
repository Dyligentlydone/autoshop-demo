'use client';

import { useState } from 'react';
import { useLineItems, useCreateLineItem, useUpdateLineItem, useDeleteLineItem } from '@/hooks/use-line-items';
import { useShopSettings } from '@/hooks/use-shop-settings';
import { useEstimatePresets } from '@/hooks/use-estimate-presets';
import { useRepairOrder } from '@/hooks/use-repair-order';
import { useVehicle } from '@/hooks/use-vehicle';
import { useCustomer } from '@/hooks/use-customer';
import { LineItem, ShopSettings } from '@/types';
import { Plus, Trash2, Edit2, FileDown, ExternalLink } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { QuotePDF } from './quote-pdf';

type PartSource = 'manual' | 'aftermarket' | 'oem';

type EstimateCalculatorProps = {
  repairOrderId: string;
};

export default function EstimateCalculator({ repairOrderId }: EstimateCalculatorProps) {
  const { data, isLoading } = useLineItems(repairOrderId);
  const { data: settingsData } = useShopSettings();
  const createLineItem = useCreateLineItem();
  const updateLineItem = useUpdateLineItem();
  const deleteLineItem = useDeleteLineItem();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<LineItem | null>(null);
  const [showPresetsDropdown, setShowPresetsDropdown] = useState(false);

  const presetsQuery = useEstimatePresets();
  const presets = (presetsQuery.data as any)?.data || [];

  const summary = data?.data;
  const lineItems = summary?.line_items || [];
  const settings = settingsData?.data;
  const laborRate = settings?.labor_rates?.hourly_rate || 100;

  // Fetch RO, vehicle, customer for PDF
  const { data: repairOrder } = useRepairOrder(repairOrderId);
  const vehicleId = (repairOrder as any)?.vehicle_id || '';
  const customerId = (repairOrder as any)?.customer_id || '';
  const { data: vehicleData } = useVehicle(vehicleId);
  const { data: customerData } = useCustomer(customerId);
  const vehicle = (vehicleData as any)?.data;
  const customer = (customerData as any)?.data;

  const applyPreset = async (presetId: string) => {
    const preset = presets.find((p: any) => p.id === presetId);
    if (!preset?.estimate_preset_items?.length) return;

    for (const pi of preset.estimate_preset_items) {
      const hours = pi.labor_hours || 0;
      const rate = pi.labor_rate || laborRate;
      const laborPrice = pi.labor_price || (hours * rate);
      const qty = pi.quantity || 1;
      const partsCost = pi.parts_cost || 0;
      const partsPrice = pi.parts_price || 0;

      await createLineItem.mutateAsync({
        repair_order_id: repairOrderId,
        description: pi.description,
        quantity: qty,
        parts_cost: partsCost,
        parts_price: partsPrice,
        labor_hours: hours,
        labor_rate: rate,
        labor_cost: 0,
        labor_price: laborPrice,
        taxable: pi.taxable !== false,
      });
    }
    setShowPresetsDropdown(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this line item?')) {
      deleteLineItem.mutate({ id, repairOrderId });
    }
  };

  const handleDownloadPDF = async () => {
    if (lineItems.length === 0) {
      alert('Please add line items before generating a quote.');
      return;
    }

    try {
      const vehicleInfo = vehicle
        ? `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.trim()
        : undefined;
      const customerName = customer
        ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
        : undefined;
      const estCompletion = (repairOrder as any)?.estimated_completion
        ? new Date((repairOrder as any).estimated_completion).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : undefined;

      const blob = await pdf(
        <QuotePDF
          lineItems={lineItems}
          settings={settings}
          repairOrderId={repairOrderId}
          customerName={customerName}
          vehicleInfo={vehicleInfo}
          vin={vehicle?.vin || undefined}
          licensePlate={vehicle?.license_plate || undefined}
          estimatedCompletion={estCompletion}
          jobDescription={(repairOrder as any)?.job_description || (repairOrder as any)?.service_type || undefined}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `quote-${repairOrderId.slice(0, 8)}-${Date.now()}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  if (isLoading) {
    return <div className="text-slate-400">Loading estimate...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#d7b73f]">Parts & Labor Estimate</h2>
        <div className="flex gap-2">
          {lineItems.length > 0 && (
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 rounded border border-[#d7b73f] bg-transparent px-4 py-2 text-sm font-semibold text-[#d7b73f] hover:bg-[#d7b73f]/10"
            >
              <FileDown size={16} />
              Download PDF
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded bg-[#d7b73f] px-4 py-2 text-sm font-semibold text-black hover:bg-[#c5a838]"
          >
            <Plus size={16} />
            Add Item
          </button>
        </div>
      </div>

      {/* Quick Quote Presets */}
      {presets.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowPresetsDropdown(!showPresetsDropdown)}
            className="flex items-center gap-2 rounded-full border border-[#d7b73f]/30 bg-[#d7b73f]/10 px-4 py-2 text-sm font-medium text-[#d7b73f] hover:bg-[#d7b73f]/20 transition"
          >
            Quick Quotes
            <svg className={`w-3 h-3 transition ${showPresetsDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {showPresetsDropdown && (
            <div className="absolute z-50 mt-1 w-64 rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
              {presets.map((preset: any) => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset.id)}
                  className="w-full px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-800 first:rounded-t-lg last:rounded-b-lg transition"
                >
                  <div className="font-medium">{preset.name}</div>
                  <div className="text-xs text-slate-500">
                    {(preset.estimate_preset_items || []).length} item{(preset.estimate_preset_items || []).length !== 1 ? 's' : ''}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Line Items Table */}
      <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-400">Description</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-400">Part #</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-400">Condition</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-400">Qty</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-400">Parts $</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-400">Labor $</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-400">Total</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-400">Profit</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-400"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {lineItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  No items added yet. Click "Add Item" to get started.
                </td>
              </tr>
            ) : (
              lineItems.map((item) => {
                const partsCost = item.parts_cost * item.quantity;
                const partsPrice = item.parts_price * item.quantity;
                const laborCost = item.labor_cost;
                const laborPrice = item.labor_price;
                const totalPrice = partsPrice + laborPrice;
                const totalCost = partsCost + laborCost;
                const profit = totalPrice - totalCost;
                const condition = (item as any).condition || '';
                
                return (
                  <tr key={item.id} className="hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-200">{item.description}</span>
                        {(item as any).taxable === false && (
                          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                            Tax-exempt
                          </span>
                        )}
                      </div>
                      {(item as any).supplier && (
                        <div className="text-xs text-slate-500">{(item as any).supplier}</div>
                      )}
                      {item.labor_hours > 0 && (
                        <div className="text-xs text-slate-500">
                          {item.labor_hours} hrs @ ${item.labor_rate}/hr
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{(item as any).part_number || '—'}</td>
                    <td className="px-4 py-3">
                      {condition ? (
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          condition === 'new' ? 'bg-green-500/15 text-green-300'
                            : condition === 'used' ? 'bg-yellow-500/15 text-yellow-300'
                            : 'bg-orange-500/15 text-orange-300'
                        }`}>
                          {condition === 'remanufactured' ? 'Reman' : condition.charAt(0).toUpperCase() + condition.slice(1)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-200">{item.quantity}</td>
                    <td className="px-4 py-3 text-right">
                      {partsPrice > 0 ? (
                        <div>
                          <div className="text-slate-200">${partsPrice.toFixed(2)}</div>
                          <div className="text-xs text-slate-500">cost: ${partsCost.toFixed(2)}</div>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {laborPrice > 0 ? (
                        <div>
                          <div className="text-slate-200">${laborPrice.toFixed(2)}</div>
                          <div className="text-xs text-slate-500">cost: ${laborCost.toFixed(2)}</div>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-100">
                      ${totalPrice.toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${profit.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingItem(item)}
                          className="text-slate-400 hover:text-[#d7b73f]"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-slate-400 hover:text-red-400"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      {lineItems.length > 0 && summary && (
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <div className="text-xs font-medium text-slate-400">Total Cost</div>
              <div className="mt-1 text-2xl font-bold text-slate-300">
                ${summary?.total_cost?.toFixed(2) || '0.00'}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-400">Subtotal</div>
              <div className="mt-1 text-2xl font-bold text-slate-100">
                ${summary?.total_price?.toFixed(2) || '0.00'}
              </div>
            </div>
            {settings?.tax?.enabled && (
              <div>
                <div className="text-xs font-medium text-slate-400">
                  Tax ({settings.tax.rate}%)
                </div>
                <div className="mt-1 text-2xl font-bold text-slate-100">
                  ${(((summary as any)?.taxable_total ?? summary?.total_price ?? 0) * (settings.tax.rate / 100)).toFixed(2)}
                </div>
                {((summary as any)?.taxable_total ?? summary?.total_price ?? 0) < (summary?.total_price ?? 0) && (
                  <div className="text-[10px] text-amber-400">
                    Some items tax-exempt
                  </div>
                )}
              </div>
            )}
            <div>
              <div className="text-xs font-medium text-slate-400">
                {settings?.tax?.enabled ? 'Total (w/ Tax)' : 'Customer Price'}
              </div>
              <div className="mt-1 text-2xl font-bold text-[#d7b73f]">
                ${settings?.tax?.enabled
                  ? ((summary?.total_price || 0) + (((summary as any)?.taxable_total ?? summary?.total_price ?? 0) * (settings.tax.rate / 100))).toFixed(2)
                  : (summary?.total_price?.toFixed(2) || '0.00')
                }
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-400">Profit</div>
              <div className="mt-1 text-2xl font-bold text-green-400">
                ${summary?.total_profit?.toFixed(2) || '0.00'}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-400">Margin</div>
              <div className="mt-1 text-2xl font-bold text-slate-400">
                {summary?.profit_margin?.toFixed(1) || '0.0'}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingItem) && (
        <LineItemModal
          repairOrderId={repairOrderId}
          item={editingItem}
          settings={settings}
          onClose={() => {
            setShowAddModal(false);
            setEditingItem(null);
          }}
        />
      )}
    </div>
  );
}

type LineItemModalProps = {
  repairOrderId: string;
  item: LineItem | null;
  settings?: ShopSettings;
  onClose: () => void;
};

function LineItemModal({ repairOrderId, item, settings, onClose }: LineItemModalProps) {
  const createLineItem = useCreateLineItem();
  const updateLineItem = useUpdateLineItem();

  const defaultLaborRate = settings?.labor_rates?.hourly_rate || 100;
  const defaultStandardMarkup = settings?.markup_presets?.standard || 30;
  const defaultPremiumMarkup = settings?.markup_presets?.premium || 50;

  const [description, setDescription] = useState(item?.description || '');
  const [partsQuantity, setPartsQuantity] = useState(item?.quantity?.toString() || '1');
  const [partsCost, setPartsCost] = useState(item?.parts_cost?.toString() || '');
  const [partsPrice, setPartsPrice] = useState(item?.parts_price?.toString() || '');
  const [laborHours, setLaborHours] = useState(item?.labor_hours?.toString() || '');
  const [laborRate, setLaborRate] = useState(item?.labor_rate?.toString() || defaultLaborRate.toString());
  const [laborCost, setLaborCost] = useState(item?.labor_cost?.toString() || '0');
  // Labor price is always computed from hours x rate

  const [partNumber, setPartNumber] = useState((item as any)?.part_number || '');
  const [supplier, setSupplier] = useState((item as any)?.supplier || '');
  const [source, setSource] = useState<PartSource>(((item as any)?.source as PartSource) || 'manual');
  const [itemNotes, setItemNotes] = useState((item as any)?.notes || '');
  const [category, setCategory] = useState((item as any)?.category || '');
  const [condition, setCondition] = useState<'new' | 'used' | 'remanufactured' | ''>((item as any)?.condition || 'new');
  const [taxable, setTaxable] = useState<boolean>((item as any)?.taxable !== false);

  const costNum = parseFloat(partsCost) || 0;

  const applyMarkup = (pct: number) => {
    if (costNum > 0) {
      setPartsPrice((costNum * (1 + pct / 100)).toFixed(2));
    }
  };

  const handleLaborHoursChange = (hours: string) => {
    setLaborHours(hours);
  };

  const handleLaborRateChange = (rate: string) => {
    setLaborRate(rate);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const hours = parseFloat(laborHours) || 0;
    const rate = parseFloat(laborRate) || 0;
    const computedLaborPrice = hours * rate;

    const data: any = {
      repair_order_id: repairOrderId,
      description,
      quantity: parseFloat(partsQuantity) || 1,
      parts_cost: parseFloat(partsCost) || 0,
      parts_price: parseFloat(partsPrice) || 0,
      labor_hours: hours,
      labor_rate: rate,
      labor_cost: parseFloat(laborCost) || 0,
      labor_price: computedLaborPrice,
      part_number: partNumber || null,
      supplier: supplier || null,
      source: source,
      condition: condition || null,
      category: category || null,
      notes: itemNotes || null,
      taxable,
    };

    if (item) {
      updateLineItem.mutate({ id: item.id, repairOrderId, ...data }, {
        onSuccess: () => onClose(),
      });
    } else {
      createLineItem.mutate(data, {
        onSuccess: () => onClose(),
      });
    }
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Description */}
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: '#d7b73f' }}>Description *</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#d7b73f]/40"
              placeholder="e.g. Front Brake Pads - Ceramic"
              required
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
                  value={partsQuantity}
                  onChange={(e) => setPartsQuantity(e.target.value)}
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
                onClick={() => applyMarkup(defaultStandardMarkup)}
                className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
              >
                +{defaultStandardMarkup}% Markup
              </button>
              <button
                type="button"
                onClick={() => applyMarkup(defaultPremiumMarkup)}
                className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
              >
                +{defaultPremiumMarkup}% Markup
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
                  onChange={(e) => handleLaborHoursChange(e.target.value)}
                  className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#d7b73f]/40"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-xs text-slate-500">Rate ($/hr)</label>
                <input
                  type="number"
                  step="1"
                  value={laborRate}
                  onChange={(e) => handleLaborRateChange(e.target.value)}
                  className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#d7b73f]/40"
                  placeholder="100"
                />
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-0.5 block text-xs text-slate-500">Labor Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={laborCost}
                  onChange={(e) => setLaborCost(e.target.value)}
                  className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#d7b73f]/40"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-xs text-slate-300">Labor Price ($)</label>
                <div className="flex items-center rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100">
                  ${((parseFloat(laborHours) || 0) * (parseFloat(laborRate) || 0)).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Category + Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#d7b73f]/40"
                placeholder="e.g. Brakes"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Notes</label>
              <input
                type="text"
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
                className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#d7b73f]/40"
                placeholder="Optional item notes"
              />
            </div>
          </div>

          {/* Taxable toggle */}
          <div className="flex items-center gap-2 rounded border border-white/10 bg-white/5 px-3 py-2">
            <input
              id="line-item-taxable"
              type="checkbox"
              checked={taxable}
              onChange={(e) => setTaxable(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-[#d7b73f]"
            />
            <label htmlFor="line-item-taxable" className="text-xs text-slate-300 cursor-pointer select-none">
              Charge sales tax on this item
              {!taxable && (
                <span className="ml-2 text-[10px] text-amber-400">(tax-exempt)</span>
              )}
            </label>
          </div>

          {/* Total Profit Preview */}
          {(costNum > 0 || (parseFloat(laborCost) || 0) > 0) && (
            <div className="rounded border border-[#d7b73f]/30 bg-[#d7b73f]/10 p-3">
              <div className="text-xs font-semibold uppercase text-[#d7b73f]">Profit Preview</div>
              <div className="mt-1 text-lg font-bold text-[#d7b73f]">
                ${(
                  ((parseFloat(partsPrice) || 0) - costNum) * (parseFloat(partsQuantity) || 1) +
                  ((parseFloat(laborHours) || 0) * (parseFloat(laborRate) || 0)) - (parseFloat(laborCost) || 0)
                ).toFixed(2)}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLineItem.isPending || updateLineItem.isPending}
              className="rounded bg-[#d7b73f] px-4 py-2 text-sm font-semibold text-black hover:bg-[#c5a838] disabled:opacity-50"
            >
              {item ? 'Update' : 'Add'} Item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
