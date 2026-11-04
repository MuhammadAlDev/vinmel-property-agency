import { backendReady } from '@/lib/config';
import { supabaseServer } from '@/lib/supabase/server';
import { ok } from '@/lib/http';

export async function POST() {
  if (backendReady()) { const sb = await supabaseServer(); await sb.auth.signOut(); }
  return ok();
}
