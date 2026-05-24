import { NextRequest, NextResponse } from 'next/server';
import {
  auditLog,
  getRequestId,
  jsonError,
  normalizePhone,
  requireAgentKey,
  splitName,
  zohoCreateCustomer,
  zohoCreateRepairOrder,
  zohoCreateVehicle,
  zohoLookupCustomerByPhone,
} from '../../_shared';
import { clearCache } from '../../../crm/repair-orders/cache';
import { USE_SUPABASE_CRM } from '@/lib/feature-flags';
import {
  supabaseLookupCustomerByPhone,
  supabaseCreateCustomer,
  supabaseCreateVehicle,
  supabaseCreateRepairOrder,
} from '@/lib/supabase-crm';

export const POST = async (req: NextRequest) => {
  const requestId = getRequestId(req);
  const auth = requireAgentKey(req);
  if (!auth.ok) {
    auditLog({ requestId, action: 'repair_orders.create', success: false, status: 401, error: 'unauthorized' });
    return auth.response;
  }

  let body: any;
  try {
    body = await req.json();
    console.log('[repair-orders/create] Received body:', JSON.stringify(body, null, 2));
  } catch {
    auditLog({ requestId, action: 'repair_orders.create', success: false, status: 400, error: 'invalid_json' });
    return jsonError(400, 'Invalid JSON');
  }

  const customer = body?.customer || {};
  const vehicle = body?.vehicle || {};
  const repairOrder = body?.repairOrder || {};

  const phone = normalizePhone(customer?.phone);
  const email = typeof customer?.email === 'string' ? customer.email.trim() : '';
  const name = typeof customer?.name === 'string' ? customer.name.trim() : '';

  const year = typeof vehicle?.year === 'string' ? vehicle.year.trim() : '';
  const make = typeof vehicle?.make === 'string' ? vehicle.make.trim() : '';
  const model = typeof vehicle?.model === 'string' ? vehicle.model.trim() : '';
  const plate = typeof vehicle?.plate === 'string' ? vehicle.plate.trim() : '';
  const vin = typeof vehicle?.vin === 'string' ? vehicle.vin.trim() : '';

  const serviceType = typeof repairOrder?.serviceType === 'string' ? repairOrder.serviceType.trim() : '';
  const jobDescription = typeof repairOrder?.jobDescription === 'string' ? repairOrder.jobDescription.trim() : '';
  const notes = typeof repairOrder?.notes === 'string' ? repairOrder.notes.trim() : '';
  const status = typeof repairOrder?.status === 'string' ? repairOrder.status.trim() : '';
  const rawDropOff = typeof repairOrder?.scheduledDropOff === 'string' ? repairOrder.scheduledDropOff.trim() : '';
  // Filter out literal Voiceflow placeholders like "{scheduled_drop_off}" and invalid values like "0"
  const isPlaceholder = rawDropOff.startsWith('{') && rawDropOff.endsWith('}');
  const isInvalidValue = rawDropOff === '0' || rawDropOff === 'null' || rawDropOff === 'undefined';
  const parsedDate = new Date(rawDropOff);
  const isValidDate = rawDropOff && !isPlaceholder && !isInvalidValue && !Number.isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 2000;
  
  // Zoho Scheduled_drop_off is a Date field (not DateTime), so send only YYYY-MM-DD
  // Use UTC methods since Voiceflow sends UTC ISO strings
  let scheduledDropOff = '';
  if (isValidDate) {
    const y = parsedDate.getUTCFullYear();
    const m = String(parsedDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(parsedDate.getUTCDate()).padStart(2, '0');
    scheduledDropOff = `${y}-${m}-${d}`;
  }
  
  console.log('[repair-orders/create] scheduledDropOff processing:', { rawDropOff, isPlaceholder, isInvalidValue, isValidDate, final: scheduledDropOff });

  const errors: Record<string, string> = {};

  if (!phone) errors['customer.phone'] = 'customer.phone is required';
  if (!year) errors['vehicle.year'] = 'vehicle.year is required';
  if (!make) errors['vehicle.make'] = 'vehicle.make is required';
  if (!model) errors['vehicle.model'] = 'vehicle.model is required';

  if (!serviceType && !jobDescription) {
    errors['repairOrder'] = 'repairOrder.serviceType or repairOrder.jobDescription is required';
  }

  if (Object.keys(errors).length) {
    auditLog({ requestId, action: 'repair_orders.create', success: false, status: 400, error: 'validation_error' });
    return jsonError(400, 'Validation failed', { errors });
  }

  try {
    let createdCustomer, createdVehicle, createdRO;
    const nameParts = splitName(name);

    if (USE_SUPABASE_CRM) {
      // Use Supabase CRM
      const existing = await supabaseLookupCustomerByPhone(phone);

      createdCustomer = existing
        ? existing
        : await supabaseCreateCustomer({
            phone,
            ...(nameParts.first_name ? { first_name: nameParts.first_name } : {}),
            ...(nameParts.last_name ? { last_name: nameParts.last_name } : {}),
            ...(email ? { email } : {}),
          });

      createdVehicle = await supabaseCreateVehicle({
        year,
        make,
        model,
        customer_id: createdCustomer.id,
        ...(vin ? { vin } : {}),
        ...(plate ? { license_plate: plate } : {}),
      });

      createdRO = await supabaseCreateRepairOrder({
        vehicle_id: createdVehicle.id,
        customer_id: createdCustomer.id,
        ...(status ? { status: status as any } : {}),
        ...(serviceType ? { service_type: serviceType } : {}),
        ...(jobDescription ? { job_description: jobDescription } : {}),
        ...(notes ? { notes } : {}),
        ...(scheduledDropOff ? { scheduled_drop_off: scheduledDropOff } : {}),
      });
    } else {
      // Use Zoho CRM
      const existing = await zohoLookupCustomerByPhone(phone);

      createdCustomer = existing
        ? existing
        : await zohoCreateCustomer({
            phone,
            ...(nameParts.first_name ? { first_name: nameParts.first_name } : {}),
            ...(nameParts.last_name ? { last_name: nameParts.last_name } : {}),
            ...(email ? { email } : {}),
          });

      createdVehicle = await zohoCreateVehicle({
        year,
        make,
        model,
        ...(vin ? { vin } : {}),
        ...(plate ? { license_plate: plate } : {}),
        customer_id: createdCustomer.id,
      });

      createdRO = await zohoCreateRepairOrder({
        vehicle_id: createdVehicle.id,
        customer_id: createdCustomer.id,
        ...(status ? { status } : {}),
        ...(serviceType ? { service_type: serviceType } : {}),
        ...(jobDescription ? { job_description: jobDescription } : {}),
        ...(notes ? { notes } : {}),
        ...(scheduledDropOff ? { scheduled_drop_off: scheduledDropOff } : {}),
      });
    }

    // Clear server-side cache so new repair order appears in lists immediately
    clearCache();

    auditLog({
      requestId,
      action: 'repair_orders.create',
      success: true,
      status: 201,
      customerId: createdCustomer.id,
      repairOrderId: createdRO.id,
    });

    return NextResponse.json(
      {
        customer: createdCustomer,
        vehicle: createdVehicle,
        repairOrder: createdRO,
        requestId,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[repair-orders/create] CRM error:', err?.message || err, JSON.stringify(err?.response?.data ?? ''));
    auditLog({ requestId, action: 'repair_orders.create', success: false, status: 500, error: USE_SUPABASE_CRM ? 'supabase_error' : 'zoho_error' });
    return jsonError(500, 'Failed to create repair order', { reason: err?.message || 'unknown' });
  }
};
