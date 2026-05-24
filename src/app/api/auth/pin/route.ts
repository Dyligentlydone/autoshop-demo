import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const AUTH_COOKIE_NAME = 'app_auth';

const toBase64Url = (buf: Buffer) =>
  buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

export const POST = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const pin = typeof body?.pin === 'string' ? body.pin.trim() : '';

  const expected = process.env.OWNER_APP_PIN || '';
  const secret = process.env.AUTH_SECRET || '';

  if (!/^\d{4}$/.test(pin) || !expected || !secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (pin !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = {
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30,
  };

  const payloadB64 = toBase64Url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest();
  const token = `${payloadB64}.${toBase64Url(sig)}`;

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
};
