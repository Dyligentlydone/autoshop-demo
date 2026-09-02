import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-crm';

const normalizePhone = (phone: string) => phone.replace(/\D/g, '').slice(-10);

export const GET = async (_req: NextRequest) => {
  const { data, error } = await supabase
    .from('voicemails')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const voicemails = data || [];

  // Collect unique caller numbers and look them up in customers table
  const callerNumbers = Array.from(new Set(voicemails.map((v: any) => v.caller_number).filter(Boolean)));

  let customerMap: Record<string, string> = {};

  if (callerNumbers.length > 0) {
    const { data: customers } = await supabase
      .from('customers')
      .select('id, first_name, last_name, phone');

    if (customers) {
      for (const customer of customers) {
        if (!customer.phone) continue;
        const normalized = normalizePhone(customer.phone);
        if (normalized) {
          const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(' ');
          customerMap[normalized] = fullName || customer.phone;
        }
      }
    }
  }

  // Attach matched_customer_name to each voicemail
  const enriched = voicemails.map((v: any) => {
    const normalized = normalizePhone(v.caller_number || '');
    const matchedName = customerMap[normalized] || null;
    return { ...v, matched_customer_name: matchedName };
  });

  return NextResponse.json({ data: enriched });
};

// Called by the Twilio Function after a voicemail recording is ready
export const POST = async (req: NextRequest) => {
  try {
    // Shared secret to prevent unauthorized POSTs. This route is exempt from
    // the PIN gate so Twilio can reach it, so the secret is the only guard —
    // refuse to serve at all if it isn't configured.
    const secret = req.headers.get('x-api-secret') || '';
    const expected = process.env.INTERNAL_API_SECRET || '';
    if (!expected) {
      console.error('[POST /api/voicemails] INTERNAL_API_SECRET is not set — rejecting request');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    if (secret !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      shop_id,
      call_sid,
      recording_sid,
      caller_number,
      recording_url,
      recording_duration,
    } = body;

    if (!recording_sid || !recording_url) {
      return NextResponse.json({ error: 'recording_sid and recording_url are required' }, { status: 400 });
    }

    const { data: voicemail, error: dbError } = await supabase
      .from('voicemails')
      .insert({
        shop_id: shop_id || 'demo_shop',
        caller_number: caller_number || '',
        recording_url,
        recording_sid,
        call_sid: call_sid || '',
        duration: recording_duration ? parseInt(String(recording_duration), 10) : null,
        status: 'new',
      })
      .select()
      .single();

    if (dbError) {
      console.error('[POST /api/voicemails] DB error:', dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    // Fire transcription in the background
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    fetch(`${baseUrl}/api/twilio/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voicemailId: voicemail.id,
        recordingUrl: recording_url,
        internalSecret: process.env.INTERNAL_API_SECRET || '',
      }),
    }).catch((err) => console.error('[POST /api/voicemails] Transcription trigger failed:', err));

    return NextResponse.json({ success: true, id: voicemail.id }, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/voicemails] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
};

export const PATCH = async (req: NextRequest) => {
  const body = await req.json();
  const { id, status } = body;

  if (!id || !status) {
    return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('voicemails')
    .update({ status })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
};
