import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const AUTH_COOKIE_NAME = 'app_auth';

const base64UrlToUint8Array = (input: string) => {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 ? '='.repeat(4 - (base64.length % 4)) : '';
  const bin = atob(base64 + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const toArrayBuffer = (u8: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(u8.byteLength);
  copy.set(u8);
  return copy.buffer;
};

const verifyAuthCookie = async (token: string) => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;

  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [payloadB64, sigB64] = parts;

  let payloadBytes: Uint8Array;
  let sigBytes: Uint8Array;
  try {
    payloadBytes = base64UrlToUint8Array(payloadB64);
    sigBytes = base64UrlToUint8Array(sigB64);
  } catch {
    return false;
  }

  const enc = new TextEncoder();

  // Guard the crypto calls: a malformed/stale cookie (e.g. signed with an old
  // secret) must fail closed (return false) rather than throw and 500 the request.
  let ok = false;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    ok = await crypto.subtle.verify(
      { name: 'HMAC' },
      key,
      toArrayBuffer(sigBytes),
      toArrayBuffer(enc.encode(payloadB64))
    );
  } catch {
    return false;
  }
  if (!ok) return false;

  try {
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as { exp?: number };
    if (typeof payload?.exp !== 'number') return false;
    if (Date.now() > payload.exp) return false;
    return true;
  } catch {
    return false;
  }
};

export const middleware = async (req: NextRequest) => {
  const { pathname } = req.nextUrl;

  // Local development: skip the PIN gate entirely. NODE_ENV is always
  // 'production' on Railway, so this never affects the deployed app.
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.next();
  }

  if (pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  // Public customer-facing approval pages (no PIN required)
  if (pathname === '/approve' || pathname.startsWith('/approve/')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/agent')) {
    return NextResponse.next();
  }

  if (pathname === '/login' || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Customer-facing approval token endpoints must remain reachable without PIN
  if (pathname.startsWith('/api/approval-tokens')) {
    return NextResponse.next();
  }

  // Public SMS webhook (Twilio inbound)
  if (pathname.startsWith('/api/sms/incoming')) {
    return NextResponse.next();
  }

  // Twilio voicemail webhooks (called by Twilio Function, no browser auth).
  // POST only — these endpoints validate their own shared secret.
  if (
    req.method === 'POST' &&
    (pathname.startsWith('/api/twilio/voicemail') || pathname.startsWith('/api/twilio/transcribe'))
  ) {
    return NextResponse.next();
  }

  // Voicemail intake endpoint (called by Twilio Function). POST to the exact
  // collection path only — it validates the x-api-secret header itself.
  // GET/PATCH and the /[id]/audio proxy return customer PII, so they must
  // stay behind the PIN gate below.
  if (req.method === 'POST' && pathname === '/api/voicemails') {
    return NextResponse.next();
  }

  // Public webhooks (Zoho, etc.)
  if (pathname.startsWith('/api/webhooks')) {
    return NextResponse.next();
  }

  // Customer-facing payment endpoints (checkout creation + Stripe webhook).
  // Secured by the unguessable approval token / Stripe signature, not the PIN.
  if (pathname.startsWith('/api/payments')) {
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value || '';
  const authed = token ? await verifyAuthCookie(token) : false;

  if (pathname.startsWith('/api')) {
    if (!authed) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      return res;
    }
    return NextResponse.next();
  }

  if (!authed) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    const res = NextResponse.redirect(url);
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res;
  }

  return NextResponse.next();
};

// Match every path EXCEPT Next.js static assets and the favicon.
// Important: the previous matcher '/((?!.*\\..*).*)' silently failed to match
// most routes in production, leaving the app completely unauthenticated.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
