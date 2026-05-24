import { NextRequest, NextResponse } from 'next/server';
import { makeZohoServerRequest } from '@/lib/zoho/request-server';
import { normalizeVehicle } from '../../_shared';
import { USE_SUPABASE_CRM } from '@/lib/feature-flags';
import { supabase, supabaseGetVehicle, supabaseUpdateVehicle } from '@/lib/supabase-crm';

const VEHICLES_MODULE = 'Vehicles';

const FIELDS = ['id', 'Name', 'Make', 'Model', 'Vin', 'License_Plate', 'Engine_Size', 'Owner1'].join(',');

export const GET = async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const full = _req.nextUrl.searchParams.get('full') === '1';

  try {
    if (USE_SUPABASE_CRM) {
      const vehicle = await supabaseGetVehicle(id);
      if (!vehicle) {
        return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
      }
      return NextResponse.json({ data: vehicle, raw: vehicle });
    } else {
      const got = await makeZohoServerRequest<any>({
        method: 'GET',
        endpoint: full ? `/${VEHICLES_MODULE}/${id}` : `/${VEHICLES_MODULE}/${id}?fields=${encodeURIComponent(FIELDS)}`,
      });

      const raw = got.data?.[0];
      return NextResponse.json({ data: normalizeVehicle(raw), raw });
    }
  } catch (err: any) {
    const s = err?.response?.status || 500;
    return NextResponse.json({ error: 'Failed to fetch vehicle' }, { status: s });
  }
};

export const PATCH = async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const body = await req.json();

  try {
    if (USE_SUPABASE_CRM) {
      const updates: any = {};
      if (body?.year !== undefined) updates.year = body.year || '';
      if (body?.make !== undefined) updates.make = body.make || '';
      if (body?.model !== undefined) updates.model = body.model || '';
      if (body?.vin !== undefined) updates.vin = body.vin || '';
      if (body?.license_plate !== undefined) updates.license_plate = body.license_plate || '';
      if (body?.engine_size !== undefined) updates.engine_size = body.engine_size || '';
      if (body?.customer_id !== undefined) updates.customer_id = body.customer_id;

      const vehicle = await supabaseUpdateVehicle(id, updates);
      return NextResponse.json({ data: vehicle, raw: vehicle });
    } else {
      const payload = {
        data: [
          {
            id,
            ...(body?.year !== undefined ? { Name: body.year || '' } : {}),
            ...(body?.make !== undefined ? { Make: body.make || '' } : {}),
            ...(body?.model !== undefined ? { Model: body.model || '' } : {}),
            ...(body?.vin !== undefined ? { Vin: body.vin || '' } : {}),
            ...(body?.license_plate !== undefined ? { License_Plate: body.license_plate || '' } : {}),
            ...(body?.engine_size !== undefined ? { Engine_Size: body.engine_size || '' } : {}),
            ...(body?.customer_id ? { Owner1: body.customer_id } : {}),
            ...(body?.rawUpdates && typeof body.rawUpdates === 'object' ? body.rawUpdates : {}),
          },
        ],
      };

      await makeZohoServerRequest<any>({
        method: 'PUT',
        endpoint: `/${VEHICLES_MODULE}`,
        data: payload,
      });

      const got = await makeZohoServerRequest<any>({
        method: 'GET',
        endpoint: `/${VEHICLES_MODULE}/${id}?fields=${encodeURIComponent(FIELDS)}`,
      });

      const raw = got.data?.[0];
      return NextResponse.json({ data: normalizeVehicle(raw), raw });
    }
  } catch (err: any) {
    const s = err?.response?.status || 500;
    return NextResponse.json({ error: 'Failed to update vehicle' }, { status: s });
  }
};

export const DELETE = async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;

  try {
    if (USE_SUPABASE_CRM) {
      // Nullify vehicle_id on repair orders first (avoid FK constraint)
      await supabase
        .from('repair_orders')
        .update({ vehicle_id: null })
        .eq('vehicle_id', id);

      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    } else {
      await makeZohoServerRequest<any>({
        method: 'DELETE',
        endpoint: `/${VEHICLES_MODULE}/${id}`,
      });
      return NextResponse.json({ success: true });
    }
  } catch (err: any) {
    const s = err?.response?.status || 500;
    return NextResponse.json({ error: 'Failed to delete vehicle' }, { status: s });
  }
};
