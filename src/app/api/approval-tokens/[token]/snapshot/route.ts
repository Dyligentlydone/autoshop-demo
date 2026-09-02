import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-crm';

const buildSnapshotFromDb = async (repairOrderId: string) => {
  try {
    const [{ data: repairOrder }, { data: lineItems }, { data: attachments }, { data: settingsRows }] =
      await Promise.all([
        supabase
          .from('repair_orders')
          .select('*, vehicle:vehicles(*), customer:customers(*)')
          .eq('id', repairOrderId)
          .single(),
        supabase
          .from('line_items')
          .select('*')
          .eq('repair_order_id', repairOrderId)
          .order('created_at', { ascending: true }),
        supabase
          .from('repair_order_attachments')
          .select('id, file_name, file_path, mime_type')
          .eq('repair_order_id', repairOrderId),
        supabase.from('shop_settings').select('key, value'),
      ]);

    if (!repairOrder) return null;

    const settings: Record<string, any> = {};
    (settingsRows || []).forEach((row: any) => {
      settings[row.key] = row.value;
    });

    const items = (lineItems || []).map((item: any) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity ?? 1,
      parts_price: item.parts_price ?? 0,
      labor_price: item.labor_price ?? 0,
      taxable: item.taxable !== false,
      part_number: item.part_number || null,
      condition: item.condition || null,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));

    const photos = (attachments || [])
      .filter((att: any) => {
        const mime: string = att.mime_type || '';
        return mime.startsWith('image/') || mime.startsWith('video/');
      })
      .map((att: any) => ({
        id: att.id,
        name: att.file_name,
        mime_type: att.mime_type,
        file_path: att.file_path,
      }));

    return {
      repairOrder,
      estimateItems: items,
      effectiveItems: items,
      photos,
      settings,
      metadata: {
        builtBy: 'server',
        backfilled: true,
        builtAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    console.error('Snapshot backfill build failed:', err);
    return null;
  }
};

// GET - Fetch frozen snapshot of an approved estimate (internal, always accessible)
export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) => {
  try {
    const { token } = await params;

    const { data: tokenRecord, error } = await supabase
      .from('approval_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !tokenRecord) {
      return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
    }

    if (!tokenRecord.is_used) {
      return NextResponse.json(
        { error: 'This estimate has not been approved yet' },
        { status: 404 }
      );
    }

    // Lazy backfill: if an approved token is missing its frozen snapshot (e.g.
    // because the original upload was interrupted), rebuild from current DB
    // state and persist so this record becomes viewable going forward.
    let snapshot = tokenRecord.snapshot;
    if (!snapshot && tokenRecord.repair_order_id) {
      const rebuilt = await buildSnapshotFromDb(tokenRecord.repair_order_id);
      if (rebuilt) {
        snapshot = rebuilt;
        const { error: persistErr } = await supabase
          .from('approval_tokens')
          .update({ snapshot: rebuilt })
          .eq('id', tokenRecord.id);
        if (persistErr) {
          console.error('Failed to persist backfilled snapshot:', persistErr);
        }
      }
    }

    // Generate a signed URL for the stored PDF, if any
    let pdfUrl: string | null = null;
    if (tokenRecord.pdf_storage_path) {
      const { data: signed } = await supabase.storage
        .from('approved-estimates')
        .createSignedUrl(tokenRecord.pdf_storage_path, 3600);
      pdfUrl = signed?.signedUrl || null;
    }

    return NextResponse.json({
      data: {
        snapshot,
        pdfUrl,
        usedAt: tokenRecord.used_at,
        approvedIp: tokenRecord.approved_ip,
        approvedUserAgent: tokenRecord.approved_user_agent,
      },
    });
  } catch (err: any) {
    console.error('Snapshot fetch error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch snapshot', details: err?.message },
      { status: 500 }
    );
  }
};
