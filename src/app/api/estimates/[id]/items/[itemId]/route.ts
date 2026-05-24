import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Helper to recalculate estimate totals
const recalcEstimateTotals = async (estimateId: string) => {
  const { data: items } = await supabaseAdmin
    .from('estimate_items')
    .select('*')
    .eq('estimate_id', estimateId);

  if (!items) return;

  const subtotal = items.reduce((sum, item) => {
    const partsPrice = (item.parts_price || 0) * (item.quantity || 1);
    const laborPrice = item.labor_price || 0;
    return sum + partsPrice + laborPrice;
  }, 0);

  // Subtotal of only taxable items — used for tax calculation
  const taxableSubtotal = items.reduce((sum, item) => {
    if (item.taxable === false) return sum;
    const partsPrice = (item.parts_price || 0) * (item.quantity || 1);
    const laborPrice = item.labor_price || 0;
    return sum + partsPrice + laborPrice;
  }, 0);

  const { data: taxRow } = await supabaseAdmin
    .from('shop_settings')
    .select('value')
    .eq('key', 'tax')
    .single();

  let taxRate = 0;
  let taxEnabled = false;
  if (taxRow?.value) {
    const t = typeof taxRow.value === 'string' ? JSON.parse(taxRow.value) : taxRow.value;
    taxRate = t?.rate || 0;
    taxEnabled = t?.enabled ?? false;
  }

  const taxAmount = taxEnabled ? taxableSubtotal * (taxRate / 100) : 0;
  const total = subtotal + taxAmount;

  await supabaseAdmin
    .from('estimates')
    .update({ subtotal, tax_amount: taxAmount, total })
    .eq('id', estimateId);
};

// PATCH /api/estimates/:id/items/:itemId - update an estimate item
export const PATCH = async (
  req: NextRequest,
  ctx: { params: Promise<{ id: string; itemId: string }> }
) => {
  try {
    const { id, itemId } = await ctx.params;
    const body = await req.json();

    const updateData: any = {};
    const fields = [
      'description', 'quantity', 'parts_cost', 'parts_price',
      'labor_hours', 'labor_rate', 'labor_cost', 'labor_price',
      'part_number', 'supplier', 'source', 'condition', 'order_status',
      'category', 'notes', 'taxable', 'sort_order',
    ];

    for (const f of fields) {
      if (body[f] !== undefined) updateData[f] = body[f];
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('estimate_items')
      .update(updateData)
      .eq('id', itemId)
      .eq('estimate_id', id)
      .select()
      .single();

    if (error) throw error;

    await recalcEstimateTotals(id);

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[estimate-items] PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update estimate item' }, { status: 500 });
  }
};

// DELETE /api/estimates/:id/items/:itemId - remove an estimate item
export const DELETE = async (
  req: NextRequest,
  ctx: { params: Promise<{ id: string; itemId: string }> }
) => {
  try {
    const { id, itemId } = await ctx.params;

    const { error } = await supabaseAdmin
      .from('estimate_items')
      .delete()
      .eq('id', itemId)
      .eq('estimate_id', id);

    if (error) throw error;

    await recalcEstimateTotals(id);

    return NextResponse.json({ message: 'Item deleted' });
  } catch (err: any) {
    console.error('[estimate-items] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete estimate item' }, { status: 500 });
  }
};
