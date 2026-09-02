import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-crm';

export const POST = async (req: NextRequest) => {
  try {
    const { customerId, phoneNumber } = await req.json();

    if (!customerId && !phoneNumber) {
      return NextResponse.json(
        { error: 'customerId or phoneNumber is required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('sms_messages')
      .update({ status: 'read' })
      .eq('direction', 'inbound')
      .neq('status', 'read');

    // Phone number is the reliable identifier — a message may have customer_id=null
    // in the DB even when the conversation API resolved the customer via phone tail.
    // Always match by phone first; fall back to customerId only when phone is missing.
    if (phoneNumber) {
      query = query.or(`from_number.eq.${phoneNumber},to_number.eq.${phoneNumber}`);
    } else if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to mark SMS as read:', error);
      return NextResponse.json(
        { error: 'Failed to mark messages as read', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Mark read error:', err);
    return NextResponse.json(
      { error: 'Failed to mark messages as read', details: err?.message },
      { status: 500 }
    );
  }
};
