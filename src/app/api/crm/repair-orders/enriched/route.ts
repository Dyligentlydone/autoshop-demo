import { NextRequest, NextResponse } from 'next/server';
import { makeZohoServerRequest } from '@/lib/zoho/request-server';
import {
  normalizeCustomer,
  normalizeRepairOrder,
  normalizeVehicle,
  ZohoListResponse,
} from '../../_shared';
import { getCache, setCache } from '../cache';
import { USE_SUPABASE_CRM } from '@/lib/feature-flags';
import { supabase } from '@/lib/supabase-crm';

const CONTACTS_MODULE = 'Contacts';
const VEHICLES_MODULE = 'Vehicles';
const REPAIR_ORDERS_MODULE = 'Repair_Orders';

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

export const GET = async (req: NextRequest) => {
  const status = req.nextUrl.searchParams.get('status');
  const page = req.nextUrl.searchParams.get('page') || '1';
  const perPage = req.nextUrl.searchParams.get('perPage') || '20';

  const cacheKey = `${status || ''}|${page}|${perPage}`;
  
  // Check cache
  const cached = getCache(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  const roFields = [
    'id',
    'Name',
    'Status',
    'Note',
    'Job_Description',
    'Estimated_Total',
    'Final_Charge_Total',
    'Estimated_Completion',
    'Scheduled_drop_off',
    'Vehicle',
    'Customer',
    'Created_Time',
    'Modified_Time',
  ].join(',');

  try {
    if (USE_SUPABASE_CRM) {
      const pageNum = parseInt(page);
      const perPageNum = parseInt(perPage);
      const offset = (pageNum - 1) * perPageNum;

      const SELECT = `*, vehicle:vehicles(*), customer:customers(*)`;

      let rows: any[] = [];
      let totalCount = 0;

      if (status) {
        // Filtered view — simple single query
        const { data, error, count } = await supabase
          .from('repair_orders')
          .select(SELECT, { count: 'exact' })
          .eq('status', status)
          .order('updated_at', { ascending: false })
          .range(offset, offset + perPageNum - 1);
        if (error) throw error;
        rows = data || [];
        totalCount = count ?? rows.length;
      } else {
        // Unfiltered view — status-priority pagination.
        // Non-Completed orders always precede Completed ones so that page
        // boundaries never split active work across pages.

        // Count non-Completed so we know where the Completed block starts.
        const { count: activeCount, error: countErr } = await supabase
          .from('repair_orders')
          .select('id', { count: 'exact', head: true })
          .neq('status', 'Completed');
        if (countErr) throw countErr;

        const { count: completedCount, error: compCountErr } = await supabase
          .from('repair_orders')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'Completed');
        if (compCountErr) throw compCountErr;

        const numActive = activeCount ?? 0;
        const numCompleted = completedCount ?? 0;
        totalCount = numActive + numCompleted;

        if (offset < numActive) {
          // This page starts within the active block
          const activeLimit = Math.min(perPageNum, numActive - offset);
          const { data: aData, error: aErr } = await supabase
            .from('repair_orders')
            .select(SELECT)
            .neq('status', 'Completed')
            .order('updated_at', { ascending: false })
            .range(offset, offset + activeLimit - 1);
          if (aErr) throw aErr;
          rows = aData || [];

          // Backfill with Completed if active didn't fill the page
          const remaining = perPageNum - rows.length;
          if (remaining > 0 && numCompleted > 0) {
            const { data: cData, error: cErr } = await supabase
              .from('repair_orders')
              .select(SELECT)
              .eq('status', 'Completed')
              .order('updated_at', { ascending: false })
              .range(0, remaining - 1);
            if (cErr) throw cErr;
            rows = [...rows, ...(cData || [])];
          }
        } else {
          // This page is entirely within the Completed block
          const completedOffset = offset - numActive;
          const { data: cData, error: cErr } = await supabase
            .from('repair_orders')
            .select(SELECT)
            .eq('status', 'Completed')
            .order('updated_at', { ascending: false })
            .range(completedOffset, completedOffset + perPageNum - 1);
          if (cErr) throw cErr;
          rows = cData || [];
        }
      }

      const enriched = rows.map((ro: any) => ({
        repairOrder: {
          id: ro.id,
          vehicle_id: ro.vehicle_id,
          customer_id: ro.customer_id,
          status: ro.status,
          service_type: ro.service_type,
          job_description: ro.job_description,
          note: ro.note,
          notes: ro.note,
          estimated_total: ro.estimated_total,
          final_charge_total: ro.final_charge_total,
          estimated_completion: ro.estimated_completion,
          scheduled_drop_off: ro.scheduled_drop_off,
          created_time: ro.created_at,
          updated_time: ro.updated_at,
        },
        vehicle: ro.vehicle,
        customer: ro.customer,
      }));

      const payload = {
        data: enriched,
        info: {
          count: totalCount,
          more_records: offset + rows.length < totalCount,
        },
      };

      setCache(cacheKey, payload);
      return NextResponse.json(payload);
    } else {
      // Use Zoho with manual joins
      const baseParams = new URLSearchParams({
        page,
        per_page: perPage,
        fields: roFields,
        sort_order: 'desc',
        sort_by: 'Modified_Time',
      });

      const resp = await makeZohoServerRequest<ZohoListResponse<any>>({
        method: 'GET',
        endpoint: `/${REPAIR_ORDERS_MODULE}?${baseParams.toString()}`,
      });

      const targetStatus = typeof status === 'string' ? status.trim() : '';
      const orders = (resp.data || [])
        .map(normalizeRepairOrder)
        .filter((o) => (!targetStatus ? true : o.status === targetStatus));
      const vehicleIds = Array.from(new Set(orders.map((o) => o.vehicle_id).filter(Boolean)));

      const vehiclesById: Record<string, any> = {};
      const customersById: Record<string, any> = {};

      if (vehicleIds.length) {
        const vFields = ['id', 'Name', 'Make', 'Model', 'Vin', 'Owner1'].join(',');
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

      const payload = { 
        data: enriched, 
        info: resp.info
      };
      
      setCache(cacheKey, payload);
      return NextResponse.json(payload);
    }
  } catch (err: any) {
    const statusCode = err?.response?.status;
    const data = err?.response?.data;
    console.error('repair-orders/enriched error', {
      status: statusCode,
      data,
      message: err?.message,
    });

    return NextResponse.json(
      {
        error: 'Failed to fetch repair orders',
        status: statusCode || 500,
        details: data || err?.message || null,
      },
      { status: statusCode || 500 }
    );
  }
};
