import { NextRequest, NextResponse } from 'next/server';
import { authenticateManager } from '@/lib/supabase/authenticate-manager';
import { createAdminClient } from '@/lib/supabase/admin';
import { corsHeaders } from '@/lib/cors';
import { normalizePhone, phoneToSyntheticEmail } from '@/lib/phone';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
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
  const { full_name, phone, password, role = 'customer', address, phone_verified = true } = body;

  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    return NextResponse.json({ error: 'Phone number is required' }, { status: 400, headers: corsHeaders });
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return NextResponse.json(
      { error: 'Password must be at least 6 characters' },
      { status: 400, headers: corsHeaders }
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Admin client is not configured' },
      { status: 500, headers: corsHeaders }
    );
  }

  const normalized = normalizePhone(phone);
  const syntheticEmail = phoneToSyntheticEmail(phone);

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: syntheticEmail,
    password,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: { full_name: full_name?.trim() || '', phone: normalized },
  });

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: authError?.message || 'Failed to create user account' },
      { status: 400, headers: corsHeaders }
    );
  }

  const userId = authData.user.id;

  const profilePayload = {
    id: userId,
    full_name: full_name?.trim() || '',
    phone: normalized,
    address: address?.trim() || null,
    role: ['customer', 'staff', 'manager'].includes(role) ? role : 'customer',
    phone_verified: Boolean(phone_verified),
  };

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .upsert(profilePayload)
    .select('id, full_name, phone, address, role, phone_verified, created_at')
    .single();

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message },
      { status: 500, headers: corsHeaders }
    );
  }

  return NextResponse.json({ profile }, { status: 201, headers: corsHeaders });
}
