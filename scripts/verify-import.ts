#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verify() {
  console.log('🔍 Verifying Supabase data...\n');

  // Count customers
  const { count: customerCount, error: customerError } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true });

  // Count vehicles
  const { count: vehicleCount, error: vehicleError } = await supabase
    .from('vehicles')
    .select('*', { count: 'exact', head: true });

  // Count repair orders
  const { count: repairOrderCount, error: repairOrderError } = await supabase
    .from('repair_orders')
    .select('*', { count: 'exact', head: true });

  // Count attachments
  const { count: attachmentCount, error: attachmentError } = await supabase
    .from('repair_order_attachments')
    .select('*', { count: 'exact', head: true });

  console.log('📊 Supabase Record Counts:');
  console.log(`  Customers: ${customerCount ?? 'ERROR'}`);
  if (customerError) console.log(`    Error: ${customerError.message}`);
  
  console.log(`  Vehicles: ${vehicleCount ?? 'ERROR'}`);
  if (vehicleError) console.log(`    Error: ${vehicleError.message}`);
  
  console.log(`  Repair Orders: ${repairOrderCount ?? 'ERROR'}`);
  if (repairOrderError) console.log(`    Error: ${repairOrderError.message}`);
  
  console.log(`  Attachments: ${attachmentCount ?? 'ERROR'}`);
  if (attachmentError) console.log(`    Error: ${attachmentError.message}`);

  // Sample some data
  console.log('\n📋 Sample Data:');
  
  const { data: sampleCustomers } = await supabase
    .from('customers')
    .select('id, first_name, last_name, phone')
    .limit(3);
  
  console.log('\nCustomers (first 3):');
  sampleCustomers?.forEach(c => {
    console.log(`  - ${c.first_name} ${c.last_name} (${c.phone})`);
  });

  const { data: sampleVehicles } = await supabase
    .from('vehicles')
    .select('id, year, make, model')
    .limit(3);
  
  console.log('\nVehicles (first 3):');
  sampleVehicles?.forEach(v => {
    console.log(`  - ${v.year} ${v.make} ${v.model}`);
  });

  const { data: sampleROs } = await supabase
    .from('repair_orders')
    .select('id, status, service_type')
    .limit(3);
  
  console.log('\nRepair Orders (first 3):');
  sampleROs?.forEach(ro => {
    console.log(`  - ${ro.status}: ${ro.service_type || 'N/A'}`);
  });

  console.log('\n✅ Verification complete!');
}

verify();
