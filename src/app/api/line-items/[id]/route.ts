import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const PATCH = async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  try {
    const body = await req.json();
    const { id } = await ctx.params;

    const updateData: any = {};
    if (body.description !== undefined) updateData.description = body.description;
    if (body.quantity !== undefined) updateData.quantity = body.quantity;
    if (body.parts_cost !== undefined) updateData.parts_cost = body.parts_cost;
    if (body.parts_price !== undefined) updateData.parts_price = body.parts_price;
    if (body.labor_hours !== undefined) updateData.labor_hours = body.labor_hours;
    if (body.labor_rate !== undefined) updateData.labor_rate = body.labor_rate;
    if (body.labor_cost !== undefined) updateData.labor_cost = body.labor_cost;
    if (body.labor_price !== undefined) updateData.labor_price = body.labor_price;
    if (body.part_number !== undefined) updateData.part_number = body.part_number;
    if (body.supplier !== undefined) updateData.supplier = body.supplier;
    if (body.source !== undefined) updateData.source = body.source;
    if (body.condition !== undefined) updateData.condition = body.condition;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.taxable !== undefined) updateData.taxable = body.taxable;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('line_items')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[line-items] PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update line item' }, { status: 500 });
  }
};

export const DELETE = async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await ctx.params;

    const { error } = await supabaseAdmin
      .from('line_items')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ message: 'Line item deleted' });
  } catch (err: any) {
    console.error('[line-items] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete line item' }, { status: 500 });
  }
};
