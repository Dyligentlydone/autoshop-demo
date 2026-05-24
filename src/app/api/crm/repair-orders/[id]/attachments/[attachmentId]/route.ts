import { NextRequest, NextResponse } from 'next/server';
import { makeZohoServerRequest } from '@/lib/zoho/request-server';
import { USE_SUPABASE_CRM } from '@/lib/feature-flags';
import { supabase } from '@/lib/supabase-crm';

const REPAIR_ORDERS_MODULE = 'Repair_Orders';

// DELETE - Remove an attachment
export const DELETE = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) => {
  const { id, attachmentId } = await params;

  try {
    if (USE_SUPABASE_CRM) {
      // Get attachment to find file path
      const { data: attachment } = await supabase
        .from('repair_order_attachments')
        .select('file_path')
        .eq('id', attachmentId)
        .single();

      if (attachment?.file_path) {
        // Delete from storage
        await supabase.storage
          .from('repair-order-attachments')
          .remove([attachment.file_path]);
      }

      // Delete record
      const { error } = await supabase
        .from('repair_order_attachments')
        .delete()
        .eq('id', attachmentId);

      if (error) throw error;
      return NextResponse.json({ success: true });
    } else {
      await makeZohoServerRequest<any>({
        method: 'DELETE',
        endpoint: `/${REPAIR_ORDERS_MODULE}/${id}/Attachments/${attachmentId}`,
      });

      return NextResponse.json({ success: true });
    }
  } catch (err: any) {
    const statusCode = err?.response?.status || 500;
    console.error('Failed to delete attachment:', {
      status: statusCode,
      error: err?.response?.data || err?.message,
    });

    return NextResponse.json(
      {
        error: 'Failed to delete attachment',
        details: err?.response?.data || err?.message,
      },
      { status: statusCode }
    );
  }
};
