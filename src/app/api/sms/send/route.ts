import { NextRequest, NextResponse } from 'next/server';
import { sendEstimateSMS, sendSMS } from '@/lib/twilio';
import { supabase } from '@/lib/supabase-crm';

// Convert local attachment URLs to public Supabase signed URLs that Twilio can access
const resolvePhotoUrls = async (repairOrderId: string): Promise<string[]> => {
  if (!repairOrderId) return [];

  // Fetch attachments from database
  const { data: attachments, error } = await supabase
    .from('repair_order_attachments')
    .select('file_path')
    .eq('repair_order_id', repairOrderId);

  if (error || !attachments?.length) return [];

  // Generate signed URLs (valid for 1 hour) so Twilio can download them
  const publicUrls: string[] = [];
  for (const att of attachments) {
    const { data: signedData } = await supabase.storage
      .from('repair-order-attachments')
      .createSignedUrl(att.file_path, 3600); // 1 hour expiry

    if (signedData?.signedUrl) {
      publicUrls.push(signedData.signedUrl);
    }
  }

  return publicUrls;
};

// Normalize phone to E.164 format for Twilio (e.g. "616-970-1109" → "+16169701109")
const normalizePhoneE164 = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('1') && digits.length === 11) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (phone.startsWith('+')) return phone; // already E.164
  return `+${digits}`;
};

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();
    const {
      type,
      message,
      repairOrderId,
      customerId,
      estimateData,
      mediaUrls,
    } = body;

    if (!body.to) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const to = normalizePhoneE164(body.to);

    let twilioResult;
    let messageBody;
    let messageType = type || 'general';

    if (type === 'estimate' && estimateData) {
      // Get public URLs for photos so Twilio can send them as MMS
      const includePhotos = estimateData.photoUrls?.length > 0;
      const publicPhotoUrls = includePhotos
        ? await resolvePhotoUrls(repairOrderId)
        : [];

      // Use custom edited message if provided, otherwise generate from template
      if (message) {
        // User edited the message in the modal — send their version
        twilioResult = await sendSMS({
          to,
          message,
          mediaUrls: publicPhotoUrls,
        });
        messageBody = message;
      } else {
        // Send formatted estimate from template
        twilioResult = await sendEstimateSMS({
          ...estimateData,
          customerPhone: to,
          repairOrderId,
          photoUrls: publicPhotoUrls,
        });
        messageBody = twilioResult.body;
      }
    } else {
      // Send custom message
      if (!message) {
        return NextResponse.json({ error: 'Message is required' }, { status: 400 });
      }
      twilioResult = await sendSMS({ to, message, mediaUrls });
      messageBody = message;
    }

    // Save to database
    const { data: smsRecord, error: dbError } = await supabase
      .from('sms_messages')
      .insert({
        repair_order_id: repairOrderId || null,
        customer_id: customerId || null,
        direction: 'outbound',
        from_number: twilioResult.from,
        to_number: twilioResult.to,
        message_body: messageBody,
        message_type: messageType,
        twilio_sid: twilioResult.sid,
        status: twilioResult.status,
        metadata: {
          ...(estimateData || {}),
          mediaUrls: mediaUrls || estimateData?.photoUrls || [],
        },
      })
      .select()
      .single();

    if (dbError) {
      console.error('Failed to save SMS to database:', dbError);
      // Don't fail the request if DB save fails, SMS was still sent
    }

    return NextResponse.json({
      success: true,
      message: 'SMS sent successfully',
      data: {
        sid: twilioResult.sid,
        status: twilioResult.status,
        to: twilioResult.to,
        smsRecord,
      },
    });
  } catch (err: any) {
    console.error('SMS send error:', err);
    return NextResponse.json(
      {
        error: 'Failed to send SMS',
        details: err?.message || String(err),
      },
      { status: 500 }
    );
  }
};
