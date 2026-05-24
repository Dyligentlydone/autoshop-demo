import { NextRequest, NextResponse } from 'next/server';
import { makeZohoServerRequest } from '@/lib/zoho/request-server';
import {
  auditLog,
  getRequestId,
  jsonError,
  normalizePhone,
  requireAgentKey,
  zohoLookupCustomerByPhone,
} from '../../_shared';
import { normalizeCustomer, normalizeRepairOrder, normalizeVehicle, ZohoListResponse } from '../../../crm/_shared';
import { USE_SUPABASE_CRM } from '@/lib/feature-flags';
import { supabase, supabaseLookupCustomerByPhone } from '@/lib/supabase-crm';

const CONTACTS_MODULE = 'Contacts';
const VEHICLES_MODULE = 'Vehicles';
const REPAIR_ORDERS_MODULE = 'Repair_Orders';

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let i = 0;

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }).map(
    async () => {
      while (i < items.length) {
        const idx = i++;
        results[idx] = await fn(items[idx]);
      }
    }
  );

  await Promise.all(workers);
  return results;
};

const SHOP_TIME_ZONE = 'America/Detroit';

const getYmdInTimeZone = (d: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);

  const year = parts.find((p) => p.type === 'year')?.value || '';
  const month = parts.find((p) => p.type === 'month')?.value || '';
  const day = parts.find((p) => p.type === 'day')?.value || '';
  return `${year}-${month}-${day}`;
};

const formatEstimatedCompletionText = (iso: string) => {
  const trimmed = (iso || '').trim();
  if (!trimmed) return '';

  const dt = new Date(trimmed);
  if (Number.isNaN(dt.getTime())) return '';

  const now = new Date();
  const ymd = getYmdInTimeZone(dt, SHOP_TIME_ZONE);
  const today = getYmdInTimeZone(now, SHOP_TIME_ZONE);
  const tomorrow = getYmdInTimeZone(new Date(now.getTime() + 24 * 60 * 60 * 1000), SHOP_TIME_ZONE);

  const timeText = new Intl.DateTimeFormat('en-US', {
    timeZone: SHOP_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(dt);

  if (ymd === today) return `Today at ${timeText}`;
  if (ymd === tomorrow) return `Tomorrow at ${timeText}`;

  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: SHOP_TIME_ZONE, weekday: 'long' }).format(dt);
  return `${weekday} at ${timeText}`;
};

const formatStatusText = (status: string) => {
  const s = (status || '').trim();
  switch (s) {
    case 'New':
      return "We've created your repair order, and the team hasn't started work yet.";
    case 'Scheduled':
      return "You're scheduled—work is planned for your appointment time.";
    case 'Dropped Off':
      return "Your vehicle is checked in and waiting to be worked into the schedule.";
    case 'Diagnosing':
      return "We're inspecting the vehicle to confirm the issue and next steps.";
    case 'Waiting Approval':
      return "We're waiting on an approval before moving forward.";
    case 'In Progress':
      return 'Work is actively underway.';
    case 'Ready For Pickup':
      return 'Work is finished and the vehicle is ready to pick up.';
    case 'Completed':
      return 'The repair order is closed out as completed.';
    default:
      return '';
  }
};

export const POST = async (req: NextRequest) => {
  const requestId = getRequestId(req);
  const auth = requireAgentKey(req);
  if (!auth.ok) {
    auditLog({ requestId, action: 'repair_orders.lookup', success: false, status: 401, error: 'unauthorized' });
    return auth.response;
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    auditLog({ requestId, action: 'repair_orders.lookup', success: false, status: 400, error: 'invalid_json' });
    return jsonError(400, 'Invalid JSON');
  }

  const phone = normalizePhone(body?.phone);
  const customerId = typeof body?.customerId === 'string' ? body.customerId.trim() : '';
  const status = typeof body?.status === 'string' ? body.status.trim() : '';

  console.log('[repair-orders/lookup] Input:', { rawPhone: body?.phone, normalizedPhone: phone, customerId, status });

  if (!phone && !customerId && !status) {
    auditLog({ requestId, action: 'repair_orders.lookup', success: false, status: 400, error: 'missing_criteria' });
    return jsonError(400, 'At least one lookup field is required', {
      requiredOneOf: ['phone', 'customerId', 'status'],
    });
  }

  try {
    let resolvedCustomerId = customerId;
    let resolvedCustomer: any = null;

    if (!resolvedCustomerId && phone) {
      if (USE_SUPABASE_CRM) {
        resolvedCustomer = await supabaseLookupCustomerByPhone(phone);
        console.log('[repair-orders/lookup] Customer lookup result:', { phone, foundCustomer: resolvedCustomer?.id, customerName: resolvedCustomer ? `${resolvedCustomer.first_name} ${resolvedCustomer.last_name}` : null });
      } else {
        resolvedCustomer = await zohoLookupCustomerByPhone(phone);
      }
      resolvedCustomerId = resolvedCustomer?.id || '';
    }

    let orders: any[] = [];
    let vehiclesById: Record<string, any> = {};
    let customersById: Record<string, any> = {};

    if (USE_SUPABASE_CRM) {
      // Use Supabase CRM with joins
      let query = supabase
        .from('repair_orders')
        .select(`
          *,
          vehicle:vehicles(*),
          customer:customers(*)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (status) {
        query = query.eq('status', status);
      }
      if (resolvedCustomerId) {
        query = query.eq('customer_id', resolvedCustomerId);
      }

      const { data, error } = await query;
      if (error) throw error;

      orders = data || [];
      
      // Build lookup maps from joined data
      orders.forEach((ro: any) => {
        if (ro.vehicle) {
          vehiclesById[ro.vehicle.id] = ro.vehicle;
        }
        if (ro.customer) {
          customersById[ro.customer.id] = ro.customer;
        }
      });
    } else {
      // Use Zoho CRM
      const roFields = [
        'id',
        'Name',
        'Status',
        'Note',
        'Job_Description',
        'Estimated_Total',
        'Final_Charge_Total',
        'Estimated_Completion',
        'Vehicle',
        'Customer',
        'Created_Time',
        'Modified_Time',
      ].join(',');

      const baseParams = new URLSearchParams({
        page: '1',
        per_page: '50',
        fields: roFields,
      });

      let endpoint: string;

      if (resolvedCustomerId || status) {
        const criteriaParts: string[] = [];
        if (status) criteriaParts.push(`(Status:equals:${status})`);
        if (resolvedCustomerId) criteriaParts.push(`(Customer:equals:${resolvedCustomerId})`);

        const criteria = criteriaParts.length === 1 ? criteriaParts[0] : `(${criteriaParts.join('and')})`;

        endpoint = `/${REPAIR_ORDERS_MODULE}/search?${new URLSearchParams({
          criteria,
          ...Object.fromEntries(baseParams.entries()),
        }).toString()}`;
      } else {
        endpoint = `/${REPAIR_ORDERS_MODULE}?${baseParams.toString()}`;
      }

      const resp = await makeZohoServerRequest<ZohoListResponse<any>>({
        method: 'GET',
        endpoint,
      });

      orders = (resp.data || []).map(normalizeRepairOrder);
      const vehicleIds = Array.from(new Set(orders.map((o) => o.vehicle_id).filter(Boolean)));
      const customerIdsFromOrders = Array.from(
        new Set(orders.map((o) => o.customer_id).filter(isNonEmptyString))
      );

      if (vehicleIds.length) {
        const vFields = ['id', 'Name', 'Make', 'Model', 'Vin', 'Owner1'].join(',');
        const vs = await mapWithConcurrency(vehicleIds, 6, async (id) => {
          try {
            return await makeZohoServerRequest<any>({
              method: 'GET',
              endpoint: `/${VEHICLES_MODULE}/${id}?fields=${encodeURIComponent(vFields)}`,
            });
          } catch {
            return null;
          }
        });

        vs.forEach((r) => {
          const v = r?.data?.[0];
          if (v?.id) vehiclesById[v.id] = normalizeVehicle(v);
        });

        const customerIds = Array.from(
          new Set(Object.values(vehiclesById).map((v: any) => v.customer_id).filter(Boolean))
        );

        if (customerIds.length) {
          const cFields = ['id', 'First_Name', 'Last_Name', 'Phone', 'Email'].join(',');
          const cs = await mapWithConcurrency(customerIds, 6, async (id) => {
            try {
              return await makeZohoServerRequest<any>({
                method: 'GET',
                endpoint: `/${CONTACTS_MODULE}/${id}?fields=${encodeURIComponent(cFields)}`,
              });
            } catch {
              return null;
            }
          });

          cs.forEach((r) => {
            const c = r?.data?.[0];
            if (c?.id) customersById[c.id] = normalizeCustomer(c);
          });
        }
      }

      if (customerIdsFromOrders.length) {
        const cFields = ['id', 'First_Name', 'Last_Name', 'Phone', 'Email'].join(',');
        const missing = customerIdsFromOrders.filter((id) => !customersById[id]);

        if (missing.length) {
          const cs = await mapWithConcurrency(missing, 6, async (id) => {
            try {
              return await makeZohoServerRequest<any>({
                method: 'GET',
                endpoint: `/${CONTACTS_MODULE}/${id}?fields=${encodeURIComponent(cFields)}`,
              });
            } catch {
              return null;
            }
          });

          cs.forEach((r) => {
            const c = r?.data?.[0];
            if (c?.id) customersById[c.id] = normalizeCustomer(c);
          });
        }
      }
    }

    const items = orders
      .map((o) => {
        const vehicle = USE_SUPABASE_CRM ? o.vehicle : (vehiclesById[o.vehicle_id] || null);
        const linkedCustomerId = vehicle?.customer_id || o.customer_id || '';
        const customer = USE_SUPABASE_CRM ? o.customer : (linkedCustomerId ? customersById[linkedCustomerId] || null : null);

        if (resolvedCustomerId && linkedCustomerId !== resolvedCustomerId) return null;

        const vehicleDisplay = vehicle ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') : '';
        const customerName = customer ? `${customer.first_name} ${customer.last_name}`.trim() : '';

        return {
          id: o.id,
          status: o.status,
          serviceType: o.service_type || '',
          vehicleDisplay,
          customerName,
          customerPhone: customer?.phone || '',
          estimatedCompletion: o.estimated_completion || '',
          estimatedCompletionText: formatEstimatedCompletionText(o.estimated_completion || ''),
          statusText: formatStatusText(o.status),
        };
      })
      .filter(Boolean);

    auditLog({ requestId, action: 'repair_orders.lookup', success: true, status: 200, customerId: resolvedCustomerId || undefined });

    return NextResponse.json({ data: items, count: items.length, requestId });
  } catch (err: any) {
    auditLog({ requestId, action: 'repair_orders.lookup', success: false, status: 500, error: USE_SUPABASE_CRM ? 'supabase_error' : 'zoho_error' });
    return jsonError(500, 'Failed to lookup repair orders');
  }
};
