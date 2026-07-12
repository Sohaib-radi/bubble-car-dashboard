import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Authenticates a request as a manager for admin API routes. Supports two
 * callers:
 *  - the web dashboard, which sends the Supabase session via cookies
 *  - the mobile app, which has no cookies and instead sends its Supabase
 *    access token as `Authorization: Bearer <token>`
 * Returns the manager's user id, or null if unauthenticated/not a manager.
 */
export async function authenticateManager(req: NextRequest): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (bearerToken) {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.getUser(bearerToken);
    if (error || !data.user) return null;

    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    return profile?.role === 'manager' ? { userId: data.user.id } : null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return profile?.role === 'manager' ? { userId: user.id } : null;
}
