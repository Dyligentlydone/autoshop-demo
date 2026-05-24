import { NextRequest, NextResponse } from 'next/server';
import { makeZohoServerRequest } from '@/lib/zoho/request-server';
import { normalizeVehicle } from '../_shared';
import { USE_SUPABASE_CRM } from '@/lib/feature-flags';
import { supabaseCreateVehicle } from '@/lib/supabase-crm';

const VEHICLES_MODULE = 'Vehicles';

const FIELDS = ['id', 'Name', 'Make', 'Model', 'Vin', 'License_Plate', 'Engine_Size', 'Owner1'].join(',');

export const POST = async (req: NextRequest) => {
  const body = await req.json();

  const payload = {
    data: [
      {
        Name: body?.year || '',
        Make: body?.make || '',
        Model: body?.model || '',
        ...(body?.vin ? { Vin: body.vin } : {}),
        ...(body?.license_plate ? { License_Plate: body.license_plate } : {}),
        ...(body?.engine_size ? { Engine_Size: body.engine_size } : {}),
        Owner1: body?.customer_id || undefined,
      },
    ],
  };

  try {
    if (USE_SUPABASE_CRM) {
      const vehicle = await supabaseCreateVehicle({
        year: body?.year || '',
        make: body?.make || '',
        model: body?.model || '',
        customer_id: body?.customer_id || '',
        vin: body?.vin,
        license_plate: body?.license_plate,
      });
      return NextResponse.json({ data: vehicle }, { status: 201 });
    } else {
      const created = await makeZohoServerRequest<any>({
        method: 'POST',
        endpoint: `/${VEHICLES_MODULE}`,
        data: payload,
      });

      const id = created?.data?.[0]?.details?.id;
      if (!id) {
        return NextResponse.json({ error: 'Failed to create vehicle' }, { status: 500 });
      }

      const got = await makeZohoServerRequest<any>({
        method: 'GET',
        endpoint: `/${VEHICLES_MODULE}/${id}?fields=${encodeURIComponent(FIELDS)}`,
      });

      return NextResponse.json({ data: normalizeVehicle(got.data?.[0]) }, { status: 201 });
    }
  } catch (err: any) {
    const s = err?.response?.status || 500;
    return NextResponse.json({ error: 'Failed to create vehicle' }, { status: s });
  }
};
