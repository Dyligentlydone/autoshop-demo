import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/estimates/:id - get single estimate with items
export const GET = async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await ctx.params;

    const { data, error } = await supabaseAdmin
      .from('estimates')
      .select('*, estimate_items(*)')
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[estimates] GET by id error:', err);
    return NextResponse.json({ error: 'Failed to fetch estimate' }, { status: 500 });
  }
};

// PATCH /api/estimates/:id - update estimate metadata
export const PATCH = async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await ctx.params;
    const body = await req.json();

    const updateData: any = {};
    if (body.customer_id !== undefined) updateData.customer_id = body.customer_id || null;
    if (body.vehicle_id !== undefined) updateData.vehicle_id = body.vehicle_id || null;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.subtotal !== undefined) updateData.subtotal = body.subtotal;
    if (body.tax_amount !== undefined) updateData.tax_amount = body.tax_amount;
    if (body.total !== undefined) updateData.total = body.total;
    if (body.repair_order_id !== undefined) updateData.repair_order_id = body.repair_order_id;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('estimates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[estimates] PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update estimate' }, { status: 500 });
  }
};

// DELETE /api/estimates/:id - delete estimate and its items
export const DELETE = async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await ctx.params;

    const { error } = await supabaseAdmin
      .from('estimates')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ message: 'Estimate deleted' });
  } catch (err: any) {
    console.error('[estimates] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete estimate' }, { status: 500 });
  }
};
