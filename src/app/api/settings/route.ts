import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { ShopSettings } from '@/types';

export const GET = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('shop_settings')
      .select('key, value');

    if (error) throw error;

    // Transform array of key-value pairs into ShopSettings object
    const settings: Partial<ShopSettings> = {};
    data?.forEach((row: any) => {
      settings[row.key as keyof ShopSettings] = row.value;
    });

    return NextResponse.json({ data: settings });
  } catch (err: any) {
    console.error('[settings] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
};

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();

    // Update each setting
    const updates = Object.entries(body).map(([key, value]) => {
      return supabaseAdmin
        .from('shop_settings')
        .upsert({ key, value }, { onConflict: 'key' });
    });

    await Promise.all(updates);

    return NextResponse.json({ message: 'Settings updated' });
  } catch (err: any) {
    console.error('[settings] POST error:', err);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
};
