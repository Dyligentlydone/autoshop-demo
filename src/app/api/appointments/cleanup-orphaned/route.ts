import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { makeZohoServerRequest } from '@/lib/zoho/request-server';

/**
 * POST/GET /api/appointments/cleanup-orphaned
 * 
 * Removes appointments for repair orders that no longer exist in Zoho.
 * This handles cases where repair orders were deleted in Zoho but appointments remain in Supabase.
 */
const cleanupOrphaned = async () => {
  try {
    console.log('[cleanup-orphaned] Starting cleanup of orphaned appointments');

    // Get all appointments from Supabase
    const { data: appointments, error: fetchError } = await supabaseAdmin
      .from('appointments')
      .select('id, repair_order_id');

    if (fetchError) throw fetchError;

    if (!appointments || appointments.length === 0) {
      console.log('[cleanup-orphaned] No appointments to check');
      return NextResponse.json({ 
        message: 'No appointments to check',
        deleted: 0 
      });
    }

    console.log(`[cleanup-orphaned] Checking ${appointments.length} appointments`);

    // Get unique repair order IDs
    const uniqueRoIds = Array.from(new Set(appointments.map(a => a.repair_order_id)));
    console.log(`[cleanup-orphaned] Found ${uniqueRoIds.length} unique repair order IDs`);

    const orphanedRoIds: string[] = [];

    // Check each repair order in Zoho
    for (const roId of uniqueRoIds) {
      try {
        await makeZohoServerRequest<any>({
          method: 'GET',
          endpoint: `/Repair_Orders/${roId}?fields=id`,
        });
        // If we get here, repair order exists in Zoho
      } catch (err: any) {
        // If 404 or INVALID_DATA, repair order was deleted
        if (err?.response?.status === 404 || err?.response?.data?.code === 'INVALID_DATA') {
          console.log(`[cleanup-orphaned] Repair order ${roId} not found in Zoho`);
          orphanedRoIds.push(roId);
        } else {
          console.error(`[cleanup-orphaned] Error checking RO ${roId}:`, err.message);
        }
      }
    }

    if (orphanedRoIds.length === 0) {
      console.log('[cleanup-orphaned] No orphaned appointments found');
      return NextResponse.json({ 
        message: 'No orphaned appointments found',
        deleted: 0 
      });
    }

    console.log(`[cleanup-orphaned] Deleting appointments for ${orphanedRoIds.length} orphaned repair orders`);

    // Delete appointments for orphaned repair orders
    const { error: deleteError } = await supabaseAdmin
      .from('appointments')
      .delete()
      .in('repair_order_id', orphanedRoIds);

    if (deleteError) throw deleteError;

    console.log(`[cleanup-orphaned] Successfully deleted appointments for orphaned repair orders`);

    return NextResponse.json({ 
      message: 'Orphaned appointments cleaned up',
      deleted: orphanedRoIds.length,
      repair_order_ids: orphanedRoIds
    });

  } catch (err: any) {
    console.error('[cleanup-orphaned] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to cleanup orphaned appointments' },
      { status: 500 }
    );
  }
};

export const POST = cleanupOrphaned;
export const GET = cleanupOrphaned;
