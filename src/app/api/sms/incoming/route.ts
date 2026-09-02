import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-crm';

// Empty TwiML — prevents Twilio's default "Configure your number's SMS URL" reply
const EMPTY_TWIML = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

const twimlResponse = () =>
  new Response(EMPTY_TWIML, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });

// Normalize a phone number to last 10 digits for matching against stored customer phones
const last10 = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.slice(-10);
};

/**
 * POST /api/sms/incoming
 *
 * Twilio webhook endpoint for inbound SMS / MMS messages.
 * Configure this URL on the Twilio phone number's "A Message Comes In" setting.
 *
 * - Saves the inbound message to `sms_messages`
 * - Attempts to match the sender phone to a known customer
 * - Returns empty TwiML so Twilio sends no auto-reply
 */
export const POST = async (req: NextRequest) => {
  try {
    const form = await req.formData();

    const fromNumber = String(form.get('From') || '');
    const toNumber = String(form.get('To') || '');
    const body = String(form.get('Body') || '');
    const twilioSid = String(form.get('MessageSid') || form.get('SmsSid') || '');
    const numMedia = parseInt(String(form.get('NumMedia') || '0'), 10) || 0;

    // Collect media URLs and content types (Twilio sends MediaUrl0/MediaContentType0, etc.)
    const mediaUrls: string[] = [];
    const mediaTypes: string[] = [];
    for (let i = 0; i < numMedia; i++) {
      const url = form.get(`MediaUrl${i}`);
      const type = form.get(`MediaContentType${i}`);
      if (url) {
        mediaUrls.push(String(url));
        mediaTypes.push(type ? String(type) : 'image/jpeg');
      }
    }

    // Try to match the sender phone to an existing customer
    let customerId: string | null = null;
    let repairOrderId: string | null = null;
    const phoneTail = last10(fromNumber);

    if (phoneTail) {
      try {
        // Try a few common phone formats stored in the DB
        const variants = [
          phoneTail,
          `+1${phoneTail}`,
          `1${phoneTail}`,
          `(${phoneTail.slice(0, 3)}) ${phoneTail.slice(3, 6)}-${phoneTail.slice(6)}`,
          `${phoneTail.slice(0, 3)}-${phoneTail.slice(3, 6)}-${phoneTail.slice(6)}`,
          fromNumber,
        ];
        const { data: customers } = await supabase
          .from('customers')
          .select('id, phone')
          .in('phone', variants);

        // Fallback: scan via ilike on the last 10 digits if exact match failed
        let match: { id: string; phone: string } | undefined = (customers || [])[0];
        if (!match) {
          const { data: fuzzy } = await supabase
            .from('customers')
            .select('id, phone')
            .ilike('phone', `%${phoneTail.slice(-7)}%`);
          match = (fuzzy || []).find((c: any) => last10(c?.phone) === phoneTail);
        }

        if (match) {
          customerId = match.id;
          // Find their most recent repair order to associate the reply with
          const { data: ro } = await supabase
            .from('repair_orders')
            .select('id')
            .eq('customer_id', match.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (ro?.id) repairOrderId = ro.id;
        }
      } catch (matchErr) {
        console.error('[sms/incoming] customer match failed:', matchErr);
      }
    }

    // Persist the inbound message
    const { error: insertErr } = await supabase.from('sms_messages').insert({
      repair_order_id: repairOrderId,
      customer_id: customerId,
      direction: 'inbound',
      from_number: fromNumber,
      to_number: toNumber,
      message_body: body,
      message_type: 'reply',
      twilio_sid: twilioSid,
      status: 'received',
      metadata: {
        mediaUrls,
        mediaTypes,
        matchedCustomer: !!customerId,
      },
    });

    if (insertErr) {
      console.error('[sms/incoming] failed to save inbound message:', insertErr);
    } else {
      console.log(
        `[sms/incoming] saved inbound SMS from ${fromNumber} (customer ${customerId || 'unknown'})`
      );
    }

    return twimlResponse();
  } catch (err) {
    console.error('[sms/incoming] error:', err);
    // Always return valid TwiML so Twilio doesn't show its default message
    return twimlResponse();
  }
};

// Some Twilio configs may send a verification GET — respond OK
export const GET = () => twimlResponse();
