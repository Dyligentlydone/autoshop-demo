import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/estimates/presets - list all active presets with their items
export const GET = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('estimate_presets')
      .select('*, estimate_preset_items(*)')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    console.error('[estimate-presets] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch presets' }, { status: 500 });
  }
};

// POST /api/estimates/presets - create a new preset with items
export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();

    if (!body.name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    // Create the preset
    const { data: preset, error: presetError } = await supabaseAdmin
      .from('estimate_presets')
      .insert({
        name: body.name,
        description: body.description || null,
        category: body.category || null,
        is_active: body.is_active ?? true,
        sort_order: body.sort_order || 0,
      })
      .select()
      .single();

    if (presetError) throw presetError;

    // Create preset items if provided
    if (body.items && Array.isArray(body.items) && body.items.length > 0) {
      const items = body.items.map((item: any, idx: number) => ({
        preset_id: preset.id,
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
        console.error('[estimate-presets] items insert error:', itemsError);
      }
    }

    // Return preset with items
    const { data: full } = await supabaseAdmin
      .from('estimate_presets')
      .select('*, estimate_preset_items(*)')
      .eq('id', preset.id)
      .single();

    return NextResponse.json({ data: full }, { status: 201 });
  } catch (err: any) {
    console.error('[estimate-presets] POST error:', err);
    return NextResponse.json({ error: 'Failed to create preset' }, { status: 500 });
  }
};
