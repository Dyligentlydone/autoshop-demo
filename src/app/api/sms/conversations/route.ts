import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-crm';

export const GET = async (req: NextRequest) => {
  try {
    const customerId = req.nextUrl.searchParams.get('customerId');

    if (customerId) {
      // Get messages for specific customer
      const { data, error } = await supabase
        .from('sms_messages')
        .select('*, customer:customers(*), repair_order:repair_orders(*)')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return NextResponse.json({ data: data || [] });
    } else {
      // Get all conversations grouped by customer
      const { data, error } = await supabase
        .from('sms_messages')
        .select('*, customer:customers(*), repair_order:repair_orders(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by customer
      const conversationsMap = new Map();
      
      (data || []).forEach((msg: any) => {
        const customerId = msg.customer_id;
        if (!customerId) return;

        if (!conversationsMap.has(customerId)) {
          conversationsMap.set(customerId, {
            customer: msg.customer,
            messages: [],
            lastMessage: msg,
            unreadCount: 0,
          });
        }

        const conversation = conversationsMap.get(customerId);
        conversation.messages.push(msg);
        
        // Count unread inbound messages
        if (msg.direction === 'inbound' && msg.status !== 'read') {
          conversation.unreadCount++;
        }
      });

      const conversations = Array.from(conversationsMap.values());

      return NextResponse.json({ data: conversations });
    }
  } catch (err: any) {
    console.error('Failed to fetch SMS conversations:', err);
    return NextResponse.json(
      { error: 'Failed to fetch conversations', details: err?.message },
      { status: 500 }
    );
  }
};
