import { NextRequest, NextResponse } from 'next/server';
import { makeZohoServerRequest } from '@/lib/zoho/request-server';
import { normalizeRepairOrder } from '../../_shared';
import { clearCache } from '../cache';
import { USE_SUPABASE_CRM } from '@/lib/feature-flags';
import { supabase, supabaseGetRepairOrder, supabaseUpdateRepairOrder, syncRepairOrderToAppointments } from '@/lib/supabase-crm';

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
  'Scheduled_drop_off',
  'Vehicle',
  'Customer',
  'Created_Time',
  'Modified_Time',
].join(',');

export const GET = async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;

  try {
    if (USE_SUPABASE_CRM) {
      const repairOrder = await supabaseGetRepairOrder(id);
      if (!repairOrder) {
        return NextResponse.json({ error: 'Repair order not found' }, { status: 404 });
      }
      return NextResponse.json({ data: repairOrder });
    } else {
      const got = await makeZohoServerRequest<any>({
        method: 'GET',
        endpoint: `/${REPAIR_ORDERS_MODULE}/${id}?fields=${encodeURIComponent(FIELDS)}`,
      });

      return NextResponse.json({ data: normalizeRepairOrder(got.data?.[0]) });
    }
  } catch (err: any) {
    const s = err?.response?.status || 500;
    return NextResponse.json({ error: 'Failed to fetch repair order' }, { status: s });
  }
};

export const PATCH = async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const body = await req.json();

  try {
    if (USE_SUPABASE_CRM) {
      const updates: any = {};
      if (body?.status) updates.status = body.status;
      if (body?.service_type) updates.service_type = body.service_type;
      if (body?.note !== undefined) updates.notes = body.note;
      if (body?.job_description !== undefined) updates.job_description = body.job_description;
      if (body?.notes !== undefined) {
        updates.notes = body.notes;
        updates.job_description = body.notes;
      }
      if (typeof body?.estimated_total === 'number') updates.estimated_total = body.estimated_total;
      if (typeof body?.final_charge_total === 'number') updates.final_charge_total = body.final_charge_total;
      if (typeof body?.estimated_completion === 'string' && body.estimated_completion.trim()) {
        updates.estimated_completion = body.estimated_completion.trim();
      }
      if (typeof body?.scheduled_drop_off === 'string' && body.scheduled_drop_off.trim()) {
        updates.scheduled_drop_off = body.scheduled_drop_off.trim();
      }

      const repairOrder = await supabaseUpdateRepairOrder({ id, ...updates });
      
      // Sync dates to appointments table for calendar
      await syncRepairOrderToAppointments(id);
      
      clearCache();
      return NextResponse.json({ data: repairOrder });
    } else {
      const payload = {
        data: [
          {
            id,
            ...(body?.status ? { Status: body.status } : {}),
            ...(body?.service_type ? { Name: body.service_type } : {}),
            ...(body?.note !== undefined ? { Note: body.note } : {}),
            ...(body?.job_description !== undefined ? { Job_Description: body.job_description } : {}),
            ...(body?.notes !== undefined ? { Note: body.notes, Job_Description: body.notes } : {}),
            ...(typeof body?.estimated_total === 'number' ? { Estimated_Total: body.estimated_total } : {}),
            ...(typeof body?.final_charge_total === 'number' ? { Final_Charge_Total: body.final_charge_total } : {}),
            ...(typeof body?.estimated_completion === 'string' && body.estimated_completion.trim()
              ? { Estimated_Completion: body.estimated_completion.trim() }
              : {}),
            ...(typeof body?.scheduled_drop_off === 'string' && body.scheduled_drop_off.trim()
              ? { Scheduled_drop_off: body.scheduled_drop_off.trim().substring(0, 10) }
              : {}),
          },
        ],
      };

      const updated = await makeZohoServerRequest<any>({
        method: 'PUT',
        endpoint: `/${REPAIR_ORDERS_MODULE}`,
        data: payload,
      });

      const result = updated?.data?.[0];
      if (result?.status && result.status !== 'success') {
        return NextResponse.json(
          {
            error: 'Failed to update repair order',
            zoho: {
              code: result?.code,
              message: result?.message,
              details: result?.details,
            },
          },
          { status: 400 }
        );
      }

      const got = await makeZohoServerRequest<any>({
        method: 'GET',
        endpoint: `/${REPAIR_ORDERS_MODULE}/${id}?fields=${encodeURIComponent(FIELDS)}`,
      });

      clearCache();
      return NextResponse.json({ data: normalizeRepairOrder(got.data?.[0]) });
    }
  } catch (err: any) {
    const s = err?.response?.status || 500;
    return NextResponse.json({ error: 'Failed to update repair order' }, { status: s });
  }
};

export const DELETE = async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;

  try {
    if (USE_SUPABASE_CRM) {
      // Delete appointments first (not cascade due to schema)
      await supabase
        .from('appointments')
        .delete()
        .eq('repair_order_id', id);

      // Delete from Supabase (cascades to attachments)
      const { error } = await supabase
        .from('repair_orders')
        .delete()
        .eq('id', id);

      if (error) throw error;

      clearCache();
      return NextResponse.json({ success: true });
    } else {
      // Delete from Zoho
      await makeZohoServerRequest<any>({
        method: 'DELETE',
        endpoint: `/${REPAIR_ORDERS_MODULE}/${id}`,
      });

      clearCache();
      return NextResponse.json({ success: true });
    }
  } catch (err: any) {
    const s = err?.response?.status || 500;
    return NextResponse.json({ error: 'Failed to delete repair order' }, { status: s });
  }
};
