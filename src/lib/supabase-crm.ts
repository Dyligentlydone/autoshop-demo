/**
 * Supabase CRM Helper Functions
 * Mirrors Zoho CRM functions but uses Supabase
 */

import { createClient } from '@supabase/supabase-js';
import type { Customer, Vehicle, RepairOrder, RepairOrderStatus } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// =====================================================
// APPOINTMENT SYNC HELPER
// =====================================================

/**
 * Syncs repair order dates to appointments table for calendar display
 */
export async function syncRepairOrderToAppointments(repairOrderId: string): Promise<void> {
  // Fetch the repair order with vehicle and customer data
  const { data: ro, error: roError } = await supabase
    .from('repair_orders')
    .select(`
      *,
      vehicles!repair_orders_vehicle_id_fkey(*),
      customers!repair_orders_customer_id_fkey(*)
    `)
    .eq('id', repairOrderId)
    .single();

  if (roError || !ro) {
    console.error('[syncRepairOrderToAppointments] Failed to fetch repair order:', roError);
    return;
  }

  const vehicle = ro.vehicles;
  const customer = ro.customers;

  const vehicleDisplay = vehicle
    ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')
    : null;

  const customerName = customer
    ? `${customer.first_name} ${customer.last_name}`.trim()
    : null;

  // Map status to appointment status
  let appointmentStatus: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' = 'scheduled';
  const roStatus = ro.status;
  
  if (roStatus === 'Completed') {
    appointmentStatus = 'completed';
  } else if (['In Progress', 'Diagnosing', 'Repair Approved', 'Dropped Off', 'Waiting Approval'].includes(roStatus)) {
    appointmentStatus = 'in_progress';
  } else if (roStatus === 'Ready For Pickup') {
    appointmentStatus = 'completed';
  }

  // Sync estimated_completion appointment
  if (ro.estimated_completion) {
    await supabase
      .from('appointments')
      .upsert({
        repair_order_id: ro.id,
        customer_name: customerName,
        customer_phone: customer?.phone || null,
        vehicle_display: vehicleDisplay,
        service_type: ro.service_type,
        scheduled_datetime: ro.estimated_completion,
        status: appointmentStatus,
        zoho_status: ro.status,
        appointment_type: 'estimated_completion',
      }, {
        onConflict: 'repair_order_id,appointment_type',
      });
  } else {
    // Delete if date was cleared
    await supabase
      .from('appointments')
      .delete()
      .eq('repair_order_id', repairOrderId)
      .eq('appointment_type', 'estimated_completion');
  }

  // Sync scheduled_drop_off appointment
  if (ro.scheduled_drop_off) {
    await supabase
      .from('appointments')
      .upsert({
        repair_order_id: ro.id,
        customer_name: customerName,
        customer_phone: customer?.phone || null,
        vehicle_display: vehicleDisplay,
        service_type: ro.service_type,
        scheduled_datetime: ro.scheduled_drop_off,
        status: 'scheduled', // Drop-offs are always scheduled
        zoho_status: ro.status,
        appointment_type: 'scheduled_drop_off',
      }, {
        onConflict: 'repair_order_id,appointment_type',
      });
  } else {
    // Delete if date was cleared
    await supabase
      .from('appointments')
      .delete()
      .eq('repair_order_id', repairOrderId)
      .eq('appointment_type', 'scheduled_drop_off');
  }
}

// =====================================================
// CUSTOMER FUNCTIONS
// =====================================================

export async function supabaseLookupCustomerByPhone(phone: string): Promise<Customer | null> {
  // First try exact match
  let { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();

  if (data) {
    return {
      id: data.id,
      first_name: data.first_name,
      last_name: data.last_name,
      phone: data.phone,
      email: data.email,
    };
  }

  // If no exact match, try searching by removing all non-digits from stored phone numbers
  // This handles cases where phone is stored as "(616) 970-1109" but we're searching for "6169701109"
  const { data: allCustomers, error: searchError } = await supabase
    .from('customers')
    .select('*')
    .not('phone', 'is', null);

  if (searchError || !allCustomers) return null;

  // Find customer where normalized phone matches
  const normalizePhone = (p: string) => p.replace(/\D/g, '').replace(/^1/, '');
  const normalizedSearch = normalizePhone(phone);

  const match = allCustomers.find(c => normalizePhone(c.phone || '') === normalizedSearch);
  
  if (!match) return null;

  return {
    id: match.id,
    first_name: match.first_name,
    last_name: match.last_name,
    phone: match.phone,
    email: match.email,
  };
}

export async function supabaseLookupCustomerByEmail(email: string): Promise<Customer | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .ilike('email', email)
    .single();

  if (error || !data) return null;
  
  return {
    id: data.id,
    first_name: data.first_name,
    last_name: data.last_name,
    phone: data.phone,
    email: data.email,
  };
}

export async function supabaseLookupCustomerByName(name: string): Promise<Customer | null> {
  const parts = name.trim().split(/\s+/);
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');

  let query = supabase.from('customers').select('*');

  if (firstName) {
    query = query.ilike('first_name', `%${firstName}%`);
  }
  if (lastName) {
    query = query.ilike('last_name', `%${lastName}%`);
  }

  const { data, error } = await query.limit(1).single();

  if (error || !data) return null;
  
  return {
    id: data.id,
    first_name: data.first_name,
    last_name: data.last_name,
    phone: data.phone,
    email: data.email,
  };
}

export async function supabaseCreateCustomer(input: {
  phone: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .insert({
      phone: input.phone,
      first_name: input.first_name || '',
      last_name: input.last_name || '',
      email: input.email || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create customer: ${error.message}`);
  }

  return {
    id: data.id,
    first_name: data.first_name,
    last_name: data.last_name,
    phone: data.phone,
    email: data.email,
  };
}

export async function supabaseUpdateCustomer(
  id: string,
  updates: Partial<Customer>
): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update customer: ${error.message}`);
  }

  return {
    id: data.id,
    first_name: data.first_name,
    last_name: data.last_name,
    phone: data.phone,
    email: data.email,
  };
}

export async function supabaseGetCustomer(id: string): Promise<Customer | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    first_name: data.first_name,
    last_name: data.last_name,
    phone: data.phone,
    email: data.email,
  };
}

export async function supabaseSearchCustomers(query: string): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(50);

  if (error || !data) return [];

  return data.map(d => ({
    id: d.id,
    first_name: d.first_name,
    last_name: d.last_name,
    phone: d.phone,
    email: d.email,
  }));
}

// =====================================================
// VEHICLE FUNCTIONS
// =====================================================

export async function supabaseCreateVehicle(input: {
  year: string;
  make: string;
  model: string;
  customer_id: string;
  vin?: string;
  license_plate?: string;
}): Promise<Vehicle> {
  const { data, error } = await supabase
    .from('vehicles')
    .insert({
      customer_id: input.customer_id,
      year: input.year,
      make: input.make,
      model: input.model,
      vin: input.vin || null,
      license_plate: input.license_plate || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create vehicle: ${error.message}`);
  }

  return {
    id: data.id,
    customer_id: data.customer_id,
    year: data.year,
    make: data.make,
    model: data.model,
    vin: data.vin,
    license_plate: data.license_plate,
    engine_size: data.engine_size,
  };
}

export async function supabaseUpdateVehicle(
  id: string,
  updates: Partial<Vehicle>
): Promise<Vehicle> {
  const { data, error } = await supabase
    .from('vehicles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update vehicle: ${error.message}`);
  }

  return {
    id: data.id,
    customer_id: data.customer_id,
    year: data.year,
    make: data.make,
    model: data.model,
    vin: data.vin,
    license_plate: data.license_plate,
    engine_size: data.engine_size,
  };
}

export async function supabaseGetVehicle(id: string): Promise<Vehicle | null> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    customer_id: data.customer_id,
    year: data.year,
    make: data.make,
    model: data.model,
    vin: data.vin,
    license_plate: data.license_plate,
    engine_size: data.engine_size,
  };
}

export async function supabaseGetVehiclesByCustomer(customerId: string): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map(d => ({
    id: d.id,
    customer_id: d.customer_id,
    year: d.year,
    make: d.make,
    model: d.model,
    vin: d.vin,
    license_plate: d.license_plate,
    engine_size: d.engine_size,
  }));
}

export async function supabaseSearchVehicles(query: string): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .or(`year.ilike.%${query}%,make.ilike.%${query}%,model.ilike.%${query}%,vin.ilike.%${query}%,license_plate.ilike.%${query}%`)
    .limit(50);

  if (error || !data) return [];

  return data.map(d => ({
    id: d.id,
    customer_id: d.customer_id,
    year: d.year,
    make: d.make,
    model: d.model,
    vin: d.vin,
    license_plate: d.license_plate,
    engine_size: d.engine_size,
  }));
}

// =====================================================
// REPAIR ORDER FUNCTIONS
// =====================================================

export async function supabaseCreateRepairOrder(input: {
  vehicle_id: string;
  customer_id: string;
  status?: RepairOrderStatus;
  service_type?: string;
  job_description?: string;
  notes?: string;
  estimated_total?: number;
  final_charge_total?: number;
  estimated_completion?: string;
  scheduled_drop_off?: string;
}): Promise<RepairOrder> {
  const { data, error } = await supabase
    .from('repair_orders')
    .insert({
      vehicle_id: input.vehicle_id,
      customer_id: input.customer_id,
      status: input.status || 'New',
      service_type: input.service_type || null,
      job_description: input.job_description || null,
      note: input.notes || null,
      estimated_total: input.estimated_total || null,
      final_charge_total: input.final_charge_total || null,
      estimated_completion: input.estimated_completion || null,
      scheduled_drop_off: input.scheduled_drop_off || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create repair order: ${error.message}`);
  }

  return {
    id: data.id,
    vehicle_id: data.vehicle_id,
    customer_id: data.customer_id,
    status: data.status,
    service_type: data.service_type,
    job_description: data.job_description,
    note: data.note,
    notes: data.note,
    estimated_total: data.estimated_total,
    final_charge_total: data.final_charge_total,
    estimated_completion: data.estimated_completion,
    scheduled_drop_off: data.scheduled_drop_off,
    created_time: data.created_at,
    updated_time: data.updated_at,
  };
}

export async function supabaseUpdateRepairOrder(input: {
  id: string;
  status?: RepairOrderStatus;
  service_type?: string;
  job_description?: string;
  notes?: string;
  estimated_total?: number;
  final_charge_total?: number;
  estimated_completion?: string;
  scheduled_drop_off?: string;
}): Promise<RepairOrder> {
  const updates: any = {};
  
  if (input.status !== undefined) updates.status = input.status;
  if (input.service_type !== undefined) updates.service_type = input.service_type;
  if (input.job_description !== undefined) updates.job_description = input.job_description;
  if (input.notes !== undefined) updates.note = input.notes;
  if (input.estimated_total !== undefined) updates.estimated_total = input.estimated_total;
  if (input.final_charge_total !== undefined) updates.final_charge_total = input.final_charge_total;
  if (input.estimated_completion !== undefined) updates.estimated_completion = input.estimated_completion;
  if (input.scheduled_drop_off !== undefined) updates.scheduled_drop_off = input.scheduled_drop_off;

  const { data, error } = await supabase
    .from('repair_orders')
    .update(updates)
    .eq('id', input.id)
    .select()
    .single();

  if (error) {
    console.error('[supabaseUpdateRepairOrder] Error:', error);
    console.error('[supabaseUpdateRepairOrder] Updates:', updates);
    throw new Error(`Failed to update repair order: ${error.message}`);
  }

  return {
    id: data.id,
    vehicle_id: data.vehicle_id,
    customer_id: data.customer_id,
    status: data.status,
    service_type: data.service_type,
    job_description: data.job_description,
    note: data.note,
    notes: data.note,
    estimated_total: data.estimated_total,
    final_charge_total: data.final_charge_total,
    estimated_completion: data.estimated_completion,
    scheduled_drop_off: data.scheduled_drop_off,
    created_time: data.created_at,
    updated_time: data.updated_at,
  };
}

export async function supabaseGetRepairOrder(id: string): Promise<RepairOrder | null> {
  const { data, error } = await supabase
    .from('repair_orders')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    vehicle_id: data.vehicle_id,
    customer_id: data.customer_id,
    status: data.status,
    service_type: data.service_type,
    job_description: data.job_description,
    note: data.note,
    notes: data.note,
    estimated_total: data.estimated_total,
    final_charge_total: data.final_charge_total,
    estimated_completion: data.estimated_completion,
    scheduled_drop_off: data.scheduled_drop_off,
    created_time: data.created_at,
    updated_time: data.updated_at,
  };
}

export async function supabaseGetRepairOrdersByVehicle(vehicleId: string): Promise<RepairOrder[]> {
  const { data, error } = await supabase
    .from('repair_orders')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map(d => ({
    id: d.id,
    vehicle_id: d.vehicle_id,
    customer_id: d.customer_id,
    status: d.status,
    service_type: d.service_type,
    job_description: d.job_description,
    note: d.note,
    notes: d.note,
    estimated_total: d.estimated_total,
    final_charge_total: d.final_charge_total,
    estimated_completion: d.estimated_completion,
    scheduled_drop_off: d.scheduled_drop_off,
    created_time: d.created_at,
    updated_time: d.updated_at,
  }));
}

export async function supabaseGetRepairOrdersByCustomer(customerId: string): Promise<RepairOrder[]> {
  const { data, error } = await supabase
    .from('repair_orders')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map(d => ({
    id: d.id,
    vehicle_id: d.vehicle_id,
    customer_id: d.customer_id,
    status: d.status,
    service_type: d.service_type,
    job_description: d.job_description,
    note: d.note,
    notes: d.note,
    estimated_total: d.estimated_total,
    final_charge_total: d.final_charge_total,
    estimated_completion: d.estimated_completion,
    scheduled_drop_off: d.scheduled_drop_off,
    created_time: d.created_at,
    updated_time: d.updated_at,
  }));
}

export async function supabaseGetRepairOrdersByStatus(status: RepairOrderStatus): Promise<RepairOrder[]> {
  const { data, error } = await supabase
    .from('repair_orders')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map(d => ({
    id: d.id,
    vehicle_id: d.vehicle_id,
    customer_id: d.customer_id,
    status: d.status,
    service_type: d.service_type,
    job_description: d.job_description,
    note: d.note,
    notes: d.note,
    estimated_total: d.estimated_total,
    final_charge_total: d.final_charge_total,
    estimated_completion: d.estimated_completion,
    scheduled_drop_off: d.scheduled_drop_off,
    created_time: d.created_at,
    updated_time: d.updated_at,
  }));
}

export async function supabaseGetEnrichedRepairOrders(limit = 50): Promise<any[]> {
  const { data, error } = await supabase
    .from('repair_orders')
    .select(`
      *,
      vehicle:vehicles(*),
      customer:customers(*)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data;
}

// =====================================================
// GLOBAL SEARCH
// =====================================================

export async function supabaseGlobalSearch(query: string) {
  const [customers, vehicles, repairOrders] = await Promise.all([
    supabaseSearchCustomers(query),
    supabaseSearchVehicles(query),
    supabase
      .from('repair_orders')
      .select('*')
      .or(`service_type.ilike.%${query}%,job_description.ilike.%${query}%,note.ilike.%${query}%`)
      .limit(20)
      .then(({ data }) => data || []),
  ]);

  return {
    customers,
    vehicles,
    repairOrders,
  };
}
