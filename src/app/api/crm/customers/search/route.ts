import { NextRequest, NextResponse } from 'next/server';
import { makeZohoServerRequest } from '@/lib/zoho/request-server';
import { normalizeCustomer, ZohoListResponse } from '../../_shared';
import { USE_SUPABASE_CRM } from '@/lib/feature-flags';
import { supabaseLookupCustomerByPhone } from '@/lib/supabase-crm';

const CONTACTS_MODULE = 'Contacts';

export const GET = async (req: NextRequest) => {
  const phone = req.nextUrl.searchParams.get('phone');
  if (!phone) {
    return NextResponse.json({ error: 'phone is required' }, { status: 400 });
  }

  const fields = ['id', 'First_Name', 'Last_Name', 'Phone', 'Email'].join(',');

  try {
    if (USE_SUPABASE_CRM) {
      const customer = await supabaseLookupCustomerByPhone(phone);
      return NextResponse.json({ data: customer });
    } else {
      const resp = await makeZohoServerRequest<ZohoListResponse<any>>({
        method: 'GET',
        endpoint: `/${CONTACTS_MODULE}/search?criteria=(Phone:equals:${encodeURIComponent(phone)})&fields=${encodeURIComponent(fields)}`,
      });

      const c = resp.data?.[0] ? normalizeCustomer(resp.data[0]) : null;
      return NextResponse.json({ data: c });
    }
  } catch (err: any) {
    const s = err?.response?.status || 500;
    return NextResponse.json({ error: 'Failed to search customer' }, { status: s });
  }
};
