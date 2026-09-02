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
// Returns null if the number is not a valid US/Canada phone number
const normalizePhoneE164 = (phone: string): string | null => {
  if (!phone || typeof phone !== 'string') return null;
  const trimmed = phone.trim();

  // Already E.164 — validate it has 10-15 digits after the +
  if (trimmed.startsWith('+')) {
    const digitsOnly = trimmed.slice(1).replace(/\D/g, '');
    if (digitsOnly.length < 10 || digitsOnly.length > 15) return null;
    return `+${digitsOnly}`;
  }

  const digits = trimmed.replace(/\D/g, '');

  // US/Canada: 11 digits starting with 1
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  // US/Canada: 10 digits (no country code)
  if (digits.length === 10) {
    // First digit (area code) must be 2-9 per NANP rules
    if (digits[0] === '0' || digits[0] === '1') return null;
    return `+1${digits}`;
  }

  return null;
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
    if (!to) {
      return NextResponse.json(
        {
          error: 'Invalid phone number',
          details: 'Please enter a valid US/Canada phone number (10 digits, e.g. 616-555-1234).',
        },
        { status: 400 }
      );
    }

    let twilioResult;
    let messageBody;
    let messageType = type || 'general';

    if (type === 'estimate' && estimateData) {
      // Use the approval URL passed from the modal, or generate a new one if not provided
      let approvalUrl = estimateData.approvalUrl || '';
      
      if (!approvalUrl && repairOrderId && customerId) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          console.log('Generating approval token for repair order:', repairOrderId);
          const tokenRes = await fetch(`${baseUrl}/api/approval-tokens/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              repairOrderId,
              customerId,
              expiryDays: 30,
            }),
          });

          const tokenData = await tokenRes.json();
          console.log('Token generation response:', tokenData);

          if (tokenRes.ok && tokenData.approvalUrl) {
            approvalUrl = tokenData.approvalUrl;
            console.log('Approval URL generated:', approvalUrl);
          } else {
            console.error('Token generation failed:', tokenData.error || 'Unknown error');
          }
        } catch (err) {
          console.error('Failed to generate approval token:', err);
        }
      }

      // Photos are referenced in the message body (so the customer knows
      // there are photos to view) but NOT attached as MMS — they live on
      // the approval page. Keeps every send as a cheap A2P SMS.

      // TCPA-style compliance footer + shop sign-off appended only on the
      // actual send (so it's not shown in the preview/sample in the modal).
      const complianceFooter =
        '\n\nReply STOP to unsubscribe or HELP for assistance anytime!' +
        '\n\n- Demo Auto Shop';

      // Use custom edited message if provided, otherwise generate from template
      if (message) {
        // User edited the message in the modal — send their version
        // Append approval link if available, then compliance footer
        let finalMessage = approvalUrl
          ? `${message}\n\nYour details are here: ${approvalUrl}`
          : message;
        finalMessage += complianceFooter;

        twilioResult = await sendSMS({
          to,
          message: finalMessage,
        });
        messageBody = finalMessage;
      } else {
        // Send formatted estimate from template with approval link
        twilioResult = await sendEstimateSMS({
          ...estimateData,
          customerPhone: to,
          repairOrderId,
          // Pass photo + video counts through so the body mentions them.
          // sendEstimateSMS skips MMS attachment for cost.
          photoUrls: estimateData.photoUrls || [],
          videoUrls: estimateData.videoUrls || [],
          approvalUrl,
          complianceFooter,
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
