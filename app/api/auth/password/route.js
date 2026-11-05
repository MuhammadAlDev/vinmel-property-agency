import { backendReady } from '@/lib/config';
import { supabaseServer } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';
import { ok, fail, readJson } from '@/lib/http';

// POST /api/auth/password { email, password } -> sesi login (cookie) + data user.
// Untuk akun owner/superadmin dan akun testing yang dibuat lewat scripts/create-accounts.mjs.
export async function POST(req) {
  if (!backendReady()) return fail(503, 'Backend login belum dikonfigurasi.');
  const b = await readJson(req);
  const email = String(b?.email || '').trim().toLowerCase().slice(0, 160);
  const password = String(b?.password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6 || password.length > 128) return fail(400, 'Email atau password tidak valid.');
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.user) return fail(401, 'Email atau password salah.');
  return ok({ user: await getSessionUser() });
}
