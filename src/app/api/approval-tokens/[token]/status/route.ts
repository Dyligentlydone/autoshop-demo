import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-crm';

// GET - Fetch current repair order status by approval token
export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) => {
  try {
    const { token } = await params;

    const { data: tokenRecord, error } = await supabase
      .from('approval_tokens')
      .select('repair_order_id, is_used, used_at, expires_at')
      .eq('token', token)
      .single();

    if (error || !tokenRecord) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 404 }
      );
    }

    // Check if token is expired
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This approval link has expired' },
        { status: 410 }
      );
    }

    // Fetch current repair order status
    const { data: repairOrder, error: roError } = await supabase
      .from('repair_orders')
      .select('id, status, estimated_completion, updated_at')
      .eq('id', tokenRecord.repair_order_id)
      .single();

    if (roError || !repairOrder) {
      console.error('Failed to fetch repair order for status:', roError);
      return NextResponse.json(
        { error: 'Repair order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        status: repairOrder.status || 'Unknown',
        estimated_completion: repairOrder.estimated_completion,
        updated_at: repairOrder.updated_at,
        is_used: tokenRecord.is_used,
        used_at: tokenRecord.used_at,
      },
    });
  } catch (err: any) {
    console.error('Failed to fetch status:', err);
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    );
  }
};
