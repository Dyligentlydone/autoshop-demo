import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const GET = async (req: NextRequest) => {
  const startDate = req.nextUrl.searchParams.get('start');
  const endDate = req.nextUrl.searchParams.get('end');

  try {
    let query = supabaseAdmin
      .from('appointments')
      .select('*')
      .order('scheduled_datetime', { ascending: true });

    if (startDate) {
      query = query.gte('scheduled_datetime', startDate);
    }
    if (endDate) {
      query = query.lte('scheduled_datetime', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[appointments] GET error:', error);
      return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err) {
    console.error('[appointments] GET exception:', err);
    return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 });
  }
};

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();

    const {
      repair_order_id,
      customer_name,
      customer_phone,
      vehicle_display,
      service_type,
      scheduled_datetime,
      duration_minutes = 60,
      status = 'scheduled',
      notes,
    } = body;

    if (!repair_order_id || !scheduled_datetime) {
      return NextResponse.json(
        { error: 'repair_order_id and scheduled_datetime are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('appointments')
      .insert({
        repair_order_id,
        customer_name,
        customer_phone,
        vehicle_display,
        service_type,
        scheduled_datetime,
        duration_minutes,
        status,
        notes,
      })
      .select()
      .single();

    if (error) {
      console.error('[appointments] POST error:', error);
      return NextResponse.json({ error: 'Failed to create appointment' }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    console.error('[appointments] POST exception:', err);
    return NextResponse.json({ error: 'Failed to create appointment' }, { status: 500 });
  }
};
