import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-crm';

// GET - List all approval tokens for a given repair order (audit trail)
export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    const { data, error } = await supabase
      .from('approval_tokens')
      .select(
        'id, token, created_at, expires_at, first_viewed_at, view_count, used_at, is_used, approved_ip, approved_user_agent'
      )
      .eq('repair_order_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch approval tokens:', error);
      return NextResponse.json(
        { error: 'Failed to fetch approval history', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    console.error('Approval history error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch approval history', details: err?.message },
      { status: 500 }
    );
  }
};
