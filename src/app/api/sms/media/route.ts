import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/sms/media?url=<twilio_media_url>
 *
 * Server-side proxy for Twilio MMS media. Twilio media URLs require Basic Auth
 * (Account SID + Auth Token) that cannot be provided from the browser directly.
 * This route fetches the media with credentials and streams it back.
 *
 * Restricted to authenticated shop users by the PIN middleware.
 * Only Twilio CDN URLs are allowed through.
 */
export const GET = async (req: NextRequest) => {
  const url = req.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'url parameter required' }, { status: 400 });
  }

  // Restrict to known Twilio media origins only
  const allowed =
    url.startsWith('https://api.twilio.com/') ||
    url.startsWith('https://media.twiliocdn.com/') ||
    url.startsWith('https://mcs.us1.twilio.com/');

  if (!allowed) {
    return NextResponse.json({ error: 'Invalid media URL' }, { status: 400 });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
  const authToken = process.env.TWILIO_AUTH_TOKEN || '';

  if (!accountSid || !authToken) {
    return NextResponse.json({ error: 'Twilio credentials not configured' }, { status: 500 });
  }

  try {
    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const mediaRes = await fetch(url, {
      headers: { Authorization: authHeader },
    });

    if (!mediaRes.ok) {
      console.error(`[sms/media] Twilio returned ${mediaRes.status} for ${url}`);
      return NextResponse.json({ error: 'Failed to fetch media from Twilio' }, { status: mediaRes.status });
    }

    const contentType = mediaRes.headers.get('Content-Type') || 'application/octet-stream';
    const body = await mediaRes.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=86400',
      },
    });
  } catch (err: any) {
    console.error('[sms/media] error:', err);
    return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 });
  }
};
