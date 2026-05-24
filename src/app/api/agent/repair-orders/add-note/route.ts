import { NextRequest, NextResponse } from 'next/server';
import {
  auditLog,
  getRequestId,
  jsonError,
  requireAgentKey,
  zohoGetRepairOrderRaw,
  zohoUpdateRepairOrder,
} from '../../_shared';
import { clearCache } from '../../../crm/repair-orders/cache';
import { USE_SUPABASE_CRM } from '@/lib/feature-flags';
import { supabaseGetRepairOrder, supabaseUpdateRepairOrder } from '@/lib/supabase-crm';

const appendLine = (existing: string, addition: string) => {
  const a = addition.trim();
  if (!a) return existing;
  const e = (existing || '').trim();
  if (!e) return a;
  return `${e}\n${a}`;
};

export const POST = async (req: NextRequest) => {
  const requestId = getRequestId(req);
  const auth = requireAgentKey(req);
  if (!auth.ok) {
    auditLog({ requestId, action: 'repair_orders.add_note', success: false, status: 401, error: 'unauthorized' });
    return auth.response;
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    auditLog({ requestId, action: 'repair_orders.add_note', success: false, status: 400, error: 'invalid_json' });
    return jsonError(400, 'Invalid JSON');
  }

  const id = typeof body?.id === 'string' ? body.id.trim() : '';
  const note = typeof body?.note === 'string' ? body.note : '';

  if (!id) {
    auditLog({ requestId, action: 'repair_orders.add_note', success: false, status: 400, error: 'missing_id' });
    return jsonError(400, 'id is required');
  }

  if (!note.trim()) {
    auditLog({ requestId, action: 'repair_orders.add_note', success: false, status: 400, error: 'missing_note' });
    return jsonError(400, 'note is required');
  }

  try {
    let updated;

    if (USE_SUPABASE_CRM) {
      const existing = await supabaseGetRepairOrder(id);
      if (!existing) {
        auditLog({ requestId, action: 'repair_orders.add_note', success: false, status: 404, repairOrderId: id, error: 'not_found' });
        return jsonError(404, 'Repair order not found');
      }

      const existingNote = existing.notes || '';
      const existingJD = existing.job_description || '';

      const nextNote = appendLine(existingNote, note);

      const shouldMirrorJD = existingJD.trim() === existingNote.trim();
      const nextJD = shouldMirrorJD ? appendLine(existingJD, note) : undefined;

      updated = await supabaseUpdateRepairOrder({
        id,
        notes: nextNote,
        ...(nextJD !== undefined ? { job_description: nextJD } : {}),
      });
    } else {
      const raw = await zohoGetRepairOrderRaw(id);
      if (!raw) {
        auditLog({ requestId, action: 'repair_orders.add_note', success: false, status: 404, repairOrderId: id, error: 'not_found' });
        return jsonError(404, 'Repair order not found');
      }

      const existingNote = typeof raw?.Note === 'string' ? raw.Note : '';
      const existingJD = typeof raw?.Job_Description === 'string' ? raw.Job_Description : '';

      const nextNote = appendLine(existingNote, note);

      const shouldMirrorJD = existingJD.trim() === existingNote.trim();
      const nextJD = shouldMirrorJD ? appendLine(existingJD, note) : undefined;

      updated = await zohoUpdateRepairOrder({
        id,
        note: nextNote,
        ...(nextJD !== undefined ? { job_description: nextJD } : {}),
      });
    }

    // Clear server-side cache so note updates appear immediately
    clearCache();

    auditLog({ requestId, action: 'repair_orders.add_note', success: true, status: 200, repairOrderId: id });

    return NextResponse.json({ data: updated, requestId });
  } catch (err: any) {
    auditLog({ requestId, action: 'repair_orders.add_note', success: false, status: 500, repairOrderId: id, error: USE_SUPABASE_CRM ? 'supabase_error' : 'zoho_error' });
    return jsonError(500, 'Failed to add note');
  }
};
