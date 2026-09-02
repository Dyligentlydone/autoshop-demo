import { NextRequest, NextResponse } from 'next/server';
import { makeZohoServerRequest } from '@/lib/zoho/request-server';
import { getZohoAccessToken } from '@/lib/zoho/auth-server';
import axios from 'axios';
import { USE_SUPABASE_CRM } from '@/lib/feature-flags';
import { supabase } from '@/lib/supabase-crm';

const REPAIR_ORDERS_MODULE = 'Repair_Orders';
const ZOHO_API_URL = 'https://www.zohoapis.com/crm/v2';

// GET - List all attachments for a repair order
export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  try {
    if (USE_SUPABASE_CRM) {
      const { data, error } = await supabase
        .from('repair_order_attachments')
        .select('*')
        .eq('repair_order_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return NextResponse.json({ data: data || [] });
    } else {
      const fields = 'id,File_Name,Size,Created_Time,Created_By,$file_id';
      const response = await makeZohoServerRequest<any>({
        method: 'GET',
        endpoint: `/${REPAIR_ORDERS_MODULE}/${id}/Attachments?fields=${encodeURIComponent(fields)}`,
      });

      return NextResponse.json({ data: response.data || [] });
    }
  } catch (err: any) {
    const statusCode = err?.response?.status || 500;
    console.error('Failed to fetch attachments:', {
      status: statusCode,
      error: err?.response?.data || err?.message,
    });

    return NextResponse.json(
      {
        error: 'Failed to fetch attachments',
        details: err?.response?.data || err?.message,
      },
      { status: statusCode }
    );
  }
};

// POST - Upload a new attachment
export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type (images + videos)
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'image/heic', 'image/heif',
      'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/3gpp',
    ];

    // iOS/iPad Safari sometimes reports an empty MIME type for HEIC photos.
    // Fall back to extension-based inference so valid files aren't rejected.
    const extMimeMap: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
      mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
      m4v: 'video/x-m4v', '3gp': 'video/3gpp',
    };
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const resolvedType = file.type || extMimeMap[ext] || '';

    // Surfaces whether client-side compression ran. A camera original is
    // ~8-15MB; a compressed upload should land near 1MB.
    console.log(
      `[attachments] received "${file.name}" ` +
        `${(file.size / 1024 / 1024).toFixed(2)}MB ` +
        `type="${file.type || 'none'}" resolved="${resolvedType}"`
    );

    if (!allowedTypes.includes(resolvedType)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, HEIC, MP4, MOV, WebM.' },
        { status: 400 }
      );
    }

    // Validate file size (100MB max — generous to allow short videos)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 100MB.' },
        { status: 400 }
      );
    }

    if (USE_SUPABASE_CRM) {
      // Upload to Supabase Storage
      const fileBuffer = await file.arrayBuffer();
      // Sanitize filename: remove special chars, replace spaces with hyphens
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
      const fileName = `${id}/${Date.now()}-${safeName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('repair-order-attachments')
        .upload(fileName, fileBuffer, {
          contentType: resolvedType,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Create attachment record
      const { data: attachmentData, error: attachmentError } = await supabase
        .from('repair_order_attachments')
        .insert({
          repair_order_id: id,
          file_name: file.name,
          file_path: uploadData.path,
          file_size: file.size,
          mime_type: resolvedType,
        })
        .select()
        .single();

      if (attachmentError) throw attachmentError;

      return NextResponse.json(
        { 
          success: true,
          data: attachmentData,
        },
        { status: 201 }
      );
    } else {
      // Create FormData for Zoho API
      const zohoFormData = new FormData();
      zohoFormData.append('file', file);

      // Upload to Zoho CRM using axios directly (for multipart/form-data support)
      const token = await getZohoAccessToken();
      const uploadUrl = `${ZOHO_API_URL}/${REPAIR_ORDERS_MODULE}/${id}/Attachments`;
      
      const response = await axios.post(uploadUrl, zohoFormData, {
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          // Content-Type will be set automatically by axios for FormData
        },
      });

      return NextResponse.json(
        { 
          success: true,
          data: response.data?.[0] || response.data,
        },
        { status: 201 }
      );
    }
  } catch (err: any) {
    const statusCode = err?.response?.status || 500;
    console.error('Failed to upload attachment:', {
      status: statusCode,
      error: err?.response?.data || err?.message,
    });

    return NextResponse.json(
      {
        error: 'Failed to upload attachment',
        details: err?.response?.data || err?.message,
      },
      { status: statusCode }
    );
  }
};
