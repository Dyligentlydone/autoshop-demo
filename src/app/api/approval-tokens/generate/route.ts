import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-crm';
import { randomBytes } from 'crypto';

// Generate a secure URL-safe random token (~22 chars, 128 bits of entropy)
const generateToken = (): string => {
  return randomBytes(16)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

export const POST = async (req: NextRequest) => {
  try {
    const { repairOrderId, customerId, expiryDays = 30 } = await req.json();

    if (!repairOrderId || !customerId) {
      return NextResponse.json(
        { error: 'repairOrderId and customerId are required' },
        { status: 400 }
      );
    }

    // Fetch repair order details for metadata snapshot
    const { data: repairOrder, error: roError } = await supabase
      .from('repair_orders')
      .select('*, vehicle:vehicles(*), customer:customers(*)')
      .eq('id', repairOrderId)
      .single();

    if (roError || !repairOrder) {
      return NextResponse.json(
        { error: 'Repair order not found' },
        { status: 404 }
      );
    }

    // Generate token
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    // Store token in database
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('approval_tokens')
      .insert({
        token,
        repair_order_id: repairOrderId,
        customer_id: customerId,
        expires_at: expiresAt.toISOString(),
        metadata: {
          service_type: repairOrder.service_type,
          estimated_total: repairOrder.estimated_total,
          estimated_completion: repairOrder.estimated_completion,
          customer_name: `${repairOrder.customer?.first_name || ''} ${repairOrder.customer?.last_name || ''}`.trim(),
          vehicle_info: repairOrder.vehicle ? `${repairOrder.vehicle.make || ''} ${repairOrder.vehicle.model || ''}`.trim() : null,
        },
      })
      .select()
      .single();

    if (tokenError) {
      console.error('Failed to create approval token:', tokenError);
      return NextResponse.json(
        { error: 'Failed to create approval token' },
        { status: 500 }
      );
    }

    // Generate approval URL using env var (set NEXT_PUBLIC_APP_URL in Railway)
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.NODE_ENV === 'production'
        ? 'https://localhost:3000'
        : 'http://localhost:3000');
    const approvalUrl = `${baseUrl}/approve/${token}`;

    return NextResponse.json({
      success: true,
      token: tokenRecord.token,
      approvalUrl,
      expiresAt: tokenRecord.expires_at,
    });
  } catch (err: any) {
    console.error('Generate token error:', err);
    return NextResponse.json(
      { error: 'Failed to generate approval token', details: err?.message },
      { status: 500 }
    );
  }
};
