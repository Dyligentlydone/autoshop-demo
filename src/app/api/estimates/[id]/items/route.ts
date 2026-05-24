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

  // Get shop settings for tax
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

// GET /api/estimates/:id/items - list items for an estimate
export const GET = async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await ctx.params;

    const { data, error } = await supabaseAdmin
      .from('estimate_items')
      .select('*')
      .eq('estimate_id', id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    console.error('[estimate-items] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch estimate items' }, { status: 500 });
  }
};

// POST /api/estimates/:id/items - add item to estimate
export const POST = async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await ctx.params;
    const body = await req.json();

    if (!body.description) {
      return NextResponse.json({ error: 'description is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('estimate_items')
      .insert({
        estimate_id: id,
        description: body.description,
        quantity: body.quantity || 1,
        parts_cost: body.parts_cost || 0,
        parts_price: body.parts_price || 0,
        labor_hours: body.labor_hours || 0,
        labor_rate: body.labor_rate || 0,
        labor_cost: body.labor_cost || 0,
        labor_price: body.labor_price || 0,
        part_number: body.part_number || null,
        supplier: body.supplier || null,
        source: body.source || 'manual',
        condition: body.condition || null,
        order_status: body.order_status || 'not_ordered',
        category: body.category || null,
        notes: body.notes || null,
        taxable: body.taxable !== false,
        sort_order: body.sort_order || 0,
      })
      .select()
      .single();

    if (error) throw error;

    // Recalculate totals
    await recalcEstimateTotals(id);

    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    console.error('[estimate-items] POST error:', err);
    return NextResponse.json({ error: 'Failed to add estimate item' }, { status: 500 });
  }
};
