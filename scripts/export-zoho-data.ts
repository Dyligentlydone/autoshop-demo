#!/usr/bin/env tsx

/**
 * Export all data from Zoho CRM to JSON files
 * This creates a complete backup before migration
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { makeZohoServerRequest } from '../src/lib/zoho/request-server';

const EXPORT_DIR = join(process.cwd(), 'zoho-export');

interface ExportStats {
  customers: number;
  vehicles: number;
  repairOrders: number;
  attachments: number;
}

async function exportCustomers(): Promise<any[]> {
  console.log('📥 Exporting customers from Zoho...');
  
  const allCustomers: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response: any = await makeZohoServerRequest({
      method: 'GET',
      endpoint: `/Contacts?page=${page}&per_page=200&fields=id,First_Name,Last_Name,Phone,Email,Preferred_Contact_Method,Description,Created_Time,Modified_Time`,
    });

    const customers = response.data || [];
    allCustomers.push(...customers);

    console.log(`  Page ${page}: ${customers.length} customers`);

    hasMore = response.info?.more_records || false;
    page++;

    // Rate limiting - wait 1 second between requests
    if (hasMore) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`✅ Exported ${allCustomers.length} customers`);
  return allCustomers;
}

async function exportVehicles(): Promise<any[]> {
  console.log('📥 Exporting vehicles from Zoho...');
  
  const allVehicles: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response: any = await makeZohoServerRequest({
      method: 'GET',
      endpoint: `/Vehicles?page=${page}&per_page=200&fields=id,Name,Make,Model,Vin,License_Plate,Engine_Size,Owner1,Color,Note,Created_Time,Modified_Time`,
    });

    const vehicles = response.data || [];
    allVehicles.push(...vehicles);

    console.log(`  Page ${page}: ${vehicles.length} vehicles`);

    hasMore = response.info?.more_records || false;
    page++;

    if (hasMore) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`✅ Exported ${allVehicles.length} vehicles`);
  return allVehicles;
}

async function exportRepairOrders(): Promise<any[]> {
  console.log('📥 Exporting repair orders from Zoho...');
  
  const allRepairOrders: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response: any = await makeZohoServerRequest({
      method: 'GET',
      endpoint: `/Repair_Orders?page=${page}&per_page=200&fields=id,Name,Status,Job_Description,Note,Estimated_Total,Final_Charge_Total,Estimated_Completion,Scheduled_drop_off,Vehicle,Customer,Created_Time,Modified_Time`,
    });

    const repairOrders = response.data || [];
    allRepairOrders.push(...repairOrders);

    console.log(`  Page ${page}: ${repairOrders.length} repair orders`);

    hasMore = response.info?.more_records || false;
    page++;

    if (hasMore) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`✅ Exported ${allRepairOrders.length} repair orders`);
  return allRepairOrders;
}

async function exportAttachments(repairOrders: any[]): Promise<any[]> {
  console.log('📥 Exporting attachment metadata from Zoho...');
  
  const allAttachments: any[] = [];
  let processed = 0;

  for (const ro of repairOrders) {
    try {
      const response: any = await makeZohoServerRequest({
        method: 'GET',
        endpoint: `/Repair_Orders/${ro.id}/Attachments`,
      });

      const attachments = response.data || [];
      
      // Add repair order ID to each attachment for reference
      attachments.forEach((att: any) => {
        allAttachments.push({
          ...att,
          repair_order_id: ro.id,
        });
      });

      if (attachments.length > 0) {
        console.log(`  RO ${ro.id}: ${attachments.length} attachments`);
      }

      processed++;
      if (processed % 10 === 0) {
        console.log(`  Progress: ${processed}/${repairOrders.length} repair orders checked`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      // Some repair orders might not have attachments endpoint
      if (error?.response?.status !== 404) {
        console.warn(`  Warning: Failed to get attachments for RO ${ro.id}:`, error.message);
      }
    }
  }

  console.log(`✅ Exported ${allAttachments.length} attachment records`);
  return allAttachments;
}

async function main() {
  console.log('🚀 Starting Zoho data export...\n');

  // Create export directory
  mkdirSync(EXPORT_DIR, { recursive: true });

  const stats: ExportStats = {
    customers: 0,
    vehicles: 0,
    repairOrders: 0,
    attachments: 0,
  };

  try {
    // Export customers
    const customers = await exportCustomers();
    stats.customers = customers.length;
    writeFileSync(
      join(EXPORT_DIR, 'customers.json'),
      JSON.stringify(customers, null, 2)
    );

    // Export vehicles
    const vehicles = await exportVehicles();
    stats.vehicles = vehicles.length;
    writeFileSync(
      join(EXPORT_DIR, 'vehicles.json'),
      JSON.stringify(vehicles, null, 2)
    );

    // Export repair orders
    const repairOrders = await exportRepairOrders();
    stats.repairOrders = repairOrders.length;
    writeFileSync(
      join(EXPORT_DIR, 'repair-orders.json'),
      JSON.stringify(repairOrders, null, 2)
    );

    // Export attachment metadata
    const attachments = await exportAttachments(repairOrders);
    stats.attachments = attachments.length;
    writeFileSync(
      join(EXPORT_DIR, 'attachments.json'),
      JSON.stringify(attachments, null, 2)
    );

    // Save export stats
    const exportInfo = {
      exportedAt: new Date().toISOString(),
      stats,
      files: {
        customers: join(EXPORT_DIR, 'customers.json'),
        vehicles: join(EXPORT_DIR, 'vehicles.json'),
        repairOrders: join(EXPORT_DIR, 'repair-orders.json'),
        attachments: join(EXPORT_DIR, 'attachments.json'),
      },
    };

    writeFileSync(
      join(EXPORT_DIR, 'export-info.json'),
      JSON.stringify(exportInfo, null, 2)
    );

    console.log('\n✅ Export complete!\n');
    console.log('📊 Export Summary:');
    console.log(`  Customers: ${stats.customers}`);
    console.log(`  Vehicles: ${stats.vehicles}`);
    console.log(`  Repair Orders: ${stats.repairOrders}`);
    console.log(`  Attachments: ${stats.attachments}`);
    console.log(`\n📁 Files saved to: ${EXPORT_DIR}`);
    console.log('\n⚠️  IMPORTANT: Keep these files as backup!');
    console.log('   Do not delete until migration is verified successful.\n');

  } catch (error: any) {
    console.error('\n❌ Export failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

main();
