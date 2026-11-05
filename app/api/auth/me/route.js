import { getSessionUser } from '@/lib/auth';
import { backendReady } from '@/lib/config';
import { ok } from '@/lib/http';

export const dynamic = 'force-dynamic';
// GET /api/auth/me -> { user | null, backend }
export async function GET() {
  return ok({ user: await getSessionUser(), backend: backendReady() });
}
