import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-crm';

// Looks up voicemail by ID, then proxies the audio from Twilio
// Keeps raw Twilio credentials off the client
export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing voicemail id' }, { status: 400 });
  }

  const { data: voicemail, error: dbError } = await supabase
    .from('voicemails')
    .select('recording_sid, recording_url')
    .eq('id', id)
    .single();

  if (dbError || !voicemail) {
    return NextResponse.json({ error: 'Voicemail not found' }, { status: 404 });
  }

  const accountSid =
    process.env.TWILIO_VOICEMAIL_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID;
  const authToken =
    process.env.TWILIO_VOICEMAIL_AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return NextResponse.json({ error: 'Twilio credentials not configured' }, { status: 500 });
  }

  // Ensure .mp3 extension for playback
  const audioUrl = voicemail.recording_url.endsWith('.mp3')
    ? voicemail.recording_url
    : `${voicemail.recording_url}.mp3`;

  const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  try {
    const twilioRes = await fetch(audioUrl, {
      headers: { Authorization: authHeader },
    });

    if (!twilioRes.ok) {
      return NextResponse.json(
        { error: `Twilio returned ${twilioRes.status}` },
        { status: twilioRes.status }
      );
    }

    const audioBuffer = await twilioRes.arrayBuffer();

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err: any) {
    console.error('[voicemail audio proxy] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch recording' }, { status: 500 });
  }
};
