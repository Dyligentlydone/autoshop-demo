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
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const ok = await crypto.subtle.verify(
    { name: 'HMAC' },
    key,
    toArrayBuffer(sigBytes),
    toArrayBuffer(enc.encode(payloadB64))
  );
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

  if (pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/agent')) {
    return NextResponse.next();
  }

  if (pathname === '/login' || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value || '';
  const authed = token ? await verifyAuthCookie(token) : false;

  if (pathname.startsWith('/api')) {
    if (!authed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (!authed) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
};

export const config = {
  matcher: ['/((?!.*\\..*).*)'],
};
