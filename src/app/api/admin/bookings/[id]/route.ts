import { NextRequest, NextResponse } from 'next/server';
import { authenticateManager } from '@/lib/supabase/authenticate-manager';
import { createAdminClient } from '@/lib/supabase/admin';
import { corsHeaders } from '@/lib/cors';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let manager;
  try {
    manager = await authenticateManager(req);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Admin client is not configured' },
      { status: 500, headers: corsHeaders }
    );
  }

  if (!manager) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  const body = await req.json().catch(() => ({}));
  const { status, price, booking_date } = body;

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Admin client is not configured' },
      { status: 500, headers: corsHeaders }
    );
  }

  const updateData: Record<string, unknown> = {};
  if (status !== undefined) updateData.status = status;
  if (price !== undefined) updateData.price = price === null || price === '' ? null : Number(price);
  if (booking_date !== undefined) updateData.booking_date = booking_date;

  const { data, error } = await admin
    .from('bookings')
    .update(updateData)
    .eq('id', id)
    .select('id, pack_name_en, car_type, price, status, booking_date, created_at, user_id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400, headers: corsHeaders });
  }

  return NextResponse.json({ booking: data }, { headers: corsHeaders });
}
