import { NextRequest, NextResponse } from 'next/server';
import { makeZohoServerRequest } from '@/lib/zoho/request-server';
import { normalizeRepairOrder, normalizeVehicle, ZohoListResponse } from '../../../_shared';
import { USE_SUPABASE_CRM } from '@/lib/feature-flags';
import { supabase, supabaseGetRepairOrder, supabaseUpdateRepairOrder, supabaseUpdateVehicle } from '@/lib/supabase-crm';

const REPAIR_ORDERS_MODULE = 'Repair_Orders';
const VEHICLES_MODULE = 'Vehicles';

const RO_FIELDS = [
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

const VEHICLE_FIELDS = ['id', 'Name', 'Make', 'Model', 'Vin', 'License_Plate', 'Owner1'].join(',');

export const POST = async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const body = await req.json();

  const vinRaw = body?.vin;
  const vin = typeof vinRaw === 'string' ? vinRaw.trim() : '';

  if (!vin) {
    return NextResponse.json({ error: 'vin is required' }, { status: 400 });
  }

  try {
    if (USE_SUPABASE_CRM) {
      const ro = await supabaseGetRepairOrder(id);
      if (!ro) {
        return NextResponse.json({ error: 'Repair order not found' }, { status: 404 });
      }

      const currentVehicleId = ro.vehicle_id;
      if (!currentVehicleId) {
        return NextResponse.json({ error: 'Repair order has no vehicle linked' }, { status: 400 });
      }

      const { data: found } = await supabase
        .from('vehicles')
        .select('*')
        .eq('vin', vin)
        .single();

      if (found?.id && found.id !== currentVehicleId) {
        // Link repair order to the found vehicle
        const { data: updatedRo, error } = await supabase
          .from('repair_orders')
          .update({ vehicle_id: found.id })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;

        return NextResponse.json({
          data: {
            repairOrder: updatedRo,
            vehicle: found,
            action: 'linked_existing_vehicle',
          },
        });
      }

      const updatedVehicle = await supabaseUpdateVehicle(currentVehicleId, { vin });

      return NextResponse.json({
        data: {
          repairOrder: ro,
          vehicle: updatedVehicle,
          action: found?.id ? 'vin_already_on_current_vehicle' : 'updated_vehicle_vin',
        },
      });
    } else {
      const roResp = await makeZohoServerRequest<any>({
        method: 'GET',
        endpoint: `/${REPAIR_ORDERS_MODULE}/${id}?fields=${encodeURIComponent(RO_FIELDS)}`,
      });

      const ro = roResp?.data?.[0];
      const currentVehicleId = ro?.Vehicle?.id;

      if (!currentVehicleId) {
        return NextResponse.json({ error: 'Repair order has no vehicle linked' }, { status: 400 });
      }

      const search = await makeZohoServerRequest<ZohoListResponse<any>>({
        method: 'GET',
        endpoint: `/${VEHICLES_MODULE}/search?criteria=(Vin:equals:${encodeURIComponent(vin)})&fields=${encodeURIComponent(
          VEHICLE_FIELDS
        )}`,
      });

      const found = search.data?.[0];

      if (found?.id && found.id !== currentVehicleId) {
        const payload = {
          data: [
            {
              id,
              Vehicle: found.id,
            },
          ],
        };

        await makeZohoServerRequest<any>({
          method: 'PUT',
          endpoint: `/${REPAIR_ORDERS_MODULE}`,
          data: payload,
        });

        const updatedRo = await makeZohoServerRequest<any>({
          method: 'GET',
          endpoint: `/${REPAIR_ORDERS_MODULE}/${id}?fields=${encodeURIComponent(RO_FIELDS)}`,
        });

        return NextResponse.json({
          data: {
            repairOrder: normalizeRepairOrder(updatedRo.data?.[0]),
            vehicle: normalizeVehicle(found),
            action: 'linked_existing_vehicle',
          },
        });
      }

      const updateVehiclePayload = {
        data: [
          {
            id: currentVehicleId,
            Vin: vin,
          },
        ],
      };

      await makeZohoServerRequest<any>({
        method: 'PUT',
        endpoint: `/${VEHICLES_MODULE}`,
        data: updateVehiclePayload,
      });

      const gotVehicle = await makeZohoServerRequest<any>({
        method: 'GET',
        endpoint: `/${VEHICLES_MODULE}/${currentVehicleId}?fields=${encodeURIComponent(VEHICLE_FIELDS)}`,
      });

      return NextResponse.json({
        data: {
          repairOrder: normalizeRepairOrder(ro),
          vehicle: normalizeVehicle(gotVehicle.data?.[0]),
          action: found?.id ? 'vin_already_on_current_vehicle' : 'updated_vehicle_vin',
        },
      });
    }
  } catch (err: any) {
    const s = err?.response?.status || 500;
    return NextResponse.json({ error: 'Failed to check-in VIN' }, { status: s });
  }
};
