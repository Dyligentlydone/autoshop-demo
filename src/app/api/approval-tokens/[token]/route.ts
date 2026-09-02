import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-crm';

const buildServerSnapshot = async (repairOrderId: string) => {
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
        builtAt: new Date().toISOString(),
      },
    };
  } catch (snapshotErr) {
    console.error('Failed to build server snapshot:', snapshotErr);
    return null;
  }
};

// GET - Fetch approval token details (for displaying estimate to customer)
export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) => {
  try {
    const { token } = await params;

    const { data: tokenRecord, error } = await supabase
      .from('approval_tokens')
      .select(`
        *,
        repair_order:repair_orders(*,
          vehicle:vehicles(*),
          customer:customers(*)
        )
      `)
      .eq('token', token)
      .single();

    if (error || !tokenRecord) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 404 }
      );
    }

    // Check if token is expired
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This approval link has expired' },
        { status: 410 }
      );
    }

    // Note: do NOT 410 on is_used — we want to keep the page viewable
    // (with an "Approved" overlay) until expiry, for the customer's records.

    // Fetch line items for this repair order
    const { data: lineItems, error: lineItemsError } = await supabase
      .from('line_items')
      .select('*')
      .eq('repair_order_id', tokenRecord.repair_order.id)
      .order('created_at', { ascending: true });

    if (lineItemsError) {
      console.error('Failed to fetch line items:', lineItemsError);
    }

    // Fetch attachments (photos) for this repair order
    const { data: attachments } = await supabase
      .from('repair_order_attachments')
      .select('id, file_name, file_path, mime_type')
      .eq('repair_order_id', tokenRecord.repair_order.id);

    // Generate signed URLs for photos AND videos (1 hour expiry)
    const photos: Array<{
      id: string;
      url: string;
      name: string;
      mime_type: string;
    }> = [];
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        const mime: string = att.mime_type || '';
        if (mime.startsWith('image/') || mime.startsWith('video/')) {
          const { data: signed } = await supabase.storage
            .from('repair-order-attachments')
            .createSignedUrl(att.file_path, 3600);
          if (signed?.signedUrl) {
            photos.push({
              id: att.id,
              url: signed.signedUrl,
              name: att.file_name,
              mime_type: mime,
            });
          }
        }
      }
    }

    // Track page view (don't fail the request if this errors)
    try {
      const updates: Record<string, any> = {
        view_count: (tokenRecord.view_count || 0) + 1,
      };
      if (!tokenRecord.first_viewed_at) {
        updates.first_viewed_at = new Date().toISOString();
      }
      await supabase.from('approval_tokens').update(updates).eq('id', tokenRecord.id);
    } catch (viewErr) {
      console.error('Failed to track view:', viewErr);
    }

    // Fetch shop settings (tax + company info) so the PDF/page can show correct totals
    const { data: settingsRows } = await supabase
      .from('shop_settings')
      .select('key, value');
    const settings: Record<string, any> = {};
    (settingsRows || []).forEach((row: any) => {
      settings[row.key] = row.value;
    });

    return NextResponse.json({
      success: true,
      data: {
        repairOrder: tokenRecord.repair_order,
        estimateItems: lineItems || [],
        photos,
        settings,
        metadata: tokenRecord.metadata,
        expiresAt: tokenRecord.expires_at,
        isUsed: !!tokenRecord.is_used,
        usedAt: tokenRecord.used_at,
      },
    });
  } catch (err: any) {
    console.error('Get token error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch approval details', details: err?.message },
      { status: 500 }
    );
  }
};

// POST - Approve the estimate
export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) => {
  try {
    const { token } = await params;

    // Fetch token
    const { data: tokenRecord, error: fetchError } = await supabase
      .from('approval_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (fetchError || !tokenRecord) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 404 }
      );
    }

    // Check if token is expired
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This approval link has expired' },
        { status: 410 }
      );
    }

    // Idempotent: if already approved, succeed instead of erroring so retries
    // (e.g. after a flaky mobile connection) don't surface a fake error to the customer.
    if (tokenRecord.is_used) {
      return NextResponse.json({
        success: true,
        alreadyApproved: true,
        message: 'Estimate already approved',
        approvedAt: tokenRecord.used_at,
        repairOrderId: tokenRecord.repair_order_id,
      });
    }

    // Capture audit info from request
    const userAgent = req.headers.get('user-agent') || '';
    const forwardedFor = req.headers.get('x-forwarded-for') || '';
    const realIp = req.headers.get('x-real-ip') || '';
    const ip = forwardedFor.split(',')[0]?.trim() || realIp || 'unknown';

    // Optionally accept FormData with a client-built snapshot JSON + PDF file.
    // These are treated as best-effort extras; if upload fails we still approve
    // and persist a server-built snapshot so the approval record is never empty.
    let clientSnapshot: any = null;
    let pdfStoragePath: string | null = null;

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      try {
        const form = await req.formData();
        const snapshotStr = form.get('snapshot');
        if (typeof snapshotStr === 'string' && snapshotStr.length > 0) {
          try {
            clientSnapshot = JSON.parse(snapshotStr);
          } catch {
            console.error('Invalid snapshot JSON');
          }
        }

        const pdfFile = form.get('pdf');
        if (pdfFile && typeof pdfFile === 'object' && 'arrayBuffer' in pdfFile) {
          const buffer = Buffer.from(await (pdfFile as Blob).arrayBuffer());
          const path = `${tokenRecord.repair_order_id}/${tokenRecord.token}.pdf`;
          const { error: uploadErr } = await supabase.storage
            .from('approved-estimates')
            .upload(path, buffer, { contentType: 'application/pdf', upsert: true });
          if (uploadErr) {
            console.error('Failed to upload approved estimate PDF:', uploadErr);
          } else {
            pdfStoragePath = path;
          }
        }
      } catch (formErr) {
        console.error('Failed to parse approval form data:', formErr);
      }
    }

    // Always attempt to build a snapshot server-side from current DB state so
    // the approval record survives client upload failures (e.g. ECONNRESET on mobile).
    const serverSnapshot = await buildServerSnapshot(tokenRecord.repair_order_id);
    const snapshot = clientSnapshot || serverSnapshot;
    const snapshotSource = clientSnapshot ? 'client' : serverSnapshot ? 'server' : 'none';

    // Mark token as used (with audit info + snapshot)
    const baseUpdate = {
      is_used: true,
      used_at: new Date().toISOString(),
      approved_ip: ip,
      approved_user_agent: userAgent,
    };
    const fullUpdate = {
      ...baseUpdate,
      ...(snapshot ? { snapshot } : {}),
      ...(pdfStoragePath ? { pdf_storage_path: pdfStoragePath } : {}),
    };

    let { error: updateTokenError } = await supabase
      .from('approval_tokens')
      .update(fullUpdate)
      .eq('id', tokenRecord.id);

    // If snapshot/pdf columns don't exist yet (migration not run), retry without them
    if (
      updateTokenError &&
      (updateTokenError.code === 'PGRST204' ||
        /snapshot|pdf_storage_path/.test(updateTokenError.message || ''))
    ) {
      console.warn(
        'Snapshot columns missing — retrying approval without snapshot. Run the SQL migration to enable snapshots.'
      );
      const retry = await supabase
        .from('approval_tokens')
        .update(baseUpdate)
        .eq('id', tokenRecord.id);
      updateTokenError = retry.error;
    }

    if (updateTokenError) {
      console.error('Failed to mark token as used:', updateTokenError);
      return NextResponse.json(
        { error: 'Failed to process approval' },
        { status: 500 }
      );
    }

    // Update repair order status to "Repair Approved"
    const { error: updateStatusError } = await supabase
      .from('repair_orders')
      .update({
        status: 'Repair Approved',
      })
      .eq('id', tokenRecord.repair_order_id);

    if (updateStatusError) {
      console.error('Failed to update repair order status:', updateStatusError);
      return NextResponse.json(
        { error: 'Failed to update repair order status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Estimate approved successfully',
      repairOrderId: tokenRecord.repair_order_id,
      snapshotSource,
      pdfStored: Boolean(pdfStoragePath),
    });
  } catch (err: any) {
    console.error('Approve estimate error:', err);
    return NextResponse.json(
      { error: 'Failed to approve estimate', details: err?.message },
      { status: 500 }
    );
  }
};
