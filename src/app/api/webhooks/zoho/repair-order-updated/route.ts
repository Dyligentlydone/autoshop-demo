import { NextRequest, NextResponse } from 'next/server';
import { USE_SUPABASE_CRM } from '@/lib/feature-flags';

/**
 * POST /api/webhooks/zoho/repair-order-updated
 * 
 * DEPRECATED: This webhook is no longer needed after Supabase migration.
 * Repair orders are managed directly in Supabase without webhooks.
 * 
 * Returns a deprecation notice when Supabase CRM is enabled.
 */
export const POST = async (req: NextRequest) => {
  if (USE_SUPABASE_CRM) {
    return NextResponse.json({
      deprecated: true,
      message: 'This webhook is deprecated. Repair orders are now managed directly in Supabase.',
    }, { status: 410 }); // 410 Gone
  }

  // Legacy Zoho webhook (kept for backward compatibility during migration)
  const { supabaseAdmin } = await import('@/lib/supabase');
  const { makeZohoServerRequest } = await import('@/lib/zoho/request-server');
  const { normalizeRepairOrder, normalizeVehicle, normalizeCustomer } = await import('@/app/api/crm/_shared');

  const REPAIR_ORDERS_MODULE = 'Repair_Orders';
  const VEHICLES_MODULE = 'Vehicles';
  const CONTACTS_MODULE = 'Contacts';
  try {
    let body: any = {};
    
    // Try to parse JSON body
    try {
      const text = await req.text();
      if (text && text.length > 0) {
        body = JSON.parse(text);
      }
    } catch (parseError) {
      console.log('[zoho-webhook] No JSON body, checking query params');
    }
    
    // Also check URL query parameters (Zoho might send data there)
    const searchParams = req.nextUrl.searchParams;
    const queryId = searchParams.get('id');
    const fullUrl = req.url;
    const allParams = Object.fromEntries(searchParams.entries());
    
    console.log('[zoho-webhook] Full URL:', fullUrl);
    console.log('[zoho-webhook] All query params:', JSON.stringify(allParams));
    console.log('[zoho-webhook] Received webhook - Body:', JSON.stringify(body), 'Query param id:', queryId);
    
    // Zoho webhook payload structure - handle multiple formats
    let repairOrderId = body?.ids?.[0] || body?.id || body?.Repair_Orders?.id || queryId;
    
    // If we got a literal string like "{Repair_Orders.id}", Zoho didn't substitute the variable
    // In this case, just invalidate the dashboard cache so next calendar refresh gets fresh data
    if (!repairOrderId || repairOrderId.includes('{') || repairOrderId.includes('$')) {
      console.log('[zoho-webhook] No valid repair order ID - Zoho workflow triggered but no ID provided');
      console.log('[zoho-webhook] Triggering appointment sync - calendar will refresh on next auto-sync');
      
      // Trigger appointment sync asynchronously to refresh the data
      const origin = req.nextUrl.origin.replace('https://localhost', 'http://localhost');
      
      // Fire and forget - don't await, but bust cache to get fresh data
      fetch(`${origin}/api/appointments/sync-from-zoho?bustCache=true`, {
        method: 'POST',
      }).catch(err => {
        console.error('[zoho-webhook] Sync trigger error:', err);
      });
      
      // Return immediately
      return NextResponse.json({ 
        message: 'Appointment sync triggered - calendar will update on next refresh',
        status: 'sync_triggered'
      });
    }

    console.log(`[zoho-webhook] Received update for repair order: ${repairOrderId}`);

    // Fetch the updated repair order from Zoho
    const fields = [
      'id',
      'Name',
      'Status',
      'Estimated_Completion',
      'Scheduled_drop_off',
      'Vehicle',
      'Customer',
    ].join(',');

    let roResp;
    try {
      roResp = await makeZohoServerRequest<any>({
        method: 'GET',
        endpoint: `/${REPAIR_ORDERS_MODULE}/${repairOrderId}?fields=${encodeURIComponent(fields)}`,
      });
    } catch (err: any) {
      // If repair order was deleted in Zoho, clean up appointments
      if (err?.response?.status === 404 || err?.response?.data?.code === 'INVALID_DATA') {
        console.log(`[zoho-webhook] Repair order ${repairOrderId} deleted in Zoho, cleaning up appointments`);
        await supabaseAdmin
          .from('appointments')
          .delete()
          .eq('repair_order_id', repairOrderId);
        
        return NextResponse.json({ 
          message: 'Repair order deleted, appointments cleaned up',
          status: 'deleted'
        });
      }
      throw err;
    }

    const roData = roResp.data?.[0];
    if (!roData) {
      console.log(`[zoho-webhook] Repair order ${repairOrderId} not found in Zoho, cleaning up appointments`);
      await supabaseAdmin
        .from('appointments')
        .delete()
        .eq('repair_order_id', repairOrderId);
      
      return NextResponse.json({ 
        message: 'Repair order not found, appointments cleaned up',
        status: 'deleted'
      });
    }

    const ro = normalizeRepairOrder(roData);

    // If no estimated_completion and no scheduled_drop_off, delete all appointments
    if (!ro.estimated_completion && !ro.scheduled_drop_off) {
      console.log(`[zoho-webhook] No dates for RO ${repairOrderId}, deleting appointments if exist`);
      await supabaseAdmin
        .from('appointments')
        .delete()
        .eq('repair_order_id', repairOrderId);
      
      return NextResponse.json({ message: 'Appointments deleted (no dates)' });
    }

    // Fetch vehicle and customer data
    let vehicleDisplay: string | null = null;
    let customerName: string | null = null;
    let customerPhone: string | null = null;

    if (ro.vehicle_id) {
      try {
        const vFields = ['id', 'Name', 'Make', 'Model', 'Owner1'].join(',');
        const vResp = await makeZohoServerRequest<any>({
          method: 'GET',
          endpoint: `/${VEHICLES_MODULE}/${ro.vehicle_id}?fields=${encodeURIComponent(vFields)}`,
        });
        const vehicle = vResp.data?.[0];
        if (vehicle) {
          const v = normalizeVehicle(vehicle);
          vehicleDisplay = [v.year, v.make, v.model].filter(Boolean).join(' ');

          // Fetch customer
          if (v.customer_id) {
            try {
              const cFields = ['id', 'First_Name', 'Last_Name', 'Phone'].join(',');
              const cResp = await makeZohoServerRequest<any>({
                method: 'GET',
                endpoint: `/${CONTACTS_MODULE}/${v.customer_id}?fields=${encodeURIComponent(cFields)}`,
              });
              const customer = cResp.data?.[0];
              if (customer) {
                const c = normalizeCustomer(customer);
                customerName = `${c.first_name} ${c.last_name}`.trim();
                customerPhone = c.phone;
              }
            } catch (err) {
              console.error(`[zoho-webhook] Failed to fetch customer:`, err);
            }
          }
        }
      } catch (err) {
        console.error(`[zoho-webhook] Failed to fetch vehicle:`, err);
      }
    }

    // Map Zoho status to appointment status
    let appointmentStatus: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' = 'scheduled';
    const roStatus = (ro.status || '').toLowerCase();
    
    if (roStatus === 'completed') {
      appointmentStatus = 'completed';
    } else if (roStatus === 'in progress' || roStatus === 'diagnosing' || roStatus === 'repair approved' || roStatus === 'dropped off' || roStatus === 'waiting approval') {
      appointmentStatus = 'in_progress';
    } else if (roStatus === 'ready for pickup') {
      appointmentStatus = 'completed';  // Ready for pickup = essentially complete
    } else if (roStatus === 'cancelled') {
      appointmentStatus = 'cancelled';
    }

    let syncedCount = 0;

    // Upsert estimated_completion appointment (green)
    if (ro.estimated_completion) {
      const { error } = await supabaseAdmin
        .from('appointments')
        .upsert({
          repair_order_id: ro.id,
          customer_name: customerName,
          customer_phone: customerPhone,
          vehicle_display: vehicleDisplay,
          service_type: ro.service_type,
          scheduled_datetime: ro.estimated_completion,
          status: appointmentStatus,
          zoho_status: ro.status,
          appointment_type: 'estimated_completion',
        }, {
          onConflict: 'repair_order_id,appointment_type',
        });

      if (error) {
        console.error(`[zoho-webhook] Failed to upsert estimated_completion:`, error);
      } else {
        syncedCount++;
      }
    } else {
      // Delete estimated_completion appointment if field is cleared
      await supabaseAdmin
        .from('appointments')
        .delete()
        .eq('repair_order_id', repairOrderId)
        .eq('appointment_type', 'estimated_completion');
    }

    // Upsert scheduled_drop_off appointment (blue)
    if (ro.scheduled_drop_off) {
      const { error } = await supabaseAdmin
        .from('appointments')
        .upsert({
          repair_order_id: ro.id,
          customer_name: customerName,
          customer_phone: customerPhone,
          vehicle_display: vehicleDisplay,
          service_type: ro.service_type,
          scheduled_datetime: ro.scheduled_drop_off,
          status: 'scheduled',  // Drop-offs are always scheduled
          zoho_status: ro.status,
          appointment_type: 'scheduled_drop_off',
        }, {
          onConflict: 'repair_order_id,appointment_type',
        });

      if (error) {
        console.error(`[zoho-webhook] Failed to upsert scheduled_drop_off:`, error);
      } else {
        syncedCount++;
      }
    } else {
      // Delete scheduled_drop_off appointment if field is cleared
      await supabaseAdmin
        .from('appointments')
        .delete()
        .eq('repair_order_id', repairOrderId)
        .eq('appointment_type', 'scheduled_drop_off');
    }

    console.log(`[zoho-webhook] Successfully synced ${syncedCount} appointment(s) for RO ${repairOrderId}`);
    return NextResponse.json({ 
      message: `${syncedCount} appointment(s) synced successfully`,
      repair_order_id: repairOrderId,
      synced: syncedCount,
    });

  } catch (err) {
    console.error('[zoho-webhook] Error:', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
};
