import { NextRequest, NextResponse } from 'next/server';
import { makeZohoServerRequest } from '@/lib/zoho/request-server';
import { normalizeCustomer, normalizeRepairOrder, normalizeVehicle, ZohoListResponse } from '../_shared';
import { USE_SUPABASE_CRM } from '@/lib/feature-flags';
import { supabase } from '@/lib/supabase-crm';

const CONTACTS_MODULE = 'Contacts';
const VEHICLES_MODULE = 'Vehicles';
const REPAIR_ORDERS_MODULE = 'Repair_Orders';

const isLikelyPhone = (q: string) => {
  const digits = q.replace(/\D/g, '');
  // Allow 3+ digits to support partial phone searches like "616" or "616970"
  return digits.length >= 3 && digits.length <= 15;
};

const isLikelyRoId = (q: string) => {
  const s = q.trim().toLowerCase();
  // Matches UUID prefix or full UUID (hex + hyphens)
  return /^[0-9a-f]{4,}(-[0-9a-f]+)*$/.test(s);
};

const isLikelyVin = (q: string) => {
  const s = q.trim().toUpperCase();
  if (!/^[A-Z0-9]+$/.test(s)) return false;
  return s.length >= 11 && s.length <= 17;
};

const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));

const safeLimit = (n: number, fallback: number) => {
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.max(Math.floor(n), 1), 50);
};

const tokenize = (q: string) =>
  q
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 6);

const buildAndContainsCriteria = (fields: string[], q: string) => {
  const tokens = tokenize(q);
  if (!tokens.length) return '';

  const perToken = tokens.map((t) => {
    const orClause = fields.map((f) => `(${f}:contains:${t})`).join(' or ');
    return `(${orClause})`;
  });

  return perToken.length === 1 ? perToken[0] : `(${perToken.join(' and ')})`;
};

type CustomerResult = { id: string; name: string; phone?: string; email?: string };

type VehicleResult = {
  id: string;
  display: string;
  vin?: string;
  plate?: string;
  customerName?: string;
  customerPhone?: string;
};

type RepairOrderResult = {
  id: string;
  status: string;
  serviceType?: string;
  vehicleDisplay?: string;
  customerName?: string;
  customerPhone?: string;
  updatedAt?: string;
};

export const GET = async (req: NextRequest) => {
  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  const limit = safeLimit(Number(req.nextUrl.searchParams.get('limit') || '5'), 5);
  const debug = req.nextUrl.searchParams.get('debug') === '1';

  if (!q) {
    return NextResponse.json({ customers: [], vehicles: [], repairOrders: [] });
  }

  const qDigits = q.replace(/\D/g, '');
  const qVin = q.trim().toUpperCase();

  try {
    if (USE_SUPABASE_CRM) {
      // Use Supabase with full-text search
      const customers: CustomerResult[] = [];
      const vehicles: VehicleResult[] = [];
      const repairOrders: RepairOrderResult[] = [];

      if (isLikelyPhone(q) && !isLikelyRoId(q)) {
        // Phone search - use ilike with wildcards to match formatted phone numbers
        // This handles partial phone numbers and different formats like (616) 821-9153
        const phonePattern = `%${qDigits.split('').join('%')}%`;
        
        const { data: customerData } = await supabase
          .from('customers')
          .select('*')
          .ilike('phone', phonePattern)
          .limit(limit);

        if (customerData) {
          // Filter to only include customers where the digits match in order
          const normalizePhone = (p: string) => p.replace(/\D/g, '');
          const matchingCustomers = customerData.filter(c => {
            const normalized = normalizePhone(c.phone || '');
            return normalized.includes(qDigits);
          });

          matchingCustomers.forEach((c) => {
            const name = `${c.first_name} ${c.last_name}`.trim() || c.phone || c.email || c.id;
            const result: CustomerResult = { id: c.id, name };
            if (c.phone) result.phone = c.phone;
            if (c.email) result.email = c.email;
            customers.push(result);
          });

          // Get repair orders for these customers
          const customerIds = matchingCustomers.map(c => c.id);
          if (customerIds.length) {
            const { data: roData } = await supabase
              .from('repair_orders')
              .select(`*, vehicle:vehicles(*), customer:customers(*)`)
              .in('customer_id', customerIds)
              .limit(limit);

            roData?.forEach((ro: any) => {
              const v = ro.vehicle;
              const c = ro.customer;
              repairOrders.push({
                id: ro.id,
                status: ro.status,
                serviceType: ro.service_type,
                vehicleDisplay: v ? [v.year, v.make, v.model].filter(Boolean).join(' ') : undefined,
                customerName: c ? `${c.first_name} ${c.last_name}`.trim() : undefined,
                customerPhone: c?.phone,
                updatedAt: ro.updated_at,
              });
            });
          }
        }
      } else if (isLikelyVin(q)) {
        // VIN search
        const { data: vehicleData } = await supabase
          .from('vehicles')
          .select('*, customer:customers(*)')
          .eq('vin', qVin)
          .limit(limit);

        if (vehicleData) {
          vehicleData.forEach((v: any) => {
            const display = [v.year, v.make, v.model].filter(Boolean).join(' ') || v.id;
            const c = v.customer;
            const result: VehicleResult = {
              id: v.id,
              display,
              vin: v.vin,
              plate: v.license_plate,
            };
            if (c) {
              const name = `${c.first_name} ${c.last_name}`.trim();
              if (name) result.customerName = name;
              if (c.phone) result.customerPhone = c.phone;
            }
            vehicles.push(result);
          });

          // Get repair orders for these vehicles
          const vehicleIds = vehicleData.map(v => v.id);
          if (vehicleIds.length) {
            const { data: roData } = await supabase
              .from('repair_orders')
              .select(`*, vehicle:vehicles(*), customer:customers(*)`)
              .in('vehicle_id', vehicleIds)
              .limit(limit);

            roData?.forEach((ro: any) => {
              const v = ro.vehicle;
              const c = ro.customer;
              repairOrders.push({
                id: ro.id,
                status: ro.status,
                serviceType: ro.service_type,
                vehicleDisplay: v ? [v.year, v.make, v.model].filter(Boolean).join(' ') : undefined,
                customerName: c ? `${c.first_name} ${c.last_name}`.trim() : undefined,
                customerPhone: c?.phone,
                updatedAt: ro.updated_at,
              });
            });
          }
        }
      } else {
        // Text search using ilike
        const searchPattern = `%${q}%`;

        // Search customers
        const { data: customerData } = await supabase
          .from('customers')
          .select('*')
          .or(`first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},phone.ilike.${searchPattern},email.ilike.${searchPattern}`)
          .limit(limit);

        customerData?.forEach((c) => {
          const name = `${c.first_name} ${c.last_name}`.trim() || c.phone || c.email || c.id;
          const result: CustomerResult = { id: c.id, name };
          if (c.phone) result.phone = c.phone;
          if (c.email) result.email = c.email;
          customers.push(result);
        });

        // Search vehicles
        const { data: vehicleData } = await supabase
          .from('vehicles')
          .select('*, customer:customers(*)')
          .or(`year.ilike.${searchPattern},make.ilike.${searchPattern},model.ilike.${searchPattern},vin.ilike.${searchPattern},license_plate.ilike.${searchPattern}`)
          .limit(limit);

        vehicleData?.forEach((v: any) => {
          const display = [v.year, v.make, v.model].filter(Boolean).join(' ') || v.id;
          const c = v.customer;
          const result: VehicleResult = {
            id: v.id,
            display,
            vin: v.vin,
            plate: v.license_plate,
          };
          if (c) {
            const name = `${c.first_name} ${c.last_name}`.trim();
            if (name) result.customerName = name;
            if (c.phone) result.customerPhone = c.phone;
          }
          vehicles.push(result);
        });

        // Search repair orders by text fields
        const { data: roData } = await supabase
          .from('repair_orders')
          .select(`*, vehicle:vehicles(*), customer:customers(*)`)
          .or(`service_type.ilike.${searchPattern},job_description.ilike.${searchPattern},note.ilike.${searchPattern}`)
          .limit(limit);

        const pushRo = (ro: any) => {
          if (repairOrders.find((r) => r.id === ro.id)) return;
          const v = ro.vehicle;
          const c = ro.customer;
          repairOrders.push({
            id: ro.id,
            status: ro.status,
            serviceType: ro.service_type,
            vehicleDisplay: v ? [v.year, v.make, v.model].filter(Boolean).join(' ') : undefined,
            customerName: c ? `${c.first_name} ${c.last_name}`.trim() : undefined,
            customerPhone: c?.phone,
            updatedAt: ro.updated_at,
          });
        };

        roData?.forEach(pushRo);

        // Also search by RO ID prefix (uuid column — construct valid UUID range bounds)
        const qClean = q.trim().toLowerCase().replace(/-/g, '');
        if (/^[0-9a-f]{4,32}$/.test(qClean)) {
          // Pad to 32 hex chars (UUID without hyphens), then insert hyphens
          const loHex = qClean.padEnd(32, '0');
          const hiHex = qClean.padEnd(32, 'f');
          const toUuid = (h: string) =>
            `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;

          const { data: roById } = await supabase
            .from('repair_orders')
            .select(`*, vehicle:vehicles(*), customer:customers(*)`)
            .gte('id', toUuid(loHex))
            .lte('id', toUuid(hiHex))
            .limit(limit);

          roById?.forEach(pushRo);
        }
      }

      return NextResponse.json({ customers, vehicles, repairOrders });
    }

    // Zoho implementation
    const callErrors: Record<string, any> = {};
    const safeGetList = async (label: string, endpoint: string) => {
      try {
        const resp = await makeZohoServerRequest<ZohoListResponse<any>>({ method: 'GET', endpoint });
        return resp.data || [];
      } catch (e: any) {
        callErrors[label] = e?.response?.data || e?.message || String(e);
        return [];
      }
    };

    const customerFields = ['id', 'First_Name', 'Last_Name', 'Phone', 'Email'].join(',');
    const vehicleFields = ['id', 'Name', 'Make', 'Model', 'Vin', 'License_Plate', 'Owner1'].join(',');
    const roFields = [
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

    let zohoCustomers: any[] = [];
    let zohoVehicles: any[] = [];
    let zohoRepairOrders: any[] = [];

    if (isLikelyPhone(q)) {
      const phone = qDigits;

      const customerCriteria = `(Phone:equals:${phone})`;

      const customersResp = await makeZohoServerRequest<ZohoListResponse<any>>({
        method: 'GET',
        endpoint: `/${CONTACTS_MODULE}/search?criteria=${encodeURIComponent(
          customerCriteria
        )}&fields=${encodeURIComponent(customerFields)}`,
      });
      zohoCustomers = customersResp.data || [];

      const customerIds = uniq((zohoCustomers || []).map((c: any) => c?.id).filter(Boolean));

      if (customerIds.length) {
        const roByCustomer = await Promise.all(
          customerIds.map((id) =>
            makeZohoServerRequest<ZohoListResponse<any>>({
              method: 'GET',
              endpoint: `/${REPAIR_ORDERS_MODULE}/search?criteria=${encodeURIComponent(
                `(Customer:equals:${id})`
              )}&fields=${encodeURIComponent(roFields)}`,
            })
          )
        );

        zohoRepairOrders = roByCustomer.flatMap((r) => r.data || []);
      }
    } else if (isLikelyVin(q)) {
      const vin = qVin;

      const vehicleCriteria = `(Vin:equals:${vin})`;

      const vehiclesResp = await makeZohoServerRequest<ZohoListResponse<any>>({
        method: 'GET',
        endpoint: `/${VEHICLES_MODULE}/search?criteria=${encodeURIComponent(
          vehicleCriteria
        )}&fields=${encodeURIComponent(vehicleFields)}`,
      });

      zohoVehicles = vehiclesResp.data || [];

      const vehicleIds = uniq((zohoVehicles || []).map((v: any) => v?.id).filter(Boolean));
      if (vehicleIds.length) {
        const roByVehicle = await Promise.all(
          vehicleIds.map((id) =>
            makeZohoServerRequest<ZohoListResponse<any>>({
              method: 'GET',
              endpoint: `/${REPAIR_ORDERS_MODULE}/search?criteria=${encodeURIComponent(
                `(Vehicle:equals:${id})`
              )}&fields=${encodeURIComponent(roFields)}`,
            })
          )
        );

        zohoRepairOrders = roByVehicle.flatMap((r) => r.data || []);
      }
    } else {
      const text = q;

      const safeText = tokenize(text)
        .map((t) => t.replace(/[()]/g, ' '))
        .join(' ')
        .trim();

      const word = encodeURIComponent(safeText);

      const [customersData, vehiclesData, repairOrdersData] = await Promise.all([
        safeGetList('customersWord', `/${CONTACTS_MODULE}/search?word=${word}&fields=${encodeURIComponent(customerFields)}`),
        safeGetList('vehiclesWord', `/${VEHICLES_MODULE}/search?word=${word}&fields=${encodeURIComponent(vehicleFields)}`),
        safeGetList(
          'repairOrdersWord',
          `/${REPAIR_ORDERS_MODULE}/search?word=${word}&fields=${encodeURIComponent(roFields)}`
        ),
      ]);

      zohoCustomers = customersData;
      zohoVehicles = vehiclesData;
      zohoRepairOrders = repairOrdersData;
    }

    const customers = (zohoCustomers || []).slice(0, limit).map((z) => {
      const c = normalizeCustomer(z);
      const name = `${c.first_name} ${c.last_name}`.trim() || c.phone || c.email || c.id;
      const out: CustomerResult = { id: c.id, name };
      if (c.phone) out.phone = c.phone;
      if (c.email) out.email = c.email;
      return out;
    });

    const vehiclesNormalized = (zohoVehicles || []).map(normalizeVehicle);

    const vehicleCustomerIds = uniq(
      vehiclesNormalized.map((v) => v.customer_id).filter(Boolean)
    ).slice(0, 20);

    const customersById: Record<string, any> = {};

    if (vehicleCustomerIds.length) {
      const got = await Promise.all(
        vehicleCustomerIds.map((id) =>
          makeZohoServerRequest<any>({
            method: 'GET',
            endpoint: `/${CONTACTS_MODULE}/${id}?fields=${encodeURIComponent(customerFields)}`,
          })
        )
      );

      got.forEach((r) => {
        const z = r?.data?.[0];
        if (z?.id) customersById[z.id] = normalizeCustomer(z);
      });
    }

    const vehicles: VehicleResult[] = vehiclesNormalized.slice(0, limit).map((v) => {
      const display = [v.year, v.make, v.model].filter(Boolean).join(' ') || v.id;
      const c = v.customer_id ? customersById[v.customer_id] : null;
      const out: VehicleResult = {
        id: v.id,
        display,
        vin: v.vin || undefined,
        plate: v.license_plate || undefined,
      };
      if (c) {
        const name = `${c.first_name} ${c.last_name}`.trim();
        if (name) out.customerName = name;
        if (c.phone) out.customerPhone = c.phone;
      }
      return out;
    });

    const repairOrdersNormalized = (zohoRepairOrders || []).map(normalizeRepairOrder);
    const roVehicleIds = uniq(repairOrdersNormalized.map((r) => r.vehicle_id).filter(Boolean)).slice(0, 30);

    const vehiclesById: Record<string, any> = {};

    if (roVehicleIds.length) {
      const got = await Promise.all(
        roVehicleIds.map((id) =>
          makeZohoServerRequest<any>({
            method: 'GET',
            endpoint: `/${VEHICLES_MODULE}/${id}?fields=${encodeURIComponent(vehicleFields)}`,
          })
        )
      );

      got.forEach((r) => {
        const z = r?.data?.[0];
        if (z?.id) vehiclesById[z.id] = normalizeVehicle(z);
      });

      const roCustomerIds = uniq(
        Object.values(vehiclesById)
          .map((v: any) => v.customer_id)
          .filter(Boolean)
      ).slice(0, 30);

      const gotCustomers = await Promise.all(
        roCustomerIds.map((id) =>
          makeZohoServerRequest<any>({
            method: 'GET',
            endpoint: `/${CONTACTS_MODULE}/${id}?fields=${encodeURIComponent(customerFields)}`,
          })
        )
      );

      gotCustomers.forEach((r) => {
        const z = r?.data?.[0];
        if (z?.id) customersById[z.id] = normalizeCustomer(z);
      });
    }

    const repairOrders: RepairOrderResult[] = repairOrdersNormalized.slice(0, limit).map((r) => {
      const v = r.vehicle_id ? vehiclesById[r.vehicle_id] : null;
      const c = v?.customer_id ? customersById[v.customer_id] : null;

      const out: RepairOrderResult = {
        id: r.id,
        status: r.status,
        serviceType: r.service_type || undefined,
        updatedAt: r.updated_time || undefined,
      };

      if (v) {
        out.vehicleDisplay = [v.year, v.make, v.model].filter(Boolean).join(' ') || undefined;
      }

      if (c) {
        const name = `${c.first_name} ${c.last_name}`.trim();
        if (name) out.customerName = name;
        if (c.phone) out.customerPhone = c.phone;
      }

      return out;
    });

    if (debug && Object.keys(callErrors).length) {
      return NextResponse.json({ customers, vehicles, repairOrders, debug: { callErrors } });
    }

    return NextResponse.json({ customers, vehicles, repairOrders });
  } catch (err: any) {
    const s = err?.response?.status || 500;

    if (debug) {
      return NextResponse.json(
        {
          error: 'Failed to search CRM',
          status: s,
          details: err?.response?.data || err?.message || String(err),
        },
        { status: s }
      );
    }

    return NextResponse.json({ error: 'Failed to search CRM' }, { status: s });
  }
};
