import { NextRequest, NextResponse } from 'next/server';
import { makeZohoServerRequest } from '@/lib/zoho/request-server';
import { normalizeCustomer } from '../_shared';
import { USE_SUPABASE_CRM } from '@/lib/feature-flags';
import { supabaseCreateCustomer } from '@/lib/supabase-crm';

const CONTACTS_MODULE = 'Contacts';

const FIELDS = ['id', 'First_Name', 'Last_Name', 'Phone', 'Email'].join(',');

export const POST = async (req: NextRequest) => {
  const body = await req.json();

  const phone = body?.phone;
  const firstName = body?.first_name;
  const lastName = body?.last_name;
  const email = body?.email;

  if (!phone) {
    return NextResponse.json({ error: 'phone is required' }, { status: 400 });
  }

  const payload = {
    data: [
      {
        Phone: phone,
        ...(firstName ? { First_Name: firstName } : {}),
        ...(lastName ? { Last_Name: lastName } : {}),
        ...(email ? { Email: email } : {}),
      },
    ],
  };

  try {
    if (USE_SUPABASE_CRM) {
      const customer = await supabaseCreateCustomer({
        phone,
        first_name: firstName || '',
        last_name: lastName || '',
        email: email || undefined,
      });
      return NextResponse.json({ data: customer }, { status: 201 });
    } else {
      const created = await makeZohoServerRequest<any>({
        method: 'POST',
        endpoint: `/${CONTACTS_MODULE}`,
        data: payload,
      });

      const id = created?.data?.[0]?.details?.id;
      if (!id) {
        return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
      }

      const got = await makeZohoServerRequest<any>({
        method: 'GET',
        endpoint: `/${CONTACTS_MODULE}/${id}?fields=${encodeURIComponent(FIELDS)}`,
      });

      return NextResponse.json({ data: normalizeCustomer(got.data?.[0]) }, { status: 201 });
    }
  } catch (err: any) {
    const s = err?.response?.status || 500;
    return NextResponse.json({ error: 'Failed to create customer' }, { status: s });
  }
};
