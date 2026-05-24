import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { LineItem } from '@/types';

export const GET = async (req: NextRequest) => {
  const repairOrderId = req.nextUrl.searchParams.get('repair_order_id');

  if (!repairOrderId) {
    return NextResponse.json({ error: 'repair_order_id is required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('line_items')
      .select('*')
      .eq('repair_order_id', repairOrderId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Calculate totals (quantity only applies to parts, not labor)
    const lineItems = data as LineItem[];
    const totalCost = lineItems.reduce((sum, item) => {
      const partsCost = item.parts_cost * item.quantity;
      const laborCost = item.labor_cost;
      return sum + partsCost + laborCost;
    }, 0);
    const totalPrice = lineItems.reduce((sum, item) => {
      const partsPrice = item.parts_price * item.quantity;
      const laborPrice = item.labor_price;
      return sum + partsPrice + laborPrice;
    }, 0);
    // Sum prices for taxable items only (used by tax calculation in the UI)
    const taxableTotal = lineItems.reduce((sum, item) => {
      if (item.taxable === false) return sum;
      const partsPrice = item.parts_price * item.quantity;
      const laborPrice = item.labor_price;
      return sum + partsPrice + laborPrice;
    }, 0);
    const totalProfit = totalPrice - totalCost;
    const profitMargin = totalPrice > 0 ? (totalProfit / totalPrice) * 100 : 0;

    return NextResponse.json({
      data: {
        line_items: lineItems,
        total_cost: totalCost,
        total_price: totalPrice,
        taxable_total: taxableTotal,
        total_profit: totalProfit,
        profit_margin: profitMargin,
      },
    });
  } catch (err: any) {
    console.error('[line-items] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch line items' }, { status: 500 });
  }
};

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { 
      repair_order_id, 
      description, 
      quantity,
      parts_cost,
      parts_price,
      labor_hours,
      labor_rate,
      labor_cost,
      labor_price,
      part_number,
      supplier,
      source,
      condition,
      category, 
      notes,
      taxable,
    } = body;

    if (!repair_order_id || !description) {
      return NextResponse.json(
        { error: 'repair_order_id and description are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('line_items')
      .insert({
        repair_order_id,
        description,
        quantity: quantity || 1,
        parts_cost: parts_cost || 0,
        parts_price: parts_price || 0,
        labor_hours: labor_hours || 0,
        labor_rate: labor_rate || 0,
        labor_cost: labor_cost || 0,
        labor_price: labor_price || 0,
        part_number: part_number || null,
        supplier: supplier || null,
        source: source || 'manual',
        condition: condition || null,
        category: category || null,
        notes: notes || null,
        taxable: taxable !== false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    console.error('[line-items] POST error:', err);
    return NextResponse.json({ error: 'Failed to create line item' }, { status: 500 });
  }
};
