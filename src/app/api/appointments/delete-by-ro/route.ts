import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * DELETE /api/appointments/delete-by-ro?repair_order_id=xxx
 * 
 * Deletes all appointments for a specific repair order ID.
 */
export const DELETE = async (req: NextRequest) => {
  try {
    const repairOrderId = req.nextUrl.searchParams.get('repair_order_id');

    if (!repairOrderId) {
      return NextResponse.json(
        { error: 'repair_order_id is required' },
        { status: 400 }
      );
    }

    console.log(`[delete-by-ro] Deleting appointments for RO: ${repairOrderId}`);

    const { error } = await supabaseAdmin
      .from('appointments')
      .delete()
      .eq('repair_order_id', repairOrderId);

    if (error) {
      console.error('[delete-by-ro] Error:', error);
      return NextResponse.json(
        { error: 'Failed to delete appointments' },
        { status: 500 }
      );
    }

    console.log(`[delete-by-ro] Successfully deleted appointments for RO: ${repairOrderId}`);

    return NextResponse.json({ 
      message: 'Appointments deleted',
      repair_order_id: repairOrderId
    });

  } catch (err: any) {
    console.error('[delete-by-ro] Exception:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to delete appointments' },
      { status: 500 }
    );
  }
};

export const GET = DELETE;
