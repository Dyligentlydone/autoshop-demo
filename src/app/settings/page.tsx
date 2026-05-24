'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { ShopSettings } from '@/types';
import { useEstimatePresets, useCreateEstimatePreset, useUpdateEstimatePreset, useDeleteEstimatePreset } from '@/hooks/use-estimate-presets';
import { Plus, Trash2, Edit2 } from 'lucide-react';

export default function SettingsPage() {
  const queryClient = useQueryClient();

  // Fetch settings
  const { data: settings, isLoading } = useQuery<{ data: ShopSettings }>({
    queryKey: ['shop-settings'],
    queryFn: async () => {
      return await apiClient.get<{ data: ShopSettings }>('/api/settings');
    },
  });

  // Update settings mutation
  const updateSettings = useMutation({
    mutationFn: async (data: Partial<ShopSettings>) => {
      return await apiClient.post('/api/settings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-settings'] });
    },
  });

  const [laborRate, setLaborRate] = useState('100');
  const [taxRate, setTaxRate] = useState('6.0');
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [standardMarkup, setStandardMarkup] = useState('30');
  const [premiumMarkup, setPremiumMarkup] = useState('50');
  const [companyName, setCompanyName] = useState('AutoShop Demo');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [quoteValidDays, setQuoteValidDays] = useState('30');
  const [quoteTerms, setQuoteTerms] = useState('All work guaranteed for 90 days or 3,000 miles.');
  const [paymentTerms, setPaymentTerms] = useState('Payment due upon completion.');

  // Load settings when data arrives (using useEffect to prevent infinite loop)
  useEffect(() => {
    if (settings?.data) {
      const s = settings.data;
      setLaborRate(s.labor_rates.hourly_rate.toString());
      setTaxRate(s.tax.rate.toString());
      setTaxEnabled(s.tax.enabled);
      setStandardMarkup(s.markup_presets.standard.toString());
      setPremiumMarkup(s.markup_presets.premium.toString());
      setCompanyName(s.company_info.name);
      setCompanyAddress(s.company_info.address);
      setCompanyPhone(s.company_info.phone);
      setCompanyEmail(s.company_info.email);
      setQuoteValidDays(s.quote_settings.valid_days.toString());
      setQuoteTerms(s.quote_settings.terms);
      setPaymentTerms(s.quote_settings.payment_terms);
    }
  }, [settings?.data]);

  const handleSave = () => {
    updateSettings.mutate({
      labor_rates: {
        hourly_rate: parseFloat(laborRate) || 100,
        default_hours: 1,
      },
      tax: {
        enabled: taxEnabled,
        rate: parseFloat(taxRate) || 0,
      },
      markup_presets: {
        standard: parseFloat(standardMarkup) || 30,
        premium: parseFloat(premiumMarkup) || 50,
      },
      company_info: {
        name: companyName,
        address: companyAddress,
        phone: companyPhone,
        email: companyEmail,
        logo_url: '',
      },
      quote_settings: {
        valid_days: parseInt(quoteValidDays) || 30,
        terms: quoteTerms,
        payment_terms: paymentTerms,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-slate-400">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-[#d7b73f]">Settings</h1>
          <p className="mt-2 text-slate-400">Configure your shop settings, pricing, and quote templates</p>
        </div>

        {/* Labor Rates */}
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
          <h2 className="mb-4 text-xl font-bold text-slate-100">Labor Rates</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">Hourly Rate ($)</label>
              <input
                type="number"
                step="0.01"
                value={laborRate}
                onChange={(e) => setLaborRate(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-4 py-2 text-slate-100"
                placeholder="100.00"
              />
              <p className="mt-1 text-xs text-slate-500">Default labor rate per hour</p>
            </div>
          </div>
        </div>

        {/* Tax Settings */}
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
          <h2 className="mb-4 text-xl font-bold text-slate-100">Tax Settings</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={taxEnabled}
                onChange={(e) => setTaxEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-[#d7b73f]"
              />
              <label className="text-sm font-semibold text-slate-300">Enable Tax</label>
            </div>
            {taxEnabled && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">Tax Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-800 px-4 py-2 text-slate-100"
                  placeholder="6.0"
                />
                <p className="mt-1 text-xs text-slate-500">Sales tax percentage</p>
              </div>
            )}
          </div>
        </div>

        {/* Markup Presets */}
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
          <h2 className="mb-4 text-xl font-bold text-slate-100">Markup Presets</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">Standard Markup (%)</label>
              <input
                type="number"
                step="1"
                value={standardMarkup}
                onChange={(e) => setStandardMarkup(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-4 py-2 text-slate-100"
                placeholder="30"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">Premium Markup (%)</label>
              <input
                type="number"
                step="1"
                value={premiumMarkup}
                onChange={(e) => setPremiumMarkup(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-4 py-2 text-slate-100"
                placeholder="50"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">Quick markup buttons in the estimate calculator</p>
        </div>

        {/* Company Info */}
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
          <h2 className="mb-4 text-xl font-bold text-slate-100">Company Information</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-4 py-2 text-slate-100"
                placeholder="AutoShop Demo"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">Address</label>
              <input
                type="text"
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-4 py-2 text-slate-100"
                placeholder="123 Main St, City, State 12345"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">Phone</label>
                <input
                  type="tel"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-800 px-4 py-2 text-slate-100"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">Email</label>
                <input
                  type="email"
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-800 px-4 py-2 text-slate-100"
                  placeholder="info@acmetire.com"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quote Settings */}
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
          <h2 className="mb-4 text-xl font-bold text-slate-100">Quote Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">Valid For (days)</label>
              <input
                type="number"
                value={quoteValidDays}
                onChange={(e) => setQuoteValidDays(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-4 py-2 text-slate-100"
                placeholder="30"
              />
              <p className="mt-1 text-xs text-slate-500">How many days the quote is valid</p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">Terms & Conditions</label>
              <textarea
                value={quoteTerms}
                onChange={(e) => setQuoteTerms(e.target.value)}
                rows={3}
                className="w-full rounded border border-slate-700 bg-slate-800 px-4 py-2 text-slate-100"
                placeholder="All work guaranteed for 90 days or 3,000 miles."
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">Payment Terms</label>
              <textarea
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                rows={2}
                className="w-full rounded border border-slate-700 bg-slate-800 px-4 py-2 text-slate-100"
                placeholder="Payment due upon completion."
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          {updateSettings.isError && (
            <div className="text-sm text-red-400">Failed to save settings</div>
          )}
          {updateSettings.isSuccess && (
            <div className="text-sm text-green-400">Settings saved!</div>
          )}
          <button
            onClick={handleSave}
            disabled={updateSettings.isPending}
            className="rounded-lg bg-[#d7b73f] px-6 py-3 font-semibold text-black hover:bg-[#c5a838] disabled:opacity-50"
          >
            {updateSettings.isPending ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {/* Quick Quote Presets */}
        <QuickQuotePresetsSection />
      </div>
    </div>
  );
}

// ─── Quick Quote Presets Section ─────────────────────────────────────

type PresetItemForm = {
  description: string;
  quantity: number;
  parts_cost: number;
  parts_price: number;
  labor_hours: number;
  labor_rate: number;
  labor_cost: number;
  labor_price: number;
  taxable: boolean;
};

const emptyPresetItem = (): PresetItemForm => ({
  description: '',
  quantity: 1,
  parts_cost: 0,
  parts_price: 0,
  labor_hours: 0,
  labor_rate: 100,
  labor_cost: 0,
  labor_price: 0,
  taxable: true,
});

function QuickQuotePresetsSection() {
  const presetsQuery = useEstimatePresets();
  const createPreset = useCreateEstimatePreset();
  const updatePreset = useUpdateEstimatePreset();
  const deletePreset = useDeleteEstimatePreset();

  const presets = (presetsQuery.data as any)?.data || [];

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('');
  const [presetDescription, setPresetDescription] = useState('');
  const [presetCategory, setPresetCategory] = useState('');
  const [presetItems, setPresetItems] = useState<PresetItemForm[]>([emptyPresetItem()]);

  const resetForm = () => {
    setPresetName('');
    setPresetDescription('');
    setPresetCategory('');
    setPresetItems([emptyPresetItem()]);
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (preset: any) => {
    setEditingId(preset.id);
    setPresetName(preset.name);
    setPresetDescription(preset.description || '');
    setPresetCategory(preset.category || '');
    const items = (preset.estimate_preset_items || []).map((pi: any) => ({
      description: pi.description || '',
      quantity: pi.quantity || 1,
      parts_cost: pi.parts_cost || 0,
      parts_price: pi.parts_price || 0,
      labor_hours: pi.labor_hours || 0,
      labor_rate: pi.labor_rate || 100,
      labor_cost: pi.labor_cost || 0,
      labor_price: pi.labor_price || 0,
      taxable: pi.taxable !== false,
    }));
    setPresetItems(items.length > 0 ? items : [emptyPresetItem()]);
    setShowForm(true);
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      alert('Preset name is required');
      return;
    }

    const validItems = presetItems
      .filter((i) => i.description.trim())
      .map((i) => ({
        ...i,
        quantity: parseFloat(String(i.quantity)) || 1,
        parts_cost: parseFloat(String(i.parts_cost)) || 0,
        parts_price: parseFloat(String(i.parts_price)) || 0,
        labor_cost: (parseFloat(String(i.labor_hours)) || 0) * (parseFloat(String(i.labor_rate)) || 0),
        labor_price: (parseFloat(String(i.labor_hours)) || 0) * (parseFloat(String(i.labor_rate)) || 0),
        taxable: i.taxable !== false,
      }));

    const payload = {
      name: presetName.trim(),
      description: presetDescription.trim() || null,
      category: presetCategory.trim() || null,
      items: validItems,
    };

    try {
      if (editingId) {
        await updatePreset.mutateAsync({ id: editingId, ...payload });
      } else {
        await createPreset.mutateAsync(payload);
      }
      resetForm();
    } catch (err: any) {
      alert('Failed to save preset: ' + (err.message || 'Unknown error'));
    }
  };

  const handleDeletePreset = async (id: string) => {
    if (!confirm('Delete this preset?')) return;
    try {
      await deletePreset.mutateAsync(id);
    } catch (err: any) {
      alert('Failed to delete preset');
    }
  };

  const updateItem = (idx: number, field: keyof PresetItemForm, value: any) => {
    setPresetItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const removeItemRow = (idx: number) => {
    setPresetItems((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Quick Quote Presets</h2>
          <p className="mt-1 text-xs text-slate-500">
            Pre-configured jobs for one-click estimate generation
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 rounded bg-[#d7b73f] px-4 py-2 text-sm font-semibold text-black hover:bg-[#c5a838]"
          >
            <Plus size={16} /> New Preset
          </button>
        )}
      </div>

      {/* Existing presets list */}
      {!showForm && presets.length === 0 && (
        <div className="py-6 text-center text-sm text-slate-500">
          No presets yet. Create one to enable quick quotes.
        </div>
      )}

      {!showForm && presets.length > 0 && (
        <div className="space-y-2">
          {presets.map((preset: any) => {
            const itemCount = preset.estimate_preset_items?.length || 0;
            const totalPrice = (preset.estimate_preset_items || []).reduce((sum: number, pi: any) => {
              return sum + (pi.labor_price || 0) + ((pi.parts_price || 0) * (pi.quantity || 1));
            }, 0);

            return (
              <div
                key={preset.id}
                className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 p-3"
              >
                <div>
                  <div className="font-medium text-slate-100">{preset.name}</div>
                  <div className="text-xs text-slate-400">
                    {itemCount} item{itemCount !== 1 ? 's' : ''} · ${totalPrice.toFixed(2)}
                    {preset.category && <span className="ml-2 text-slate-500">({preset.category})</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(preset)}
                    className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDeletePreset(preset.id)}
                    className="rounded p-1.5 text-slate-400 hover:bg-red-500/20 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <div className="space-y-4 rounded-lg border border-[#d7b73f]/20 bg-[#d7b73f]/5 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#d7b73f]">
              {editingId ? 'Edit Preset' : 'New Preset'}
            </h3>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Name *</label>
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                placeholder="e.g. Oil Change"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Description</label>
              <input
                type="text"
                value={presetDescription}
                onChange={(e) => setPresetDescription(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                placeholder="Optional description"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Category</label>
              <input
                type="text"
                value={presetCategory}
                onChange={(e) => setPresetCategory(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                placeholder="e.g. Maintenance"
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">Line Items</label>
              <button
                type="button"
                onClick={() => setPresetItems((prev) => [...prev, emptyPresetItem()])}
                className="flex items-center gap-1 text-xs text-[#d7b73f] hover:underline"
              >
                <Plus size={12} /> Add row
              </button>
            </div>

            <div className="space-y-2">
              {presetItems.map((item, idx) => {
                const laborTotal = (parseFloat(String(item.labor_hours)) || 0) * (parseFloat(String(item.labor_rate)) || 0);
                const partsTotal = (parseFloat(String(item.parts_price)) || 0) * (parseFloat(String(item.quantity)) || 1);
                const lineTotal = laborTotal + partsTotal;

                return (
                  <div key={idx} className="rounded border border-slate-700 bg-slate-800 p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <label className="mb-0.5 block text-xs text-slate-500">Description</label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(idx, 'description', e.target.value)}
                          className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                          placeholder="e.g. Oil Change"
                        />
                      </div>
                      <div className="pt-4">
                        {presetItems.length > 1 && (
                          <button
                            onClick={() => removeItemRow(idx)}
                            className="rounded p-1 text-slate-400 hover:bg-red-500/20 hover:text-red-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-2">
                        <label className="mb-0.5 block text-xs text-slate-500">Qty</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity || ''}
                          onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 1)}
                          className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                          placeholder="1"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="mb-0.5 block text-xs text-slate-500">Parts Cost</label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.parts_cost || ''}
                          onChange={(e) => updateItem(idx, 'parts_cost', parseFloat(e.target.value) || 0)}
                          className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="mb-0.5 block text-xs text-slate-500">Parts Price</label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.parts_price || ''}
                          onChange={(e) => updateItem(idx, 'parts_price', parseFloat(e.target.value) || 0)}
                          className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="mb-0.5 block text-xs text-slate-500">Labor Hrs</label>
                        <input
                          type="number"
                          step="0.25"
                          value={item.labor_hours || ''}
                          onChange={(e) => updateItem(idx, 'labor_hours', parseFloat(e.target.value) || 0)}
                          className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                          placeholder="0"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="mb-0.5 block text-xs text-slate-500">Rate ($/hr)</label>
                        <input
                          type="number"
                          step="1"
                          value={item.labor_rate || ''}
                          onChange={(e) => updateItem(idx, 'labor_rate', parseFloat(e.target.value) || 0)}
                          className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                          placeholder="100"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="mb-0.5 block text-xs text-slate-500">Line Total</label>
                        <div className="text-xs font-medium text-[#d7b73f] py-1">
                          ${lineTotal.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        id={`preset-taxable-${idx}`}
                        type="checkbox"
                        checked={item.taxable !== false}
                        onChange={(e) => updateItem(idx, 'taxable', e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 accent-[#d7b73f]"
                      />
                      <label
                        htmlFor={`preset-taxable-${idx}`}
                        className="text-xs text-slate-400 cursor-pointer select-none"
                      >
                        Taxable
                        {item.taxable === false && (
                          <span className="ml-1 text-[10px] text-amber-400">(tax-exempt)</span>
                        )}
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={resetForm}
              className="rounded border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSavePreset}
              disabled={createPreset.isPending || updatePreset.isPending}
              className="rounded bg-[#d7b73f] px-4 py-2 text-sm font-semibold text-black hover:bg-[#c5a838] disabled:opacity-50"
            >
              {(createPreset.isPending || updatePreset.isPending) ? 'Saving...' : editingId ? 'Update Preset' : 'Create Preset'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
