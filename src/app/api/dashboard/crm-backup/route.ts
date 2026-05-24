import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { USE_SUPABASE_CRM } from '@/lib/feature-flags';

export async function GET() {
  try {
    if (USE_SUPABASE_CRM) {
      // With Supabase CRM, backup table is no longer needed
      // All data is already in Supabase
      return NextResponse.json({ 
        message: 'CRM backup not needed - all data is in Supabase',
        data: [], 
        count: 0 
      });
    }

    // Legacy Zoho backup check
    const { data, error } = await supabaseAdmin
      .from('crm_backup')
      .select('id, created_at, customer_name, phone, email, vehicle_year, vehicle_make, vehicle_model, vin, service_type, job_description, zoho_error')
      .eq('synced_to_zoho', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[crm-backup] supabase error', error);
      return NextResponse.json({ error: 'Failed to fetch backup records' }, { status: 500 });
    }

    return NextResponse.json({ data: data || [], count: data?.length || 0 });
  } catch (err) {
    console.error('[crm-backup] unexpected error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
