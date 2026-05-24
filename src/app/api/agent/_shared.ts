import { NextRequest, NextResponse } from 'next/server';
import { makeZohoServerRequest } from '@/lib/zoho/request-server';
import { normalizeCustomer, normalizeRepairOrder, normalizeVehicle, ZohoListResponse } from '../crm/_shared';

export const requireAgentKey = (req: NextRequest) => {
  const expected = process.env.VOICEFLOW_AGENT_KEY;
  const got = req.headers.get('x-agent-key');

  if (!expected) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Server misconfigured' }, { status: 500 }),
    };
  }

  if (!got || got !== expected) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { ok: true as const };
};

export const jsonError = (status: number, error: string, details?: unknown) => {
  return NextResponse.json(details ? { error, details } : { error }, { status });
};

export const normalizePhone = (raw: unknown) => {
  const s = typeof raw === 'string' ? raw : typeof raw === 'number' ? String(raw) : '';
  const digits = s.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
};

export const splitName = (raw: unknown): { first_name?: string; last_name?: string } => {
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (!name) return {};
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { first_name: parts[0] };
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
};

export const getRequestId = (req: NextRequest) => {
  const existing = req.headers.get('x-request-id');
  if (existing) return existing;
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return String(Date.now());
};

export const auditLog = (entry: {
  requestId: string;
  action: string;
  success: boolean;
  customerId?: string;
  repairOrderId?: string;
  status?: number;
  error?: string;
}) => {
  const payload = {
    ts: new Date().toISOString(),
    ...entry,
  };

  console.log(JSON.stringify(payload));
};

const CONTACTS_MODULE = 'Contacts';
const VEHICLES_MODULE = 'Vehicles';
const REPAIR_ORDERS_MODULE = 'Repair_Orders';

export const zohoLookupCustomerByPhone = async (phoneDigits: string) => {
  const fields = ['id', 'First_Name', 'Last_Name', 'Phone', 'Email'].join(',');

  const resp = await makeZohoServerRequest<ZohoListResponse<any>>({
    method: 'GET',
    endpoint: `/${CONTACTS_MODULE}/search?criteria=(Phone:equals:${encodeURIComponent(
      phoneDigits
    )})&fields=${encodeURIComponent(fields)}`,
  });

  return resp.data?.[0] ? normalizeCustomer(resp.data[0]) : null;
};

export const zohoLookupCustomerByEmail = async (email: string) => {
  const fields = ['id', 'First_Name', 'Last_Name', 'Phone', 'Email'].join(',');

  const resp = await makeZohoServerRequest<ZohoListResponse<any>>({
    method: 'GET',
    endpoint: `/${CONTACTS_MODULE}/search?criteria=(Email:equals:${encodeURIComponent(
      email
    )})&fields=${encodeURIComponent(fields)}`,
  });

  return resp.data?.[0] ? normalizeCustomer(resp.data[0]) : null;
};

export const zohoLookupCustomerByName = async (name: string) => {
  const fields = ['id', 'First_Name', 'Last_Name', 'Phone', 'Email'].join(',');

  const resp = await makeZohoServerRequest<ZohoListResponse<any>>({
    method: 'GET',
    endpoint: `/${CONTACTS_MODULE}/search?criteria=(Last_Name:contains:${encodeURIComponent(
      name
    )})&fields=${encodeURIComponent(fields)}`,
  });

  return resp.data?.[0] ? normalizeCustomer(resp.data[0]) : null;
};

export const zohoCreateCustomer = async (input: {
  phone: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}) => {
  const safeLastName = (input.last_name || '').trim() || (input.first_name || '').trim() || 'Unknown';

  const payload = {
    data: [
      {
        Phone: input.phone,
        ...(input.first_name ? { First_Name: input.first_name } : {}),
        Last_Name: safeLastName,
        ...(input.email ? { Email: input.email } : {}),
      },
    ],
  };

  const created = await makeZohoServerRequest<any>({
    method: 'POST',
    endpoint: `/${CONTACTS_MODULE}`,
    data: payload,
  });

  const id = created?.data?.[0]?.details?.id;
  if (!id) throw new Error('Failed to create customer');

  const fields = ['id', 'First_Name', 'Last_Name', 'Phone', 'Email'].join(',');
  const got = await makeZohoServerRequest<any>({
    method: 'GET',
    endpoint: `/${CONTACTS_MODULE}/${id}?fields=${encodeURIComponent(fields)}`,
  });

  return normalizeCustomer(got.data?.[0]);
};

export const zohoCreateVehicle = async (input: {
  year: string;
  make: string;
  model: string;
  vin?: string;
  license_plate?: string;
  customer_id: string;
}) => {
  const payload = {
    data: [
      {
        Name: input.year,
        Make: input.make,
        Model: input.model,
        ...(input.vin ? { Vin: input.vin } : {}),
        ...(input.license_plate ? { License_Plate: input.license_plate } : {}),
        Owner1: input.customer_id,
      },
    ],
  };

  const created = await makeZohoServerRequest<any>({
    method: 'POST',
    endpoint: `/${VEHICLES_MODULE}`,
    data: payload,
  });

  const id = created?.data?.[0]?.details?.id;
  if (!id) throw new Error('Failed to create vehicle');

  const fields = ['id', 'Name', 'Make', 'Model', 'Vin', 'License_Plate', 'Owner1'].join(',');
  const got = await makeZohoServerRequest<any>({
    method: 'GET',
    endpoint: `/${VEHICLES_MODULE}/${id}?fields=${encodeURIComponent(fields)}`,
  });

  return normalizeVehicle(got.data?.[0]);
};

export const zohoCreateRepairOrder = async (input: {
  vehicle_id: string;
  customer_id?: string;
  status?: string;
  service_type?: string;
  job_description?: string;
  notes?: string;
  scheduled_drop_off?: string;
}) => {
  const payload = {
    data: [
      {
        Name: input.service_type || `RO-${Date.now()}`,
        Status: input.status || 'New',
        ...(input.notes !== undefined ? { Note: input.notes, Job_Description: input.notes } : {}),
        ...(input.job_description !== undefined ? { Job_Description: input.job_description } : {}),
        Vehicle: input.vehicle_id,
        ...(input.customer_id ? { Customer: input.customer_id } : {}),
        ...(input.scheduled_drop_off ? { Scheduled_drop_off: input.scheduled_drop_off } : {}),
      },
    ],
  };

  const created = await makeZohoServerRequest<any>({
    method: 'POST',
    endpoint: `/${REPAIR_ORDERS_MODULE}`,
    data: payload,
  });

  const id = created?.data?.[0]?.details?.id;
  if (!id) throw new Error('Failed to create repair order');

  const fields = [
    'id',
    'Name',
    'Status',
    'Note',
    'Job_Description',
    'Estimated_Total',
    'Final_Charge_Total',
    'Scheduled_drop_off',
    'Vehicle',
    'Customer',
    'Created_Time',
    'Modified_Time',
  ].join(',');

  const got = await makeZohoServerRequest<any>({
    method: 'GET',
    endpoint: `/${REPAIR_ORDERS_MODULE}/${id}?fields=${encodeURIComponent(fields)}`,
  });

  return normalizeRepairOrder(got.data?.[0]);
};

export const zohoUpdateRepairOrder = async (input: {
  id: string;
  status?: string;
  service_type?: string;
  job_description?: string;
  notes?: string;
  note?: string;
}) => {
  const payload = {
    data: [
      {
        id: input.id,
        ...(input.status ? { Status: input.status } : {}),
        ...(input.service_type ? { Name: input.service_type } : {}),
        ...(input.job_description !== undefined ? { Job_Description: input.job_description } : {}),
        ...(input.note !== undefined ? { Note: input.note } : {}),
        ...(input.notes !== undefined ? { Note: input.notes, Job_Description: input.notes } : {}),
      },
    ],
  };

  await makeZohoServerRequest<any>({
    method: 'PUT',
    endpoint: `/${REPAIR_ORDERS_MODULE}`,
    data: payload,
  });

  const fields = [
    'id',
    'Name',
    'Status',
    'Note',
    'Job_Description',
    'Estimated_Total',
    'Final_Charge_Total',
    'Vehicle',
    'Customer',
    'Created_Time',
    'Modified_Time',
  ].join(',');

  const got = await makeZohoServerRequest<any>({
    method: 'GET',
    endpoint: `/${REPAIR_ORDERS_MODULE}/${input.id}?fields=${encodeURIComponent(fields)}`,
  });

  return normalizeRepairOrder(got.data?.[0]);
};

export const zohoGetRepairOrderRaw = async (id: string) => {
  const fields = ['id', 'Note', 'Job_Description'].join(',');

  const got = await makeZohoServerRequest<any>({
    method: 'GET',
    endpoint: `/${REPAIR_ORDERS_MODULE}/${id}?fields=${encodeURIComponent(fields)}`,
  });

  return got?.data?.[0] || null;
};
