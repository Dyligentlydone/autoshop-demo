import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const PATCH = async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;

  try {
    const body = await req.json();

    const { data, error } = await supabaseAdmin
      .from('appointments')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[appointments] PATCH error:', error);
      return NextResponse.json({ error: 'Failed to update appointment' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('[appointments] PATCH exception:', err);
    return NextResponse.json({ error: 'Failed to update appointment' }, { status: 500 });
  }
};

export const DELETE = async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;

  try {
    const { error } = await supabaseAdmin.from('appointments').delete().eq('id', id);

    if (error) {
      console.error('[appointments] DELETE error:', error);
      return NextResponse.json({ error: 'Failed to delete appointment' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[appointments] DELETE exception:', err);
    return NextResponse.json({ error: 'Failed to delete appointment' }, { status: 500 });
  }
};
