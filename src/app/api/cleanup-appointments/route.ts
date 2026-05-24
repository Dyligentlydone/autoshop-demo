import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST() {
  try {
    // Delete appointments for the specific deleted repair order
    const { error: deleteError } = await supabaseAdmin
      .from('appointments')
      .delete()
      .eq('repair_order_id', 'dc7e9540-230a-4438-9e8b-360eb53bd0f5');

    if (deleteError) {
      console.error('Error deleting appointments:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Clean up any other orphaned appointments
    const { data: allAppointments } = await supabaseAdmin
      .from('appointments')
      .select('id, repair_order_id');

    if (allAppointments && allAppointments.length > 0) {
      const repairOrderIds = Array.from(new Set(allAppointments.map((a: any) => a.repair_order_id)));
      
      const { data: existingROs } = await supabaseAdmin
        .from('repair_orders')
        .select('id')
        .in('id', repairOrderIds);

      const existingIds = new Set(existingROs?.map((ro: any) => ro.id) || []);
      const orphanedAppointments = allAppointments.filter((a: any) => !existingIds.has(a.repair_order_id));

      if (orphanedAppointments.length > 0) {
        const orphanedIds = orphanedAppointments.map((a: any) => a.id);
        await supabaseAdmin
          .from('appointments')
          .delete()
          .in('id', orphanedIds);

        return NextResponse.json({ 
          success: true, 
          message: `Cleaned up ${orphanedAppointments.length + 1} orphaned appointments` 
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Deleted appointment for repair order dc7e9540-230a-4438-9e8b-360eb53bd0f5' 
    });
  } catch (err: any) {
    console.error('Cleanup error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
