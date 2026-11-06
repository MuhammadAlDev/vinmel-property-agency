import { NextResponse } from 'next/server';
import { backendReady } from '@/lib/config';
import { supabaseServer } from '@/lib/supabase/server';
import { safeNext } from '@/lib/http';

// GET /api/auth/google?next=<url>&role=pembeli|penjual|owner -> redirect ke halaman login Google (Supabase OAuth, PKCE).
// role=penjual: setelah login akun dijadikan penjual. role tidak pernah memberi akses owner.
export async function GET(req) {
  const { origin, searchParams } = new URL(req.url);
  const next = safeNext(searchParams.get('next'), origin);
  if (!backendReady()) return NextResponse.redirect(new URL('/?login=belum-siap', origin));
  const role = searchParams.get('role') === 'penjual' ? '&role=penjual' : '';
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent(next)}${role}`, skipBrowserRedirect: true },
  });
  if (error || !data?.url) return NextResponse.redirect(new URL('/?login=gagal', origin));
  return NextResponse.redirect(data.url);
}
