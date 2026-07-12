import { NextRequest, NextResponse } from 'next/server';
import { authenticateManager } from '@/lib/supabase/authenticate-manager';
import { createAdminClient } from '@/lib/supabase/admin';
import { corsHeaders } from '@/lib/cors';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  if (id === manager.userId) {
    return NextResponse.json(
      { error: 'Cannot delete your own account' },
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

  const { error } = await admin.auth.admin.deleteUser(id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }

  return NextResponse.json({ ok: true }, { headers: corsHeaders });
}
