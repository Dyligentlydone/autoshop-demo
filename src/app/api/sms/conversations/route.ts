import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-crm';

export const DELETE = async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { customerId, phoneNumber } = body;

    if (!customerId && !phoneNumber) {
      return NextResponse.json(
        { error: 'customerId or phoneNumber is required' },
        { status: 400 }
      );
    }

    let query = supabase.from('sms_messages').delete();

    if (customerId) {
      query = query.eq('customer_id', customerId);
    } else if (phoneNumber) {
      query = query.eq('from_number', phoneNumber).or(`to_number.eq.${phoneNumber}`);
    }

    const { error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Failed to delete conversation:', err);
    return NextResponse.json(
      { error: 'Failed to delete conversation', details: err?.message },
      { status: 500 }
    );
  }
};

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

      const otherPartyPhone = (msg: any) =>
        msg.direction === 'inbound' ? msg.from_number : msg.to_number;

      const last10 = (raw: string | null | undefined): string | null => {
        if (!raw) return null;
        const digits = raw.replace(/\D/g, '');
        if (digits.length < 10) return null;
        return digits.slice(-10);
      };

      // Build a phone -> customer map by resolving any messages without a customer_id
      const orphanPhoneTails = new Set<string>();
      (data || []).forEach((msg: any) => {
        if (!msg.customer_id) {
          const tail = last10(otherPartyPhone(msg));
          if (tail) orphanPhoneTails.add(tail);
        }
      });

      const phoneToCustomer = new Map<string, any>();
      if (orphanPhoneTails.size > 0) {
        // Fetch all customers and match on last 10 digits (handles every format)
        const { data: allCustomers } = await supabase
          .from('customers')
          .select('id, first_name, last_name, phone');
        (allCustomers || []).forEach((c: any) => {
          const tail = last10(c?.phone);
          if (tail && orphanPhoneTails.has(tail)) {
            phoneToCustomer.set(tail, c);
          }
        });
      }

      // Group by customer when known (or resolvable via phone), otherwise by phone
      const conversationsMap = new Map();

      (data || []).forEach((msg: any) => {
        let resolvedCustomer = msg.customer || null;
        let resolvedCustomerId = msg.customer_id || null;

        // If this message has no customer but the phone matches one, attach it
        if (!resolvedCustomerId) {
          const tail = last10(otherPartyPhone(msg));
          const match = tail ? phoneToCustomer.get(tail) : null;
          if (match) {
            resolvedCustomer = match;
            resolvedCustomerId = match.id;
          }
        }

        const key =
          resolvedCustomerId || `phone:${otherPartyPhone(msg) || 'unknown'}`;

        if (!conversationsMap.has(key)) {
          conversationsMap.set(key, {
            customer: resolvedCustomer,
            phoneNumber: otherPartyPhone(msg) || null,
            messages: [],
            lastMessage: msg,
            unreadCount: 0,
          });
        }

        const conversation = conversationsMap.get(key);
        // Backfill customer on the conversation in case the first message
        // we hit (newest) had no customer but a later one did
        if (!conversation.customer && resolvedCustomer) {
          conversation.customer = resolvedCustomer;
        }
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
