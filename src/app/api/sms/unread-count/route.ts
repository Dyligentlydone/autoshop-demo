import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-crm';

export const GET = async (_req: NextRequest) => {
  try {
    const { count, error } = await supabase
      .from('sms_messages')
      .select('*', { count: 'exact', head: true })
      .eq('direction', 'inbound')
      .neq('status', 'read');

    if (error) {
      console.error('Failed to fetch unread SMS count:', error);
      return NextResponse.json({ count: 0 }, { status: 200 });
    }

    return NextResponse.json({ count: count ?? 0 });
  } catch (err: any) {
    console.error('Unread count error:', err);
    return NextResponse.json({ count: 0 }, { status: 200 });
  }
};
