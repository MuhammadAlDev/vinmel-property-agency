import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { safeNext } from '@/lib/http';

// GET /api/auth/callback?code=...&next=... (redirect dari Google via Supabase)
export async function GET(req) {
  const { origin, searchParams } = new URL(req.url);
  const next = safeNext(searchParams.get('next'), origin);
  const code = searchParams.get('code');
  if (code) {
    const sb = await supabaseServer();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL('/?login=gagal', origin));
}
