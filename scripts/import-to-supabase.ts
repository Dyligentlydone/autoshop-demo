#!/usr/bin/env tsx

/**
 * Import data from Zoho JSON exports to Supabase
 * Creates ID mapping for relationships
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

const EXPORT_DIR = join(process.cwd(), 'zoho-export');
const MAPPING_FILE = join(EXPORT_DIR, 'id-mapping.json');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface IdMapping {
  customers: Record<string, string>; // Zoho ID -> Supabase UUID
  vehicles: Record<string, string>;
  repairOrders: Record<string, string>;
  attachments: Record<string, string>;
}

const idMapping: IdMapping = {
  customers: {},
  vehicles: {},
  repairOrders: {},
  attachments: {},
};

async function importCustomers(): Promise<void> {
  console.log('📥 Importing customers to Supabase...');
  
  const customersJson = readFileSync(join(EXPORT_DIR, 'customers.json'), 'utf-8');
  const customers = JSON.parse(customersJson);

  let imported = 0;
  let errors = 0;

  for (const zohoCustomer of customers) {
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          zoho_id: zohoCustomer.id,
          first_name: zohoCustomer.First_Name || '',
          last_name: zohoCustomer.Last_Name || '',
          phone: zohoCustomer.Phone || '',
          email: zohoCustomer.Email || null,
          preferred_contact_method: zohoCustomer.Preferred_Contact_Method || null,
          description: zohoCustomer.Description || null,
          created_at: zohoCustomer.Created_Time || new Date().toISOString(),
          updated_at: zohoCustomer.Modified_Time || new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        console.error(`  ❌ Failed to import customer ${zohoCustomer.id}:`, error.message);
        errors++;
      } else {
        idMapping.customers[zohoCustomer.id] = data.id;
        imported++;
        
        if (imported % 50 === 0) {
          console.log(`  Progress: ${imported}/${customers.length} customers imported`);
        }
      }
    } catch (error: any) {
      console.error(`  ❌ Exception importing customer ${zohoCustomer.id}:`, error.message);
      errors++;
    }
  }

  console.log(`✅ Imported ${imported} customers (${errors} errors)`);
}

async function importVehicles(): Promise<void> {
  console.log('📥 Importing vehicles to Supabase...');
  
  const vehiclesJson = readFileSync(join(EXPORT_DIR, 'vehicles.json'), 'utf-8');
  const vehicles = JSON.parse(vehiclesJson);

  let imported = 0;
  let errors = 0;

  for (const zohoVehicle of vehicles) {
    try {
      // Map Zoho customer ID to Supabase UUID
      const zohoCustomerId = zohoVehicle.Owner1?.id;
      const supabaseCustomerId = zohoCustomerId ? idMapping.customers[zohoCustomerId] : null;

      if (zohoCustomerId && !supabaseCustomerId) {
        console.warn(`  ⚠️  Vehicle ${zohoVehicle.id} references unknown customer ${zohoCustomerId}`);
      }

      const { data, error } = await supabase
        .from('vehicles')
        .insert({
          zoho_id: zohoVehicle.id,
          customer_id: supabaseCustomerId || null,
          year: zohoVehicle.Name || '',
          make: zohoVehicle.Make || '',
          model: zohoVehicle.Model || '',
          vin: zohoVehicle.Vin || null,
          license_plate: zohoVehicle.License_Plate || null,
          engine_size: zohoVehicle.Engine_Size || null,
          color: zohoVehicle.Color || null,
          note: zohoVehicle.Note || null,
          created_at: zohoVehicle.Created_Time || new Date().toISOString(),
          updated_at: zohoVehicle.Modified_Time || new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        console.error(`  ❌ Failed to import vehicle ${zohoVehicle.id}:`, error.message);
        errors++;
      } else {
        idMapping.vehicles[zohoVehicle.id] = data.id;
        imported++;
        
        if (imported % 50 === 0) {
          console.log(`  Progress: ${imported}/${vehicles.length} vehicles imported`);
        }
      }
    } catch (error: any) {
      console.error(`  ❌ Exception importing vehicle ${zohoVehicle.id}:`, error.message);
      errors++;
    }
  }

  console.log(`✅ Imported ${imported} vehicles (${errors} errors)`);
}

async function importRepairOrders(): Promise<void> {
  console.log('📥 Importing repair orders to Supabase...');
  
  const repairOrdersJson = readFileSync(join(EXPORT_DIR, 'repair-orders.json'), 'utf-8');
  const repairOrders = JSON.parse(repairOrdersJson);

  let imported = 0;
  let errors = 0;

  for (const zohoRO of repairOrders) {
    try {
      // Map Zoho IDs to Supabase UUIDs
      const zohoVehicleId = zohoRO.Vehicle?.id;
      const zohoCustomerId = zohoRO.Customer?.id;
      const supabaseVehicleId = zohoVehicleId ? idMapping.vehicles[zohoVehicleId] : null;
      const supabaseCustomerId = zohoCustomerId ? idMapping.customers[zohoCustomerId] : null;

      if (zohoVehicleId && !supabaseVehicleId) {
        console.warn(`  ⚠️  RO ${zohoRO.id} references unknown vehicle ${zohoVehicleId}`);
      }
      if (zohoCustomerId && !supabaseCustomerId) {
        console.warn(`  ⚠️  RO ${zohoRO.id} references unknown customer ${zohoCustomerId}`);
      }

      // Normalize status
      const validStatuses = [
        'New', 'Scheduled', 'Dropped Off', 'Diagnosing', 
        'Waiting Approval', 'Repair Approved', 'In Progress', 
        'Ready For Pickup', 'Completed'
      ];
      const status = validStatuses.includes(zohoRO.Status) ? zohoRO.Status : 'New';

      const { data, error } = await supabase
        .from('repair_orders')
        .insert({
          zoho_id: zohoRO.id,
          vehicle_id: supabaseVehicleId || null,
          customer_id: supabaseCustomerId || null,
          status,
          service_type: zohoRO.Name || null,
          job_description: zohoRO.Job_Description || null,
          note: zohoRO.Note || null,
          estimated_total: zohoRO.Estimated_Total || null,
          final_charge_total: zohoRO.Final_Charge_Total || null,
          estimated_completion: zohoRO.Estimated_Completion || null,
          scheduled_drop_off: zohoRO.Scheduled_drop_off || null,
          created_at: zohoRO.Created_Time || new Date().toISOString(),
          updated_at: zohoRO.Modified_Time || new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        console.error(`  ❌ Failed to import repair order ${zohoRO.id}:`, error.message);
        errors++;
      } else {
        idMapping.repairOrders[zohoRO.id] = data.id;
        imported++;
        
        if (imported % 50 === 0) {
          console.log(`  Progress: ${imported}/${repairOrders.length} repair orders imported`);
        }
      }
    } catch (error: any) {
      console.error(`  ❌ Exception importing repair order ${zohoRO.id}:`, error.message);
      errors++;
    }
  }

  console.log(`✅ Imported ${imported} repair orders (${errors} errors)`);
}

async function importAttachmentMetadata(): Promise<void> {
  console.log('📥 Importing attachment metadata to Supabase...');
  
  const attachmentsJson = readFileSync(join(EXPORT_DIR, 'attachments.json'), 'utf-8');
  const attachments = JSON.parse(attachmentsJson);

  let imported = 0;
  let errors = 0;

  for (const zohoAtt of attachments) {
    try {
      // Map Zoho repair order ID to Supabase UUID
      const zohoROId = zohoAtt.repair_order_id;
      const supabaseROId = idMapping.repairOrders[zohoROId];

      if (!supabaseROId) {
        console.warn(`  ⚠️  Attachment ${zohoAtt.id} references unknown repair order ${zohoROId}`);
        continue;
      }

      // File path will be updated during actual file migration
      const filePath = `${supabaseROId}/${zohoAtt.File_Name}`;

      const { data, error } = await supabase
        .from('repair_order_attachments')
        .insert({
          zoho_id: zohoAtt.id,
          repair_order_id: supabaseROId,
          file_name: zohoAtt.File_Name,
          file_path: filePath,
          file_size: zohoAtt.Size || null,
          mime_type: zohoAtt.$file_type || null,
          created_at: zohoAtt.Created_Time || new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        console.error(`  ❌ Failed to import attachment ${zohoAtt.id}:`, error.message);
        errors++;
      } else {
        idMapping.attachments[zohoAtt.id] = data.id;
        imported++;
        
        if (imported % 50 === 0) {
          console.log(`  Progress: ${imported}/${attachments.length} attachments imported`);
        }
      }
    } catch (error: any) {
      console.error(`  ❌ Exception importing attachment ${zohoAtt.id}:`, error.message);
      errors++;
    }
  }

  console.log(`✅ Imported ${imported} attachment records (${errors} errors)`);
}

async function verifyImport(): Promise<void> {
  console.log('\n🔍 Verifying import...');

  const { data: customerCount } = await supabase
    .from('customers')
    .select('id', { count: 'exact', head: true });

  const { data: vehicleCount } = await supabase
    .from('vehicles')
    .select('id', { count: 'exact', head: true });

  const { data: repairOrderCount } = await supabase
    .from('repair_orders')
    .select('id', { count: 'exact', head: true });

  const { data: attachmentCount } = await supabase
    .from('repair_order_attachments')
    .select('id', { count: 'exact', head: true });

  console.log('\n📊 Supabase Record Counts:');
  console.log(`  Customers: ${(customerCount as any)?.count || 0}`);
  console.log(`  Vehicles: ${(vehicleCount as any)?.count || 0}`);
  console.log(`  Repair Orders: ${(repairOrderCount as any)?.count || 0}`);
  console.log(`  Attachments: ${(attachmentCount as any)?.count || 0}`);

  // Compare with export
  const exportInfo = JSON.parse(readFileSync(join(EXPORT_DIR, 'export-info.json'), 'utf-8'));
  console.log('\n📊 Zoho Export Counts:');
  console.log(`  Customers: ${exportInfo.stats.customers}`);
  console.log(`  Vehicles: ${exportInfo.stats.vehicles}`);
  console.log(`  Repair Orders: ${exportInfo.stats.repairOrders}`);
  console.log(`  Attachments: ${exportInfo.stats.attachments}`);

  const customersMatch = (customerCount as any)?.count === exportInfo.stats.customers;
  const vehiclesMatch = (vehicleCount as any)?.count === exportInfo.stats.vehicles;
  const rosMatch = (repairOrderCount as any)?.count === exportInfo.stats.repairOrders;
  const attachmentsMatch = (attachmentCount as any)?.count === exportInfo.stats.attachments;

  console.log('\n✅ Verification:');
  console.log(`  Customers: ${customersMatch ? '✅ MATCH' : '❌ MISMATCH'}`);
  console.log(`  Vehicles: ${vehiclesMatch ? '✅ MATCH' : '❌ MISMATCH'}`);
  console.log(`  Repair Orders: ${rosMatch ? '✅ MATCH' : '❌ MISMATCH'}`);
  console.log(`  Attachments: ${attachmentsMatch ? '✅ MATCH' : '❌ MISMATCH'}`);

  if (customersMatch && vehiclesMatch && rosMatch && attachmentsMatch) {
    console.log('\n🎉 All record counts match! Import successful.');
  } else {
    console.log('\n⚠️  Some record counts do not match. Review errors above.');
  }
}

async function main() {
  console.log('🚀 Starting Supabase import...\n');

  try {
    // Import in order (respecting foreign key relationships)
    await importCustomers();
    await importVehicles();
    await importRepairOrders();
    await importAttachmentMetadata();

    // Save ID mapping for reference
    writeFileSync(MAPPING_FILE, JSON.stringify(idMapping, null, 2));
    console.log(`\n💾 ID mapping saved to: ${MAPPING_FILE}`);

    // Verify import
    await verifyImport();

    console.log('\n✅ Import complete!');
    console.log('\n📝 Next steps:');
    console.log('  1. Run attachment migration script to download/upload files');
    console.log('  2. Test Supabase queries locally');
    console.log('  3. Update API endpoints to use Supabase\n');

  } catch (error: any) {
    console.error('\n❌ Import failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

main();
