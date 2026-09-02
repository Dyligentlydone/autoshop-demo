/**
 * TWILIO FUNCTION — Voicemail Handler
 *
 * Paste this into Twilio Functions (Functions > Create Function).
 * Set the path to: /voicemail
 *
 * Environment Variables to add in Twilio Function settings:
 *   BACKEND_URL    = https://your-railway-app.up.railway.app
 *   API_SECRET     = (same value as INTERNAL_API_SECRET in your .env.local / Railway)
 *   SHOP_ID        = acme-tire
 */

exports.handler = async function (context, event, callback) {
  const twiml = new Twilio.twiml.VoiceResponse();

  const payload = {
    shop_id: context.SHOP_ID || 'acme-tire',
    call_sid: event.CallSid || '',
    recording_sid: event.RecordingSid || '',
    caller_number: event.From || event.Caller || '',
    recording_url: event.RecordingUrl || '',
    recording_duration: event.RecordingDuration ? parseInt(event.RecordingDuration, 10) : null,
  };

  if (!payload.recording_sid || !payload.recording_url) {
    console.error('[voicemail fn] Missing RecordingSid or RecordingUrl', event);
    return callback(null, twiml);
  }

  try {
    const backendUrl = context.BACKEND_URL;
    const apiSecret = context.API_SECRET || '';

    const response = await fetch(`${backendUrl}/api/voicemails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-secret': apiSecret,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[voicemail fn] Backend error:', response.status, text);
    } else {
      const json = await response.json();
      console.log('[voicemail fn] Saved voicemail:', json.id);
    }
  } catch (err) {
    console.error('[voicemail fn] Unexpected error:', err);
  }

  // Return empty TwiML — Twilio just needs a 200 response
  return callback(null, twiml);
};
