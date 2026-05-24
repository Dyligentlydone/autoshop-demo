import { NextRequest, NextResponse } from 'next/server';
import { makeZohoServerRequest } from '@/lib/zoho/request-server';
import { normalizeCustomer } from '../../_shared';
import { USE_SUPABASE_CRM } from '@/lib/feature-flags';
import { supabaseGetCustomer, supabaseUpdateCustomer } from '@/lib/supabase-crm';

const CONTACTS_MODULE = 'Contacts';

export const GET = async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const full = req.nextUrl.searchParams.get('full') === '1';

  try {
    if (USE_SUPABASE_CRM) {
      const customer = await supabaseGetCustomer(id);
      if (!customer) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      }
      return NextResponse.json({ data: customer, raw: customer });
    } else {
      const got = await makeZohoServerRequest<any>({
        method: 'GET',
        endpoint: full ? `/${CONTACTS_MODULE}/${id}` : `/${CONTACTS_MODULE}/${id}?fields=${encodeURIComponent('id,First_Name,Last_Name,Phone,Email')}`,
      });

      const raw = got?.data?.[0];
      return NextResponse.json({ data: normalizeCustomer(raw), raw });
    }
  } catch (err: any) {
    const s = err?.response?.status || 500;
    return NextResponse.json({ error: 'Failed to fetch customer' }, { status: s });
  }
};

export const PATCH = async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const body = await req.json();

  try {
    if (USE_SUPABASE_CRM) {
      const updates: any = {};
      if (body?.first_name !== undefined) updates.first_name = body.first_name || '';
      if (body?.last_name !== undefined) updates.last_name = body.last_name || '';
      if (body?.phone !== undefined) updates.phone = body.phone || '';
      if (body?.email !== undefined) updates.email = body.email || '';

      const customer = await supabaseUpdateCustomer(id, updates);
      return NextResponse.json({ data: customer, raw: customer });
    } else {
      const data: Record<string, any> = {
        id,
        ...(body?.first_name !== undefined ? { First_Name: body.first_name || '' } : {}),
        ...(body?.last_name !== undefined ? { Last_Name: body.last_name || '' } : {}),
        ...(body?.phone !== undefined ? { Phone: body.phone || '' } : {}),
        ...(body?.email !== undefined ? { Email: body.email || '' } : {}),
        ...(body?.rawUpdates && typeof body.rawUpdates === 'object' ? body.rawUpdates : {}),
      };

      const payload = { data: [data] };

      await makeZohoServerRequest<any>({
        method: 'PUT',
        endpoint: `/${CONTACTS_MODULE}`,
        data: payload,
      });

      const got = await makeZohoServerRequest<any>({
        method: 'GET',
        endpoint: `/${CONTACTS_MODULE}/${id}`,
      });

      const raw = got?.data?.[0];
      return NextResponse.json({ data: normalizeCustomer(raw), raw });
    }
  } catch (err: any) {
    const s = err?.response?.status || 500;
    return NextResponse.json({ error: 'Failed to update customer' }, { status: s });
  }
};
