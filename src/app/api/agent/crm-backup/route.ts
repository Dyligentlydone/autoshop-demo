import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAgentKey, normalizePhone, jsonError } from '../_shared';

/**
 * POST /api/agent/crm-backup
 *
 * Called by Voiceflow on the FAILURE path of any Zoho CRM API block.
 * Saves the caller's info so nothing is lost when Zoho/Railway is down.
 * Staff can review and re-sync these records from the dashboard.
 *
 * Body:
 * {
 *   phone: string,
 *   customer_name?: string,
 *   email?: string,
 *   vehicle_year?: string,
 *   vehicle_make?: string,
 *   vehicle_model?: string,
 *   vin?: string,
 *   service_type?: string,
 *   job_description?: string,
 *   scheduled_drop_off?: string,
 *   zoho_error?: string,      // raw error message from Zoho/Railway for debugging
 * }
 *
 * Returns: { id: string }
 */
export async function POST(req: NextRequest) {
    const auth = requireAgentKey(req);
    if (!auth.ok) return auth.response;

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return jsonError(400, 'Invalid JSON body');
    }

    const phone = normalizePhone(body.phone);
    if (!phone) return jsonError(400, 'phone is required');

    const record = {
        phone,
        customer_name: typeof body.customer_name === 'string' ? body.customer_name : null,
        email: typeof body.email === 'string' ? body.email : null,
        vehicle_year: typeof body.vehicle_year === 'string' ? body.vehicle_year : null,
        vehicle_make: typeof body.vehicle_make === 'string' ? body.vehicle_make : null,
        vehicle_model: typeof body.vehicle_model === 'string' ? body.vehicle_model : null,
        vin: typeof body.vin === 'string' ? body.vin : null,
        service_type: typeof body.service_type === 'string' ? body.service_type : null,
        job_description: typeof body.job_description === 'string' ? body.job_description : null,
        scheduled_drop_off: typeof body.scheduled_drop_off === 'string' ? body.scheduled_drop_off : null,
        zoho_error: typeof body.zoho_error === 'string' ? body.zoho_error : null,
        synced_to_zoho: false,
    };

    const { data, error } = await supabaseAdmin
        .from('crm_backup')
        .insert(record)
        .select('id')
        .single();

    if (error) {
        console.error('[crm-backup] supabase error', error);
        return jsonError(500, 'Failed to write CRM backup', error.message);
    }

    return NextResponse.json({ id: data.id }, { status: 201 });
}
