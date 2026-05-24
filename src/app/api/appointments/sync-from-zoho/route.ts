import { NextResponse } from 'next/server';
import { USE_SUPABASE_CRM } from '@/lib/feature-flags';
import { supabaseAdmin } from '@/lib/supabase';
import { makeZohoServerRequest } from '@/lib/zoho/request-server';
import { normalizeRepairOrder, normalizeVehicle, normalizeCustomer } from '@/app/api/crm/_shared';

const REPAIR_ORDERS_MODULE = 'Repair_Orders';
const VEHICLES_MODULE = 'Vehicles';
const CONTACTS_MODULE = 'Contacts';

// Simple cache for appointment sync - 30 seconds TTL
let appointmentCachePayload: any = null;
let appointmentCacheAt = 0;
const APPOINTMENT_CACHE_TTL_MS = 30_000;

/**
 * POST /api/appointments/sync-from-zoho
 * 
 * DEPRECATED: This endpoint is no longer needed after Supabase migration.
 * Appointments are now stored directly in the repair_orders table.
 * 
 * Returns a deprecation notice when Supabase CRM is enabled.
 */
export const POST = async (req: Request) => {
  if (USE_SUPABASE_CRM) {
    return NextResponse.json({
      deprecated: true,
      message: 'This endpoint is deprecated. Appointments are now managed directly in the repair_orders table.',
    }, { status: 410 }); // 410 Gone
  }

  // Legacy Zoho sync (kept for backward compatibility during migration)
  try {
    // Check for cache busting parameter
    const url = new URL(req.url);
    const bustCache = url.searchParams.get('bustCache');
    
    // Check cache first (skip if cache busting)
    if (!bustCache && appointmentCachePayload && Date.now() - appointmentCacheAt < APPOINTMENT_CACHE_TTL_MS) {
      console.log('[sync-appointments] Using cached data');
      return NextResponse.json(appointmentCachePayload);
    }

    console.log('[sync-appointments] Fetching fresh data from Zoho');

    // Fetch only repair orders with dates - use a COQL query to filter server-side
    const fields = [
      'id',
      'Name',
      'Status',
      'Estimated_Completion',
      'Scheduled_drop_off',
      'Vehicle',
      'Customer',
    ].join(',');

    const resp = await makeZohoServerRequest<any>({
      method: 'GET',
      endpoint: `/${REPAIR_ORDERS_MODULE}?per_page=200&fields=${encodeURIComponent(fields)}`,
    });

    const repairOrdersWithDates = (resp.data || [])
      .map((ro: any) => normalizeRepairOrder(ro))
      .filter((ro: any) => ro.estimated_completion || ro.scheduled_drop_off);

    if (repairOrdersWithDates.length === 0) {
      const result = { message: 'No repair orders with dates found', synced: 0 };
      appointmentCachePayload = result;
      appointmentCacheAt = Date.now();
      return NextResponse.json(result);
    }

    // Fetch vehicle and customer data for each repair order
    const vehicleIds = Array.from(new Set(repairOrdersWithDates.map((ro: any) => ro.vehicle_id).filter(Boolean))) as string[];
    const vehiclesById: Record<string, any> = {};
    const customersById: Record<string, any> = {};

    if (vehicleIds.length > 0) {
      const vFields = ['id', 'Name', 'Make', 'Model', 'Year', 'Owner1'].join(',');
      
      for (const vehicleId of vehicleIds) {
        try {
          const vResp = await makeZohoServerRequest<any>({
            method: 'GET',
            endpoint: `/${VEHICLES_MODULE}/${vehicleId}?fields=${encodeURIComponent(vFields)}`,
          });
          const vehicle = vResp.data?.[0];
          if (vehicle) {
            vehiclesById[vehicleId as string] = normalizeVehicle(vehicle);
          }
        } catch (err) {
          console.error(`Failed to fetch vehicle ${vehicleId}:`, err);
        }
      }

      const customerIds = Array.from(
        new Set(Object.values(vehiclesById).map((v: any) => v.customer_id).filter((id): id is string => Boolean(id)))
      ) as string[];

      if (customerIds.length > 0) {
        const cFields = ['id', 'First_Name', 'Last_Name', 'Phone'].join(',');
        
        for (const customerId of customerIds) {
          try {
            const cResp = await makeZohoServerRequest<any>({
              method: 'GET',
              endpoint: `/${CONTACTS_MODULE}/${customerId}?fields=${encodeURIComponent(cFields)}`,
            });
            const customer = cResp.data?.[0];
            if (customer) {
              customersById[customerId] = normalizeCustomer(customer);
            }
          } catch (err) {
            console.error(`Failed to fetch customer ${customerId}:`, err);
          }
        }
      }
    }

    // Upsert appointments
    let synced = 0;
    for (const ro of repairOrdersWithDates) {
      const vehicle = vehiclesById[ro.vehicle_id];
      const customer = vehicle?.customer_id ? customersById[vehicle.customer_id] : null;

      const vehicleDisplay = vehicle
        ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')
        : null;

      const customerName = customer
        ? `${customer.first_name} ${customer.last_name}`.trim()
        : null;

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

      // Create appointment for estimated_completion (green)
      if (ro.estimated_completion) {
        try {
          // Fix timezone issue: Zoho sends dates like "2024-03-26" which JS parses as UTC
          // We need to treat them as local timezone (EST) by appending time
          const scheduledDatetime = ro.estimated_completion.includes('T') 
            ? ro.estimated_completion 
            : `${ro.estimated_completion}T12:00:00`;
          
          await supabaseAdmin
            .from('appointments')
            .upsert({
              repair_order_id: ro.id,
              customer_name: customerName,
              customer_phone: customer?.phone || null,
              vehicle_display: vehicleDisplay,
              service_type: ro.service_type,
              scheduled_datetime: scheduledDatetime,
              status: appointmentStatus,
              zoho_status: ro.status,
              appointment_type: 'estimated_completion',
            }, {
              onConflict: 'repair_order_id,appointment_type',
            });
          synced++;
        } catch (err) {
          console.error(`Failed to upsert estimated_completion appointment for RO ${ro.id}:`, err);
        }
      }

      // Create appointment for scheduled_drop_off (blue)
      if (ro.scheduled_drop_off) {
        try {
          // Fix timezone issue: Zoho sends dates like "2024-03-26" which JS parses as UTC
          // We need to treat them as local timezone (EST) by appending time
          const scheduledDatetime = ro.scheduled_drop_off.includes('T') 
            ? ro.scheduled_drop_off 
            : `${ro.scheduled_drop_off}T12:00:00`;
          
          await supabaseAdmin
            .from('appointments')
            .upsert({
              repair_order_id: ro.id,
              customer_name: customerName,
              customer_phone: customer?.phone || null,
              vehicle_display: vehicleDisplay,
              service_type: ro.service_type,
              scheduled_datetime: scheduledDatetime,
              status: 'scheduled',  // Drop-offs are always scheduled status
              zoho_status: ro.status,
              appointment_type: 'scheduled_drop_off',
            }, {
              onConflict: 'repair_order_id,appointment_type',
            });
          synced++;
        } catch (err) {
          console.error(`Failed to upsert scheduled_drop_off appointment for RO ${ro.id}:`, err);
        }
      }
    }

    // Clean up appointments for repair orders that no longer exist or have no dates
    // Get all current repair order IDs from Zoho
    const currentRepairOrderIds = new Set(repairOrdersWithDates.map((ro: any) => ro.id));
    
    // Get all appointments from Supabase
    const { data: existingAppointments } = await supabaseAdmin
      .from('appointments')
      .select('id, repair_order_id');
    
    // Delete appointments for repair orders that no longer exist in Zoho
    if (existingAppointments && existingAppointments.length > 0) {
      const appointmentsToDelete = existingAppointments.filter(
        apt => !currentRepairOrderIds.has(apt.repair_order_id)
      );
      
      if (appointmentsToDelete.length > 0) {
        const idsToDelete = appointmentsToDelete.map(apt => apt.id);
        await supabaseAdmin
          .from('appointments')
          .delete()
          .in('id', idsToDelete);
        
        console.log(`[sync-appointments] Deleted ${appointmentsToDelete.length} orphaned appointments`);
      }
    }

    const result = { 
      message: `Synced ${synced} appointments from Zoho`,
      synced,
      total: repairOrdersWithDates.length,
    };
    
    // Cache the result
    appointmentCachePayload = result;
    appointmentCacheAt = Date.now();
    
    return NextResponse.json(result);
  } catch (err) {
    console.error('[sync-from-zoho] Error:', err);
    return NextResponse.json({ error: 'Failed to sync appointments' }, { status: 500 });
  }
};
