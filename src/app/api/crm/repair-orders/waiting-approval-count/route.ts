import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-crm';
import { USE_SUPABASE_CRM } from '@/lib/feature-flags';

export const GET = async (_req: NextRequest) => {
  try {
    if (!USE_SUPABASE_CRM) {
      return NextResponse.json({ count: 0 });
    }

    const { count, error } = await supabase
      .from('repair_orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Waiting Approval');

    if (error) {
      console.error('Failed to fetch waiting approval count:', error);
      return NextResponse.json({ count: 0 });
    }

    return NextResponse.json({ count: count ?? 0 });
  } catch (err: any) {
    console.error('Waiting approval count error:', err);
    return NextResponse.json({ count: 0 });
  }
};
