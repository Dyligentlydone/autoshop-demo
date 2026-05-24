import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/estimates/:id/complete
 *
 * Completes an estimate and links it to a repair order.
 * Body:
 *   repair_order_id?: string  - existing RO to link to
 *   create_repair_order?: {   - or create a new one
 *     customer_id: string
 *     vehicle_id: string
 *     service_type?: string
 *     job_description?: string
 *     scheduled_drop_off?: string
 *     estimated_completion?: string
 *   }
 *   order_parts?: boolean - if true, mark parts as 'to_order'
 */
export const POST = async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await ctx.params;
    const body = await req.json();

    // 1. Fetch the estimate and its items
    const { data: estimate, error: estError } = await supabaseAdmin
      .from('estimates')
      .select('*, estimate_items(*)')
      .eq('id', id)
      .single();

    if (estError || !estimate) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
    }

    if (estimate.status !== 'draft') {
      return NextResponse.json({ error: 'Estimate is already completed' }, { status: 400 });
    }

    let repairOrderId = body.repair_order_id;

    // 2. Create a new repair order if requested
    if (!repairOrderId && body.create_repair_order) {
      const roData = body.create_repair_order;

      if (!roData.customer_id || !roData.vehicle_id) {
        return NextResponse.json(
          { error: 'customer_id and vehicle_id are required to create a repair order' },
          { status: 400 }
        );
      }

      // Build service type from estimate items if not provided
      const serviceType = roData.service_type ||
        (estimate.estimate_items || [])
          .map((item: any) => item.description)
          .slice(0, 3)
          .join(', ');

      const { data: newRO, error: roError } = await supabaseAdmin
        .from('repair_orders')
        .insert({
          customer_id: roData.customer_id,
          vehicle_id: roData.vehicle_id,
          status: 'New',
          service_type: serviceType,
          job_description: roData.job_description || null,
          estimated_total: estimate.total || 0,
          scheduled_drop_off: roData.scheduled_drop_off || null,
          estimated_completion: roData.estimated_completion || null,
        })
        .select()
        .single();

      if (roError) {
        console.error('[estimate/complete] RO create error:', roError);
        return NextResponse.json({ error: 'Failed to create repair order' }, { status: 500 });
      }

      repairOrderId = newRO.id;
    }

    if (!repairOrderId) {
      return NextResponse.json(
        { error: 'Either repair_order_id or create_repair_order is required' },
        { status: 400 }
      );
    }

    // 3. Sync estimate items to line_items for the repair order
    const items = estimate.estimate_items || [];
    if (items.length > 0) {
      const lineItems = items.map((item: any) => ({
        repair_order_id: repairOrderId,
        description: item.description,
        quantity: item.quantity || 1,
        parts_cost: item.parts_cost || 0,
        parts_price: item.parts_price || 0,
        labor_hours: item.labor_hours || 0,
        labor_rate: item.labor_rate || 0,
        labor_cost: item.labor_cost || 0,
        labor_price: item.labor_price || 0,
        part_number: item.part_number || null,
        supplier: item.supplier || null,
        source: item.source || 'manual',
        condition: item.condition || null,
        order_status: body.order_parts ? 'to_order' : (item.order_status || 'not_ordered'),
        category: item.category || null,
        notes: item.notes || null,
        taxable: item.taxable !== false,
        estimate_id: id,
      }));

      const { error: lineError } = await supabaseAdmin
        .from('line_items')
        .insert(lineItems);

      if (lineError) {
        console.error('[estimate/complete] line_items sync error:', lineError);
        // Non-fatal — estimate still links to RO
      }
    }

    // 4. If order_parts, mark estimate items as 'to_order'
    if (body.order_parts && items.length > 0) {
      const partItemIds = items
        .filter((item: any) => item.parts_price > 0 || item.part_number)
        .map((item: any) => item.id);

      if (partItemIds.length > 0) {
        await supabaseAdmin
          .from('estimate_items')
          .update({ order_status: 'to_order' })
          .in('id', partItemIds);
      }
    }

    // 5. Update estimate status and link to RO
    const newStatus = body.order_parts ? 'ordered' : 'completed';
    const { data: updatedEstimate, error: updateError } = await supabaseAdmin
      .from('estimates')
      .update({
        status: newStatus,
        repair_order_id: repairOrderId,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[estimate/complete] update error:', updateError);
    }

    // 6. Update RO estimated_total
    // Only ADD to the total when linking to an EXISTING RO (it already has a total).
    // For a NEW RO, the total was already set at creation (step 2), so skip.
    if (body.repair_order_id) {
      const { data: existingRO } = await supabaseAdmin
        .from('repair_orders')
        .select('estimated_total')
        .eq('id', repairOrderId)
        .single();

      const currentTotal = parseFloat(existingRO?.estimated_total) || 0;
      const estimateTotal = parseFloat(estimate.total) || 0;

      await supabaseAdmin
        .from('repair_orders')
        .update({ estimated_total: currentTotal + estimateTotal })
        .eq('id', repairOrderId);
    }

    return NextResponse.json({
      data: {
        estimate: updatedEstimate,
        repair_order_id: repairOrderId,
        items_synced: items.length,
        parts_to_order: body.order_parts
          ? items.filter((i: any) => i.parts_price > 0 || i.part_number).length
          : 0,
      },
    });
  } catch (err: any) {
    console.error('[estimate/complete] error:', err);
    return NextResponse.json({ error: 'Failed to complete estimate' }, { status: 500 });
  }
};
