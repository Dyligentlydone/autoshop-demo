import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { makeZohoServerRequest } from '@/lib/zoho/request-server';
import { normalizeCustomer, normalizeRepairOrder, normalizeVehicle } from '@/app/api/crm/_shared';
import { clearCache } from '@/app/api/crm/repair-orders/cache';

const CONTACTS_MODULE = 'Contacts';
const VEHICLES_MODULE = 'Vehicles';
const REPAIR_ORDERS_MODULE = 'Repair_Orders';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Fetch the backup record
    const { data: backup, error: fetchError } = await supabaseAdmin
      .from('crm_backup')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !backup) {
      return NextResponse.json({ error: 'Backup record not found' }, { status: 404 });
    }

    if (backup.synced_to_zoho) {
      return NextResponse.json({ error: 'Already synced' }, { status: 400 });
    }

    // Create or find customer
    const phone = backup.phone;
    let customerId = '';

    // Try to find existing customer by phone
    const customerSearchResp = await makeZohoServerRequest<any>({
      method: 'GET',
      endpoint: `/${CONTACTS_MODULE}/search?criteria=(Phone:equals:${encodeURIComponent(phone)})&fields=id,First_Name,Last_Name,Phone,Email`,
    });

    const existingCustomer = customerSearchResp.data?.[0];

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      // Create new customer
      const nameParts = (backup.customer_name || '').trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || firstName || 'Unknown';

      const customerPayload = {
        data: [
          {
            Phone: phone,
            ...(firstName ? { First_Name: firstName } : {}),
            Last_Name: lastName,
            ...(backup.email ? { Email: backup.email } : {}),
          },
        ],
      };

      const createdCustomer = await makeZohoServerRequest<any>({
        method: 'POST',
        endpoint: `/${CONTACTS_MODULE}`,
        data: customerPayload,
      });

      customerId = createdCustomer?.data?.[0]?.details?.id;
      if (!customerId) throw new Error('Failed to create customer');
    }

    // Create vehicle
    const vehiclePayload = {
      data: [
        {
          Name: backup.vehicle_year || '',
          Make: backup.vehicle_make || '',
          Model: backup.vehicle_model || '',
          ...(backup.vin ? { Vin: backup.vin } : {}),
          Owner1: customerId,
        },
      ],
    };

    const createdVehicle = await makeZohoServerRequest<any>({
      method: 'POST',
      endpoint: `/${VEHICLES_MODULE}`,
      data: vehiclePayload,
    });

    const vehicleId = createdVehicle?.data?.[0]?.details?.id;
    if (!vehicleId) throw new Error('Failed to create vehicle');

    // Create repair order
    // Format scheduled_drop_off as YYYY-MM-DD (Zoho field is Date type, not DateTime)
    // Use UTC methods since stored values may be UTC ISO strings
    let formattedDropOff = null;
    if (backup.scheduled_drop_off) {
      const parsed = new Date(backup.scheduled_drop_off);
      if (!isNaN(parsed.getTime())) {
        const y = parsed.getUTCFullYear();
        const m = String(parsed.getUTCMonth() + 1).padStart(2, '0');
        const d = String(parsed.getUTCDate()).padStart(2, '0');
        formattedDropOff = `${y}-${m}-${d}`;
      }
    }

    const roPayload = {
      data: [
        {
          Name: backup.service_type || `RO-${Date.now()}`,
          Status: 'New',
          ...(backup.job_description ? { Job_Description: backup.job_description } : {}),
          ...(formattedDropOff ? { Scheduled_drop_off: formattedDropOff } : {}),
          Vehicle: vehicleId,
          Customer: customerId,
        },
      ],
    };

    const createdRO = await makeZohoServerRequest<any>({
      method: 'POST',
      endpoint: `/${REPAIR_ORDERS_MODULE}`,
      data: roPayload,
    });

    const roId = createdRO?.data?.[0]?.details?.id;
    if (!roId) {
      console.error('[sync] Zoho repair order creation failed:', JSON.stringify(createdRO, null, 2));
      throw new Error('Failed to create repair order');
    }

    // Mark as synced in Supabase
    const { error: updateError } = await supabaseAdmin
      .from('crm_backup')
      .update({ synced_to_zoho: true })
      .eq('id', id);

    if (updateError) {
      console.error('[sync] failed to mark as synced', updateError);
    }

    // Clear cache so new repair order appears immediately
    clearCache();

    return NextResponse.json({ success: true, repairOrderId: roId }, { status: 201 });
  } catch (err: any) {
    console.error('[sync] error', err);
    return NextResponse.json({ error: 'Failed to sync to Zoho' }, { status: 500 });
  }
}
