import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { makeZohoServerRequest } from '@/lib/zoho/request-server';
import { LineItem } from '@/types';
import { USE_SUPABASE_CRM } from '@/lib/feature-flags';

const REPAIR_ORDERS_MODULE = 'Repair_Orders';

export const POST = async (req: NextRequest) => {
  try {
    const { repair_order_id } = await req.json();
    console.log('[sync-to-zoho] Starting sync for RO:', repair_order_id);

    if (!repair_order_id) {
      return NextResponse.json(
        { error: 'repair_order_id is required' },
        { status: 400 }
      );
    }

    // Fetch line items
    const { data: lineItems, error: lineItemsError } = await supabaseAdmin
      .from('line_items')
      .select('*')
      .eq('repair_order_id', repair_order_id);

    if (lineItemsError) {
      console.error('[sync-to-zoho] Error fetching line items:', lineItemsError);
      throw lineItemsError;
    }
    
    console.log('[sync-to-zoho] Found line items:', lineItems?.length);

    // Fetch settings for tax calculation
    const { data: settingsData, error: settingsError } = await supabaseAdmin
      .from('shop_settings')
      .select('*');

    if (settingsError) throw settingsError;

    // Parse settings
    const settings: any = {};
    settingsData?.forEach((setting: any) => {
      settings[setting.key] = setting.value;
    });

    // Calculate subtotal (quantity only applies to parts, not labor)
    const items = lineItems as LineItem[];
    const subtotal = items.reduce((sum, item) => {
      const partsPrice = item.parts_price * item.quantity;
      const laborPrice = item.labor_price;
      return sum + partsPrice + laborPrice;
    }, 0);

    // Only sum taxable items into the tax base
    const taxableSubtotal = items.reduce((sum, item) => {
      if ((item as any).taxable === false) return sum;
      const partsPrice = item.parts_price * item.quantity;
      const laborPrice = item.labor_price;
      return sum + partsPrice + laborPrice;
    }, 0);

    // Calculate tax if enabled
    const taxEnabled = settings.tax?.enabled || false;
    const taxRate = settings.tax?.rate || 0;
    const taxAmount = taxEnabled ? taxableSubtotal * (taxRate / 100) : 0;

    // Total with tax
    const estimatedTotal = subtotal + taxAmount;

    console.log('[sync-to-zoho] Calculated totals:', {
      subtotal,
      taxEnabled,
      taxRate,
      taxAmount,
      estimatedTotal,
    });

    if (USE_SUPABASE_CRM) {
      // Update Supabase repair_orders table
      const { error: updateError } = await supabaseAdmin
        .from('repair_orders')
        .update({ estimated_total: estimatedTotal })
        .eq('id', repair_order_id);

      if (updateError) {
        console.error('[sync-to-zoho] Supabase update failed:', updateError);
        return NextResponse.json(
          { error: 'Failed to update repair order', details: updateError.message },
          { status: 500 }
        );
      }

      console.log('[sync-to-zoho] Successfully updated Supabase');
    } else {
      // Update Zoho
      const payload = {
        data: [
          {
            id: repair_order_id,
            Estimated_Total: estimatedTotal,
          },
        ],
      };

      console.log('[sync-to-zoho] Sending to Zoho:', payload);

      const updated = await makeZohoServerRequest<any>({
        method: 'PUT',
        endpoint: `/${REPAIR_ORDERS_MODULE}`,
        data: payload,
      });

      console.log('[sync-to-zoho] Zoho response:', updated);

      const result = updated?.data?.[0];
      if (result?.status && result.status !== 'success') {
        console.error('[sync-to-zoho] Zoho update failed:', result);
        return NextResponse.json(
          {
            error: 'Failed to update Zoho',
            zoho: {
              code: result?.code,
              message: result?.message,
              details: result?.details,
            },
          },
          { status: 500 }
        );
      }

      console.log('[sync-to-zoho] Successfully updated Zoho');
    }

    return NextResponse.json({
      success: true,
      estimated_total: estimatedTotal,
    });
  } catch (err: any) {
    // Silent failure - just log the error
    console.error('[sync-to-zoho] ERROR:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to sync to Zoho' },
      { status: 500 }
    );
  }
};
