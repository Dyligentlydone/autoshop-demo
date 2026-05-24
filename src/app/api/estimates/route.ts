import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/estimates - list estimates (optionally filter by status, customer, vehicle)
export const GET = async (req: NextRequest) => {
  try {
    const status = req.nextUrl.searchParams.get('status');
    const customerId = req.nextUrl.searchParams.get('customer_id');
    const vehicleId = req.nextUrl.searchParams.get('vehicle_id');

    let query = supabaseAdmin
      .from('estimates')
      .select('*, estimate_items(*)')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (customerId) query = query.eq('customer_id', customerId);
    if (vehicleId) query = query.eq('vehicle_id', vehicleId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    console.error('[estimates] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch estimates' }, { status: 500 });
  }
};

// POST /api/estimates - create a new estimate
export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();

    const { data, error } = await supabaseAdmin
      .from('estimates')
      .insert({
        customer_id: body.customer_id || null,
        vehicle_id: body.vehicle_id || null,
        status: 'draft',
        notes: body.notes || null,
        subtotal: 0,
        tax_amount: 0,
        total: 0,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    console.error('[estimates] POST error:', err);
    return NextResponse.json({ error: 'Failed to create estimate' }, { status: 500 });
  }
};
