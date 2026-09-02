import { NextResponse } from 'next/server';
import { makeZohoServerRequest } from '@/lib/zoho/request-server';
import {
  normalizeCustomer,
  normalizeRepairOrder,
  normalizeVehicle,
  ZohoListResponse,
} from '../../_shared';
import { USE_SUPABASE_CRM } from '@/lib/feature-flags';
import { supabase } from '@/lib/supabase-crm';

const CONTACTS_MODULE = 'Contacts';
const VEHICLES_MODULE = 'Vehicles';
const REPAIR_ORDERS_MODULE = 'Repair_Orders';

// Simple dashboard cache - 10 seconds TTL (Supabase is fast, can refresh more often)
let dashboardCachePayload: any = null;
let dashboardCacheAt = 0;
const DASHBOARD_CACHE_TTL_MS = 10_000;

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

export const GET = async (req: Request) => {
  // Check for cache busting parameter (used by webhook to force refresh)
  const url = new URL(req.url);
  const bustCache = url.searchParams.get('bustCache');
  
  // Check dashboard cache (skip if cache busting)
  if (!bustCache && dashboardCachePayload && Date.now() - dashboardCacheAt < DASHBOARD_CACHE_TTL_MS) {
    return NextResponse.json(dashboardCachePayload);
  }

  const dealFields = [
    'id',
    'Name',
    'Status',
    'Note',
    'Job_Description',
    'Vehicle',
    'Customer',
    'Created_Time',
    'Modified_Time',
  ].join(',');

  try {
    if (USE_SUPABASE_CRM) {
      // Use Supabase with joins - much simpler and faster!
      const activeStatuses = [
        'In Progress',
        'Diagnosing',
        'Dropped Off',
        'Waiting Approval',
        'Repair Approved',
        'Awaiting Parts',
      ];
      
      const { data, error } = await supabase
        .from('repair_orders')
        .select(`
          *,
          vehicles!repair_orders_vehicle_id_fkey(*),
          customers!repair_orders_customer_id_fkey(*)
        `)
        .in('status', activeStatuses)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const enriched = (data || []).map((ro: any) => ({
        repairOrder: {
          id: ro.id,
          vehicle_id: ro.vehicle_id,
          customer_id: ro.customer_id,
          status: ro.status,
          service_type: ro.service_type,
          job_description: ro.job_description,
          notes: ro.note,
          estimated_total: ro.estimated_total,
          final_charge_total: ro.final_charge_total,
          estimated_completion: ro.estimated_completion,
          scheduled_drop_off: ro.scheduled_drop_off,
          created_time: ro.created_at,
          updated_time: ro.updated_at,
        },
        vehicle: ro.vehicles,
        customer: ro.customers,
      }));

      const payload = { data: enriched };
      dashboardCachePayload = payload;
      dashboardCacheAt = Date.now();

      return NextResponse.json(payload);
    } else {
      // Fetch ALL repair orders by getting multiple pages to ensure we don't miss any active ones
      let allRepairOrders: any[] = [];
      let currentPage = 1;
      let hasMoreRecords = true;
      const perPage = 200; // Fetch 200 per page to minimize API calls

      while (hasMoreRecords && currentPage <= 5) { // Safety limit: max 5 pages (1000 records)
        const resp = await makeZohoServerRequest<ZohoListResponse<any>>({
          method: 'GET',
          endpoint: `/${REPAIR_ORDERS_MODULE}?page=${currentPage}&per_page=${perPage}&fields=${encodeURIComponent(dealFields)}`,
        });

        if (resp.data && resp.data.length > 0) {
          allRepairOrders = allRepairOrders.concat(resp.data);
          hasMoreRecords = resp.info?.more_records ?? false;
          currentPage++;
        } else {
          hasMoreRecords = false;
        }
      }

      const active = allRepairOrders.filter((d: any) => {
        const s = (d?.Status || '').toLowerCase();
        return (
          s === 'in progress' ||
          s === 'diagnosing' ||
          s === 'dropped off' ||
          s === 'waiting approval' ||
          s === 'repair approved' ||
          s === 'awaiting parts'
        );
      });

      const orders = active.map(normalizeRepairOrder);
      const vehicleIds = Array.from(new Set(orders.map((o) => o.vehicle_id).filter(Boolean)));

      const vehiclesById: Record<string, any> = {};
      const customersById: Record<string, any> = {};

      if (vehicleIds.length) {
        const vFields =
          ['id', 'Name', 'Make', 'Model', 'Vin', 'License_Plate', 'Engine_Size', 'Owner1'].join(',');
        const vs = await mapWithConcurrency(vehicleIds, 6, async (id) => {
          try {
            return await makeZohoServerRequest<any>({
              method: 'GET',
              endpoint: `/${VEHICLES_MODULE}/${id}?fields=${encodeURIComponent(vFields)}`,
            });
          } catch { return null; }
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
            } catch { return null; }
          });

          cs.forEach((r) => {
            const c = r?.data?.[0];
            if (c?.id) customersById[c.id] = normalizeCustomer(c);
          });
        }
      }

      const enriched = orders.map((o) => {
        const vehicle = vehiclesById[o.vehicle_id] || null;
        const customer = vehicle?.customer_id ? customersById[vehicle.customer_id] || null : null;
        return { repairOrder: o, vehicle, customer };
      });

      const payload = { data: enriched };
      dashboardCachePayload = payload;
      dashboardCacheAt = Date.now();

      return NextResponse.json(payload);
    }
  } catch {
    return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 });
  }
};
