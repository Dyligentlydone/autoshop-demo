import { NextRequest, NextResponse } from 'next/server';
import { getZohoAccessToken } from '@/lib/zoho/auth-server';
import axios from 'axios';
import { USE_SUPABASE_CRM } from '@/lib/feature-flags';
import { supabase } from '@/lib/supabase-crm';

const REPAIR_ORDERS_MODULE = 'Repair_Orders';
const ZOHO_API_URL = 'https://www.zohoapis.com/crm/v2';

// GET - Download/proxy an attachment image
export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) => {
  const { id, attachmentId } = await params;

  try {
    if (USE_SUPABASE_CRM) {
      // Get attachment metadata
      const { data: attachment } = await supabase
        .from('repair_order_attachments')
        .select('file_path, mime_type')
        .eq('id', attachmentId)
        .single();

      if (!attachment) {
        return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
      }

      // Download from Supabase Storage
      const { data: fileData, error } = await supabase.storage
        .from('repair-order-attachments')
        .download(attachment.file_path);

      if (error) throw error;

      const arrayBuffer = await fileData.arrayBuffer();
      const contentType = attachment.mime_type || 'image/jpeg';

      return new NextResponse(arrayBuffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } else {
      const token = await getZohoAccessToken();
      const downloadUrl = `${ZOHO_API_URL}/${REPAIR_ORDERS_MODULE}/${id}/Attachments/${attachmentId}`;

      const response = await axios.get(downloadUrl, {
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
        },
        responseType: 'arraybuffer',
      });

      const contentType = response.headers['content-type'] || 'image/jpeg';

      return new NextResponse(response.data, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }
  } catch (err: any) {
    const statusCode = err?.response?.status || 500;
    console.error('Failed to download attachment:', {
      status: statusCode,
      error: err?.response?.data || err?.message,
    });

    return NextResponse.json(
      {
        error: 'Failed to download attachment',
        details: err?.response?.data || err?.message,
      },
      { status: statusCode }
    );
  }
};
