import { NextRequest, NextResponse } from 'next/server';
import {
  auditLog,
  getRequestId,
  jsonError,
  normalizePhone,
  requireAgentKey,
  splitName,
  zohoLookupCustomerByEmail,
  zohoLookupCustomerByName,
  zohoLookupCustomerByPhone,
} from '../../_shared';
import { USE_SUPABASE_CRM } from '@/lib/feature-flags';
import {
  supabaseLookupCustomerByPhone,
  supabaseLookupCustomerByEmail,
  supabaseLookupCustomerByName,
} from '@/lib/supabase-crm';

export const POST = async (req: NextRequest) => {
  const requestId = getRequestId(req);
  const auth = requireAgentKey(req);
  if (!auth.ok) {
    auditLog({ requestId, action: 'customer.lookup', success: false, status: 401, error: 'unauthorized' });
    return auth.response;
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    auditLog({ requestId, action: 'customer.lookup', success: false, status: 400, error: 'invalid_json' });
    return jsonError(400, 'Invalid JSON');
  }

  const phone = normalizePhone(body?.phone);
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const name = typeof body?.name === 'string' ? body.name.trim() : '';

  if (!phone && !email && !name) {
    auditLog({ requestId, action: 'customer.lookup', success: false, status: 400, error: 'missing_criteria' });
    return jsonError(400, 'At least one lookup field is required', {
      requiredOneOf: ['phone', 'email', 'name'],
    });
  }

  try {
    let customer = null;

    if (USE_SUPABASE_CRM) {
      // Use Supabase
      if (phone) customer = await supabaseLookupCustomerByPhone(phone);
      if (!customer && email) customer = await supabaseLookupCustomerByEmail(email);
      if (!customer && name) customer = await supabaseLookupCustomerByName(name);
    } else {
      // Use Zoho
      if (phone) customer = await zohoLookupCustomerByPhone(phone);
      if (!customer && email) customer = await zohoLookupCustomerByEmail(email);
      if (!customer && name) customer = await zohoLookupCustomerByName(name);
    }

    const found = Boolean(customer);

    auditLog({
      requestId,
      action: 'customer.lookup',
      success: true,
      status: 200,
      customerId: customer?.id,
    });

    return NextResponse.json({
      found,
      customer: customer || undefined,
      normalized: {
        phone: phone || undefined,
        email: email || undefined,
        name: name || undefined,
        ...(name ? splitName(name) : {}),
      },
      requestId,
    });
  } catch (err: any) {
    auditLog({ requestId, action: 'customer.lookup', success: false, status: 500, error: USE_SUPABASE_CRM ? 'supabase_error' : 'zoho_error' });
    return jsonError(500, 'Failed to lookup customer');
  }
};
