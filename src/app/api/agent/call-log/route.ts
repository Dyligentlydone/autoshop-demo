import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAgentKey, normalizePhone, jsonError } from '../_shared';

/**
 * POST /api/agent/call-log
 *
 * Called by Voiceflow at the END of every call to record the conversation.
 * Saved data is used for conversation memory on future calls.
 *
 * Body:
 * {
 *   phone: string,
 *   customer_name?: string,
 *   vehicle_year?: string,
 *   vehicle_make?: string,
 *   vehicle_model?: string,
 *   service_type?: string,
 *   job_description?: string,
 *   intent?: string,               // "booking" | "status_check" | "emergency" | "general"
 *   zoho_customer_id?: string,
 *   zoho_ro_id?: string,
 *   call_outcome?: string,         // "booked" | "crm_backup" | "info_only" | "abandoned"
 *   raw_summary?: string,          // free text summary of call
 *   personality_notes?: string,    // agent's read on tone, mood, communication style
 *   key_detail?: string,           // one standout detail to remember about this person
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
        vehicle_year: typeof body.vehicle_year === 'string' ? body.vehicle_year : null,
        vehicle_make: typeof body.vehicle_make === 'string' ? body.vehicle_make : null,
        vehicle_model: typeof body.vehicle_model === 'string' ? body.vehicle_model : null,
        service_type: typeof body.service_type === 'string' ? body.service_type : null,
        job_description: typeof body.job_description === 'string' ? body.job_description : null,
        intent: typeof body.intent === 'string' ? body.intent : null,
        zoho_customer_id: typeof body.zoho_customer_id === 'string' ? body.zoho_customer_id : null,
        zoho_ro_id: typeof body.zoho_ro_id === 'string' ? body.zoho_ro_id : null,
        call_outcome: typeof body.call_outcome === 'string' ? body.call_outcome : null,
        raw_summary: typeof body.raw_summary === 'string' ? body.raw_summary : null,
        personality_notes:
            typeof body.personality_notes === 'string' ? body.personality_notes : null,
        key_detail: typeof body.key_detail === 'string' ? body.key_detail : null,
    };

    const { data, error } = await supabaseAdmin
        .from('call_logs')
        .insert(record)
        .select('id')
        .single();

    if (error) {
        console.error('[call-log] supabase error', error);
        return jsonError(500, 'Failed to write call log', error.message);
    }

    return NextResponse.json({ id: data.id }, { status: 201 });
}
