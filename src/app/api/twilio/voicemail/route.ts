import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-crm';

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.formData();

    const recordingUrl = body.get('RecordingUrl')?.toString() || '';
    const recordingSid = body.get('RecordingSid')?.toString() || '';
    const callSid = body.get('CallSid')?.toString() || '';
    const callerNumber = body.get('From')?.toString() || body.get('Caller')?.toString() || '';
    const duration = parseInt(body.get('RecordingDuration')?.toString() || '0', 10);

    if (!recordingUrl || !recordingSid || !callSid) {
      return NextResponse.json({ error: 'Missing required Twilio fields' }, { status: 400 });
    }

    // Save voicemail to Supabase immediately — respond fast so Twilio doesn't timeout
    const { data: voicemail, error: dbError } = await supabase
      .from('voicemails')
      .insert({
        caller_number: callerNumber,
        recording_url: recordingUrl,
        recording_sid: recordingSid,
        call_sid: callSid,
        duration: Number.isFinite(duration) ? duration : null,
        status: 'new',
      })
      .select()
      .single();

    if (dbError) {
      console.error('[voicemail webhook] DB insert error:', dbError);
      return NextResponse.json({ error: 'Failed to save voicemail' }, { status: 500 });
    }

    // Fire transcription in the background — don't await so Twilio gets a fast 200
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    fetch(`${baseUrl}/api/twilio/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voicemailId: voicemail.id,
        recordingUrl,
        internalSecret: process.env.INTERNAL_API_SECRET || '',
      }),
    }).catch((err) => {
      console.error('[voicemail webhook] Failed to trigger transcription:', err);
    });

    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (err: any) {
    console.error('[voicemail webhook] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
};
