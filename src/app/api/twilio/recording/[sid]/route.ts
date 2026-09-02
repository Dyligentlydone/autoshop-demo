import { NextRequest, NextResponse } from 'next/server';

// Proxy Twilio recording audio to the browser
// Twilio requires Basic Auth — the browser can't supply that directly
export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ sid: string }> }
) => {
  const { sid } = await params;
  if (!sid) {
    return NextResponse.json({ error: 'Missing recording SID' }, { status: 400 });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return NextResponse.json({ error: 'Twilio credentials not configured' }, { status: 500 });
  }

  const recordingUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${sid}.mp3`;
  const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  try {
    const twilioRes = await fetch(recordingUrl, {
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
    console.error('[recording proxy] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch recording' }, { status: 500 });
  }
};
