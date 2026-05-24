import { NextRequest, NextResponse } from 'next/server';
import { makeZohoServerRequest } from '@/lib/zoho/request-server';
import { normalizeRepairOrder, ZohoListResponse } from '../_shared';
import { clearCache } from './cache';
import { USE_SUPABASE_CRM } from '@/lib/feature-flags';
import { supabase, supabaseCreateRepairOrder, supabaseGetRepairOrdersByStatus, syncRepairOrderToAppointments } from '@/lib/supabase-crm';

const REPAIR_ORDERS_MODULE = 'Repair_Orders';

 const toZohoCriteriaStringValue = (value: string) => {
   const v = value.trim();
   const escaped = v.replace(/"/g, '\\"');
   return `"${escaped}"`;
 };

export const GET = async (req: NextRequest) => {
  const status = req.nextUrl.searchParams.get('status');
  const page = req.nextUrl.searchParams.get('page') || '1';
  const perPage = req.nextUrl.searchParams.get('perPage') || '20';

  const fields = [
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

  const params = new URLSearchParams({
    page,
    per_page: perPage,
    fields,
  });

  const endpoint = status
    ? `/${REPAIR_ORDERS_MODULE}/search?${new URLSearchParams({
        criteria: `(Status:equals:${toZohoCriteriaStringValue(status)})`,
        ...Object.fromEntries(params.entries()),
      }).toString()}`
    : `/${REPAIR_ORDERS_MODULE}?${params.toString()}`;

  try {
    if (USE_SUPABASE_CRM) {
      let query = supabase
        .from('repair_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .range((parseInt(page) - 1) * parseInt(perPage), parseInt(page) * parseInt(perPage) - 1);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return NextResponse.json({
        data: data || [],
        info: { count: count || data?.length || 0 },
      });
    } else {
      const resp = await makeZohoServerRequest<ZohoListResponse<any>>({
        method: 'GET',
        endpoint,
      });

      return NextResponse.json({
        data: (resp.data || []).map(normalizeRepairOrder),
        info: resp.info,
      });
    }
  } catch (err: any) {
    const s = err?.response?.status || 500;
    return NextResponse.json({ error: 'Failed to fetch repair orders' }, { status: s });
  }
};

export const POST = async (req: NextRequest) => {
  const body = await req.json();
  const vehicleId = body?.vehicle_id;
  const status = body?.status;
  const serviceType = body?.service_type;
  const jobDescription = body?.job_description;
  const note = body?.note;
  const notes = body?.notes;
  const customerId = body?.customer_id;
  const estimatedTotal = body?.estimated_total;
  const finalChargeTotal = body?.final_charge_total;
  const estimatedCompletion = typeof body?.estimated_completion === 'string' ? body.estimated_completion.trim() : '';

  if (!vehicleId) {
    return NextResponse.json({ error: 'vehicle_id is required' }, { status: 400 });
  }

  const payload = {
    data: [
      {
        Name: serviceType || `RO-${Date.now()}`,
        Status: status || 'New',
        Note: note || notes || '',
        Job_Description: jobDescription || notes || '',
        ...(typeof estimatedTotal === 'number' ? { Estimated_Total: estimatedTotal } : {}),
        ...(typeof finalChargeTotal === 'number' ? { Final_Charge_Total: finalChargeTotal } : {}),
        ...(estimatedCompletion ? { Estimated_Completion: estimatedCompletion } : {}),
        Vehicle: vehicleId,
        ...(customerId ? { Customer: customerId } : {}),
      },
    ],
  };

  try {
    if (USE_SUPABASE_CRM) {
      const repairOrder = await supabaseCreateRepairOrder({
        vehicle_id: vehicleId,
        customer_id: customerId || '',
        status: status as any,
        service_type: serviceType,
        job_description: jobDescription || notes,
        notes: note || notes,
        estimated_total: typeof estimatedTotal === 'number' ? estimatedTotal : undefined,
        final_charge_total: typeof finalChargeTotal === 'number' ? finalChargeTotal : undefined,
        estimated_completion: estimatedCompletion || undefined,
        scheduled_drop_off: body?.scheduled_drop_off || undefined,
      });

      // Sync dates to appointments table for calendar
      await syncRepairOrderToAppointments(repairOrder.id);

      clearCache();
      return NextResponse.json({ data: repairOrder }, { status: 201 });
    } else {
      const created = await makeZohoServerRequest<any>({
        method: 'POST',
        endpoint: `/${REPAIR_ORDERS_MODULE}`,
        data: payload,
      });

      const id = created?.data?.[0]?.details?.id;
      if (!id) {
        return NextResponse.json({ error: 'Failed to create repair order' }, { status: 500 });
      }

      const fields = [
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

      const got = await makeZohoServerRequest<any>({
        method: 'GET',
        endpoint: `/${REPAIR_ORDERS_MODULE}/${id}?fields=${encodeURIComponent(fields)}`,
      });

      clearCache();
      return NextResponse.json({ data: normalizeRepairOrder(got.data?.[0]) }, { status: 201 });
    }
  } catch (err: any) {
    const s = err?.response?.status || 500;
    return NextResponse.json({ error: 'Failed to create repair order' }, { status: s });
  }
};
