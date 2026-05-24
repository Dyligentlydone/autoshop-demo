import { NextRequest, NextResponse } from 'next/server';
import { makeZohoServerRequest } from '@/lib/zoho/request-server';
import { normalizeRepairOrder, ZohoListResponse } from '../../../_shared';
import { USE_SUPABASE_CRM } from '@/lib/feature-flags';
import { supabaseGetRepairOrdersByVehicle } from '@/lib/supabase-crm';

const REPAIR_ORDERS_MODULE = 'Repair_Orders';

const FIELDS = [
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

export const GET = async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;

  const params = new URLSearchParams({
    criteria: `(Vehicle:equals:${id})`,
    page: '1',
    per_page: '50',
    fields: FIELDS,
  });

  try {
    if (USE_SUPABASE_CRM) {
      const repairOrders = await supabaseGetRepairOrdersByVehicle(id);
      return NextResponse.json({
        data: repairOrders,
        info: { count: repairOrders.length },
      });
    } else {
      const resp = await makeZohoServerRequest<ZohoListResponse<any>>({
        method: 'GET',
        endpoint: `/${REPAIR_ORDERS_MODULE}/search?${params.toString()}`,
      });

      return NextResponse.json({
        data: (resp.data || []).map(normalizeRepairOrder),
        info: resp.info,
      });
    }
  } catch (err: any) {
    const s = err?.response?.status || 500;
    return NextResponse.json({ error: 'Failed to fetch repair orders for vehicle' }, { status: s });
  }
};
