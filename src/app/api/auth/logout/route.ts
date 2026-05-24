import { NextResponse } from 'next/server';

const AUTH_COOKIE_NAME = 'app_auth';

export const POST = async () => {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return res;
};
