import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAgentKey, normalizePhone, jsonError, zohoLookupCustomerByPhone } from '../../_shared';
import { makeZohoServerRequest } from '@/lib/zoho/request-server';
import { USE_SUPABASE_CRM } from '@/lib/feature-flags';
import { supabaseLookupCustomerByPhone, supabaseGetRepairOrdersByCustomer, supabaseGetVehicle } from '@/lib/supabase-crm';

/**
 * POST /api/agent/customer/recall
 *
 * Called by Voiceflow at the very start of every incoming call.
 * Looks up the caller's phone number in `call_logs` to determine if they
 * are a returning customer and what we know about them.
 *
 * Body: { phone: string }
 *
 * Returns:
 *   { returning_customer: false }
 *   — OR —
 *   {
 *     returning_customer: true,
 *     customer_name: string,
 *     vehicle: string,           // e.g. "2019 Honda Civic"
 *     last_service: string,
 *     last_visit: string,        // ISO date string
 *     personality_notes: string, // agent guidance on tone / style
 *     key_detail: string,        // one standout detail to reference
 *     call_count: number
 *   }
 */
export async function POST(req: NextRequest) {
    const auth = requireAgentKey(req);
    if (!auth.ok) return auth.response;

    let body: { phone?: unknown };
    try {
        body = await req.json();
    } catch {
        return jsonError(400, 'Invalid JSON body');
    }

    console.log('[recall] raw body received:', JSON.stringify(body));
    const phone = normalizePhone(body.phone);
    console.log('[recall] normalized phone:', phone);
    if (!phone) return jsonError(400, 'phone is required', { received_body: body });

    const { data, error } = await supabaseAdmin
        .from('call_logs')
        .select(
            'customer_name, vehicle_year, vehicle_make, vehicle_model, service_type, job_description, created_at, personality_notes, key_detail'
        )
        .eq('phone', phone)
        .not('call_outcome', 'eq', 'abandoned')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('[recall] supabase error', error);
        return jsonError(500, 'Database error', error.message);
    }

    // Found in Supabase - return full history with personality notes
    if (data && data.length > 0) {
        const latest = data[0];

        // Build vehicle string from the most recent call where vehicle info exists
        const vehicleRecord = data.find((r) => r.vehicle_make);
        const vehicle =
            vehicleRecord
                ? `${vehicleRecord.vehicle_year ?? ''} ${vehicleRecord.vehicle_make} ${vehicleRecord.vehicle_model ?? ''}`.trim()
                : null;

        // Collect last service info
        const lastServiceRecord = data.find((r) => r.service_type);

        // Build greeting suggestion for repeat Supabase customers
        const customerName = latest.customer_name?.split(' ')[0] ?? 'there';
        let greetingSuggestion = `Thank you for calling AutoShop Demo, this is Diligent! Hey ${customerName}! Great to hear from you again.`;
        if (vehicle) {
            greetingSuggestion += ` Hope the ${vehicle} is running good!`;
        }

        return NextResponse.json({
            returning_customer: true,
            customer_name: latest.customer_name ?? null,
            vehicle: vehicle ?? null,
            last_service: lastServiceRecord?.service_type ?? null,
            last_job_description: lastServiceRecord?.job_description ?? null,
            last_visit: latest.created_at,
            personality_notes: latest.personality_notes ?? null,
            key_detail: latest.key_detail ?? null,
            call_count: data.length,
            source: 'supabase',
            greeting_suggestion: greetingSuggestion,
        });
    }

    // Not in Supabase call_logs - check CRM (Zoho or Supabase) as fallback
    try {
        let crmCustomer = null;
        let vehicle = null;
        let source = '';

        if (USE_SUPABASE_CRM) {
            // Check Supabase CRM
            crmCustomer = await supabaseLookupCustomerByPhone(phone);
            source = 'supabase_crm';

            if (crmCustomer) {
                // Get their most recent repair order to find vehicle
                const repairOrders = await supabaseGetRepairOrdersByCustomer(crmCustomer.id);
                if (repairOrders.length > 0) {
                    const latestRO = repairOrders[0];
                    if (latestRO.vehicle_id) {
                        const vehicleData = await supabaseGetVehicle(latestRO.vehicle_id);
                        if (vehicleData) {
                            vehicle = `${vehicleData.year ?? ''} ${vehicleData.make ?? ''} ${vehicleData.model ?? ''}`.trim() || null;
                        }
                    }
                }
            }
        } else {
            // Check Zoho CRM
            const zohoCustomer = await zohoLookupCustomerByPhone(phone);
            crmCustomer = zohoCustomer;
            source = 'zoho';

            if (zohoCustomer) {
                // Get their most recent repair order to find vehicle
                try {
                    const roResp = await makeZohoServerRequest<any>({
                        method: 'GET',
                        endpoint: `/Repair_Orders/search?criteria=(Customer:equals:${zohoCustomer.id})&fields=Vehicle&sort_by=Modified_Time&sort_order=desc&per_page=1`,
                    });

                    if (roResp.data?.[0]?.Vehicle) {
                        const vehicleId = roResp.data[0].Vehicle;
                        const vResp = await makeZohoServerRequest<any>({
                            method: 'GET',
                            endpoint: `/Vehicles/${vehicleId}?fields=Name,Make,Model`,
                        });

                        const v = vResp.data?.[0];
                        if (v) {
                            vehicle = `${v.Name ?? ''} ${v.Make ?? ''} ${v.Model ?? ''}`.trim() || null;
                        }
                    }
                } catch (err) {
                    console.error('[recall] failed to fetch vehicle from CRM', err);
                    // Continue without vehicle info
                }
            }
        }

        if (!crmCustomer) {
            // Not in Supabase call_logs or CRM - brand new customer
            return NextResponse.json({ returning_customer: false });
        }

        // Build greeting suggestion for CRM customers (first call)
        const firstName = crmCustomer.first_name || 'there';
        const greetingSuggestion = `Thank you for calling AutoShop Demo, this is Diligent! How's it going ${firstName}, what can I help you with today?`;

        // Return basic CRM data (no personality notes, no call history)
        return NextResponse.json({
            returning_customer: true,
            customer_name: `${crmCustomer.first_name} ${crmCustomer.last_name}`.trim(),
            vehicle: vehicle,
            last_service: null,
            last_job_description: null,
            last_visit: null,
            personality_notes: null,
            key_detail: null,
            call_count: 0,
            source: source,
            greeting_suggestion: greetingSuggestion,
        });
    } catch (err) {
        console.error('[recall] CRM lookup error', err);
        // If CRM fails, treat as new customer rather than erroring
        return NextResponse.json({ returning_customer: false });
    }
}
