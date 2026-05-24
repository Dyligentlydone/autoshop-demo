#!/usr/bin/env tsx

/**
 * Download attachments from Zoho and upload to Supabase Storage
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { makeZohoServerRequest } from '../src/lib/zoho/request-server';
import axios from 'axios';

const EXPORT_DIR = join(process.cwd(), 'zoho-export');
const ATTACHMENTS_DIR = join(EXPORT_DIR, 'attachments-files');
const MAPPING_FILE = join(EXPORT_DIR, 'id-mapping.json');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface IdMapping {
  customers: Record<string, string>;
  vehicles: Record<string, string>;
  repairOrders: Record<string, string>;
  attachments: Record<string, string>;
}

async function downloadAttachment(zohoAttachment: any, roId: string): Promise<Buffer | null> {
  try {
    const response: any = await makeZohoServerRequest({
      method: 'GET',
      endpoint: `/Repair_Orders/${roId}/Attachments/${zohoAttachment.id}`,
    });

    if (response.data && response.data.length > 0) {
      const downloadUrl = response.data[0].$download_url;
      
      if (downloadUrl) {
        const fileResponse = await axios.get(downloadUrl, {
          responseType: 'arraybuffer',
          headers: {
            'Authorization': `Zoho-oauthtoken ${process.env.ZOHO_ACCESS_TOKEN}`,
          },
        });
        
        return Buffer.from(fileResponse.data);
      }
    }
    
    return null;
  } catch (error: any) {
    console.error(`  ❌ Failed to download attachment ${zohoAttachment.id}:`, error.message);
    return null;
  }
}

async function uploadToSupabase(
  fileBuffer: Buffer,
  fileName: string,
  supabaseROId: string,
  mimeType: string
): Promise<string | null> {
  try {
    const filePath = `${supabaseROId}/${fileName}`;
    
    const { data, error } = await supabase.storage
      .from('repair-order-attachments')
      .upload(filePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      console.error(`  ❌ Failed to upload to Supabase:`, error.message);
      return null;
    }

    return data.path;
  } catch (error: any) {
    console.error(`  ❌ Exception uploading to Supabase:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Starting attachment migration...\n');

  // Create directory for downloaded files
  mkdirSync(ATTACHMENTS_DIR, { recursive: true });

  // Load ID mapping
  const idMapping: IdMapping = JSON.parse(readFileSync(MAPPING_FILE, 'utf-8'));

  // Load attachment metadata
  const attachmentsJson = readFileSync(join(EXPORT_DIR, 'attachments.json'), 'utf-8');
  const attachments = JSON.parse(attachmentsJson);

  console.log(`📥 Found ${attachments.length} attachments to migrate\n`);

  let migrated = 0;
  let errors = 0;
  let skipped = 0;

  for (const zohoAtt of attachments) {
    const zohoROId = zohoAtt.repair_order_id;
    const supabaseROId = idMapping.repairOrders[zohoROId];

    if (!supabaseROId) {
      console.warn(`  ⚠️  Skipping attachment ${zohoAtt.id} - repair order not found`);
      skipped++;
      continue;
    }

    console.log(`📎 Processing: ${zohoAtt.File_Name} (RO: ${zohoROId})`);

    // Download from Zoho
    const fileBuffer = await downloadAttachment(zohoAtt, zohoROId);
    
    if (!fileBuffer) {
      errors++;
      continue;
    }

    // Upload to Supabase Storage
    const uploadedPath = await uploadToSupabase(
      fileBuffer,
      zohoAtt.File_Name,
      supabaseROId,
      zohoAtt.$file_type || 'application/octet-stream'
    );

    if (!uploadedPath) {
      errors++;
      continue;
    }

    // Update attachment record with actual file path
    const supabaseAttId = idMapping.attachments[zohoAtt.id];
    if (supabaseAttId) {
      const { error } = await supabase
        .from('repair_order_attachments')
        .update({ file_path: uploadedPath })
        .eq('id', supabaseAttId);

      if (error) {
        console.error(`  ❌ Failed to update attachment record:`, error.message);
        errors++;
      } else {
        migrated++;
        console.log(`  ✅ Migrated successfully`);
      }
    } else {
      console.warn(`  ⚠️  Attachment record not found in mapping`);
      skipped++;
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n📊 Migration Summary:');
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total: ${attachments.length}`);

  if (migrated === attachments.length) {
    console.log('\n🎉 All attachments migrated successfully!');
  } else {
    console.log('\n⚠️  Some attachments failed to migrate. Review errors above.');
  }
}

main();
