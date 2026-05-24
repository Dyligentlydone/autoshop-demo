import { NextRequest, NextResponse } from 'next/server';
import { auditLog, getRequestId, jsonError, requireAgentKey, zohoUpdateRepairOrder } from '../../_shared';
import { clearCache } from '../../../crm/repair-orders/cache';
import { USE_SUPABASE_CRM } from '@/lib/feature-flags';
import { supabaseUpdateRepairOrder } from '@/lib/supabase-crm';

export const POST = async (req: NextRequest) => {
  const requestId = getRequestId(req);
  const auth = requireAgentKey(req);
  if (!auth.ok) {
    auditLog({ requestId, action: 'repair_orders.update', success: false, status: 401, error: 'unauthorized' });
    return auth.response;
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    auditLog({ requestId, action: 'repair_orders.update', success: false, status: 400, error: 'invalid_json' });
    return jsonError(400, 'Invalid JSON');
  }

  const id = typeof body?.id === 'string' ? body.id.trim() : '';
  const status = typeof body?.status === 'string' ? body.status.trim() : undefined;
  const serviceType = typeof body?.serviceType === 'string' ? body.serviceType.trim() : undefined;
  const jobDescription = typeof body?.jobDescription === 'string' ? body.jobDescription.trim() : undefined;
  const notes = typeof body?.notes === 'string' ? body.notes : undefined;

  if (!id) {
    auditLog({ requestId, action: 'repair_orders.update', success: false, status: 400, error: 'missing_id' });
    return jsonError(400, 'id is required');
  }

  if (status === undefined && serviceType === undefined && jobDescription === undefined && notes === undefined) {
    auditLog({ requestId, action: 'repair_orders.update', success: false, status: 400, error: 'no_updates' });
    return jsonError(400, 'At least one field to update is required', {
      updatable: ['status', 'serviceType', 'jobDescription', 'notes'],
    });
  }

  try {
    let updated;

    if (USE_SUPABASE_CRM) {
      updated = await supabaseUpdateRepairOrder({
        id,
        ...(status ? { status: status as any } : {}),
        ...(serviceType ? { service_type: serviceType } : {}),
        ...(jobDescription !== undefined ? { job_description: jobDescription } : {}),
        ...(notes !== undefined ? { notes } : {}),
      });
    } else {
      updated = await zohoUpdateRepairOrder({
        id,
        ...(status ? { status } : {}),
        ...(serviceType ? { service_type: serviceType } : {}),
        ...(jobDescription !== undefined ? { job_description: jobDescription } : {}),
        ...(notes !== undefined ? { notes } : {}),
      });
    }

    // Clear server-side cache so updates appear immediately
    clearCache();

    auditLog({ requestId, action: 'repair_orders.update', success: true, status: 200, repairOrderId: id });

    return NextResponse.json({ data: updated, requestId });
  } catch (err: any) {
    auditLog({ requestId, action: 'repair_orders.update', success: false, status: 500, repairOrderId: id, error: USE_SUPABASE_CRM ? 'supabase_error' : 'zoho_error' });
    return jsonError(500, 'Failed to update repair order');
  }
};
