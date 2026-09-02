import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST() {
  try {
    console.log('[resync-appointments] Starting resync...');

    // Get all repair orders with dates
    const { data: repairOrders, error: roError } = await supabaseAdmin
      .from('repair_orders')
      .select(`
        *,
        vehicles!repair_orders_vehicle_id_fkey(*),
        customers!repair_orders_customer_id_fkey(*)
      `)
      .or('estimated_completion.not.is.null,scheduled_drop_off.not.is.null');

    if (roError) {
      console.error('[resync-appointments] Error fetching repair orders:', roError);
      return NextResponse.json({ error: roError.message }, { status: 500 });
    }

    console.log(`[resync-appointments] Found ${repairOrders?.length || 0} repair orders with dates`);

    let synced = 0;

    for (const ro of repairOrders || []) {
      const vehicle = ro.vehicles;
      const customer = ro.customers;

      const vehicleDisplay = vehicle
        ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')
        : null;

      const customerName = customer
        ? `${customer.first_name} ${customer.last_name}`.trim()
        : null;

      // Map status to appointment status
      let appointmentStatus: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' = 'scheduled';
      const roStatus = ro.status;
      
      if (roStatus === 'Completed') {
        appointmentStatus = 'completed';
      } else if (['In Progress', 'Diagnosing', 'Repair Approved', 'Dropped Off', 'Waiting Approval'].includes(roStatus)) {
        appointmentStatus = 'in_progress';
      } else if (roStatus === 'Ready For Pickup') {
        appointmentStatus = 'completed';
      }

      // Sync estimated_completion appointment
      if (ro.estimated_completion) {
        await supabaseAdmin
          .from('appointments')
          .upsert({
            repair_order_id: ro.id,
            customer_name: customerName,
            customer_phone: customer?.phone || null,
            vehicle_display: vehicleDisplay,
            service_type: ro.service_type,
            scheduled_datetime: ro.estimated_completion,
            status: appointmentStatus,
            zoho_status: ro.status,
            appointment_type: 'estimated_completion',
          }, {
            onConflict: 'repair_order_id,appointment_type',
          });
        synced++;
      }

      // Sync scheduled_drop_off appointment
      if (ro.scheduled_drop_off) {
        await supabaseAdmin
          .from('appointments')
          .upsert({
            repair_order_id: ro.id,
            customer_name: customerName,
            customer_phone: customer?.phone || null,
            vehicle_display: vehicleDisplay,
            service_type: ro.service_type,
            scheduled_datetime: ro.scheduled_drop_off,
            status: 'scheduled',
            zoho_status: ro.status,
            appointment_type: 'scheduled_drop_off',
          }, {
            onConflict: 'repair_order_id,appointment_type',
          });
        synced++;
      }
    }

    console.log(`[resync-appointments] Synced ${synced} appointments`);

    return NextResponse.json({ 
      success: true, 
      message: `Resynced ${synced} appointments from ${repairOrders?.length || 0} repair orders` 
    });
  } catch (err: any) {
    console.error('[resync-appointments] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
