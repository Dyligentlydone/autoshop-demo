
import { NextRequest, NextResponse } from 'next/server';
import { makeZohoServerRequest } from '@/lib/zoho/request-server';

const handler = async (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => {
  const { path } = await ctx.params;
  const search = req.nextUrl.search;
  const endpoint = `/${path.join('/')}${search}`;

  let data: unknown = undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      data = await req.json();
    } catch {
      data = undefined;
    }
  }

  try {
    const result = await makeZohoServerRequest<unknown>({
      method: req.method as any,
      endpoint,
      data,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    const status = err?.response?.status || 500;
    const payload = err?.response?.data || { error: err?.message || 'Zoho request failed' };
    return NextResponse.json(payload, { status });
  }
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
