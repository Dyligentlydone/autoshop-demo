import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/estimates/presets/:id
export const GET = async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await ctx.params;

    const { data, error } = await supabaseAdmin
      .from('estimate_presets')
      .select('*, estimate_preset_items(*)')
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[estimate-presets] GET by id error:', err);
    return NextResponse.json({ error: 'Failed to fetch preset' }, { status: 500 });
  }
};

// PATCH /api/estimates/presets/:id - update preset and optionally replace items
export const PATCH = async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await ctx.params;
    const body = await req.json();

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabaseAdmin
        .from('estimate_presets')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    }

    // Replace items if provided
    if (body.items && Array.isArray(body.items)) {
      // Delete existing items
      await supabaseAdmin
        .from('estimate_preset_items')
        .delete()
        .eq('preset_id', id);

      // Insert new items
      if (body.items.length > 0) {
        const items = body.items.map((item: any, idx: number) => ({
          preset_id: id,
          description: item.description || '',
          quantity: item.quantity || 1,
          parts_cost: item.parts_cost || 0,
          parts_price: item.parts_price || 0,
          labor_hours: item.labor_hours || 0,
          labor_rate: item.labor_rate || 0,
          labor_cost: item.labor_cost || 0,
          labor_price: item.labor_price || 0,
          part_number: item.part_number || null,
          supplier: item.supplier || null,
          source: item.source || 'manual',
          category: item.category || null,
          notes: item.notes || null,
          taxable: item.taxable !== false,
          sort_order: item.sort_order ?? idx,
        }));

        const { error: itemsError } = await supabaseAdmin
          .from('estimate_preset_items')
          .insert(items);

        if (itemsError) {
          console.error('[estimate-presets] items replace error:', itemsError);
        }
      }
    }

    // Return updated preset with items
    const { data: full } = await supabaseAdmin
      .from('estimate_presets')
      .select('*, estimate_preset_items(*)')
      .eq('id', id)
      .single();

    return NextResponse.json({ data: full });
  } catch (err: any) {
    console.error('[estimate-presets] PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update preset' }, { status: 500 });
  }
};

// DELETE /api/estimates/presets/:id
export const DELETE = async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await ctx.params;

    const { error } = await supabaseAdmin
      .from('estimate_presets')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ message: 'Preset deleted' });
  } catch (err: any) {
    console.error('[estimate-presets] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete preset' }, { status: 500 });
  }
};
