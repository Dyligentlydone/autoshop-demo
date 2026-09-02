import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-crm';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const extractJson = (text: string) => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
};

export const POST = async (req: NextRequest) => {
  // Guard: internal-only endpoint. Exempt from the PIN gate, so the shared
  // secret is the only protection — refuse to run if it isn't configured.
  const body = await req.json();
  const secret = body?.internalSecret || '';
  const expected = process.env.INTERNAL_API_SECRET || '';
  if (!expected) {
    console.error('[transcribe] INTERNAL_API_SECRET is not set — rejecting request');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  if (secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { voicemailId, recordingUrl } = body;
  if (!voicemailId || !recordingUrl) {
    return NextResponse.json({ error: 'Missing voicemailId or recordingUrl' }, { status: 400 });
  }

  if (!OPENAI_API_KEY) {
    console.warn('[transcribe] No OPENAI_API_KEY — skipping transcription');
    return NextResponse.json({ skipped: true });
  }

  try {
    // Twilio recording URLs need .mp3 extension for OpenAI Whisper
    const audioUrl = recordingUrl.endsWith('.mp3') ? recordingUrl : `${recordingUrl}.mp3`;

    // Download audio from Twilio (authenticated)
    const accountSid =
      process.env.TWILIO_VOICEMAIL_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID || '';
    const authToken =
      process.env.TWILIO_VOICEMAIL_AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN || '';
    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const audioRes = await fetch(audioUrl, {
      headers: { Authorization: authHeader },
    });

    if (!audioRes.ok) {
      throw new Error(`Failed to fetch recording: ${audioRes.status}`);
    }

    const audioBuffer = await audioRes.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });

    // Transcribe with Whisper
    const formData = new FormData();
    formData.append('file', audioBlob, 'voicemail.mp3');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: formData,
    });

    if (!whisperRes.ok) {
      throw new Error(`Whisper API error: ${whisperRes.status}`);
    }

    const whisperData = await whisperRes.json();
    const transcript: string = whisperData.text || '';

    // Extract structured info with GPT
    const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: `You are an assistant for an auto repair shop. Extract information from voicemail transcripts.
Return ONLY valid JSON with these fields:
{
  "customer_name": string or null,
  "vehicle": string or null,
  "issue": string or null,
  "urgency": "high" | "medium" | "low",
  "summary": string (one sentence, max 120 chars)
}`,
          },
          {
            role: 'user',
            content: `Voicemail transcript:\n"${transcript}"`,
          },
        ],
      }),
    });

    if (!gptRes.ok) {
      throw new Error(`GPT API error: ${gptRes.status}`);
    }

    const gptData = await gptRes.json();
    const rawContent = gptData.choices?.[0]?.message?.content || '{}';
    const extracted = extractJson(rawContent) || {};

    // Update the voicemail record with transcript + AI extraction
    const { error: updateError } = await supabase
      .from('voicemails')
      .update({
        transcript,
        ai_summary: extracted.summary || null,
        ai_customer_name: extracted.customer_name || null,
        ai_vehicle: extracted.vehicle || null,
        ai_issue: extracted.issue || null,
        ai_urgency: extracted.urgency || null,
        status: 'transcribed',
      })
      .eq('id', voicemailId);

    if (updateError) {
      throw new Error(`DB update error: ${updateError.message}`);
    }

    return NextResponse.json({ success: true, transcript, extracted });
  } catch (err: any) {
    console.error('[transcribe] Error:', err);
    // Mark as failed so the UI doesn't keep showing a spinner
    await supabase
      .from('voicemails')
      .update({ status: 'transcription_failed' })
      .eq('id', voicemailId);

    return NextResponse.json({ error: err?.message || 'Transcription failed' }, { status: 500 });
  }
};
