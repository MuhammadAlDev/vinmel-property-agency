import { backendReady } from '@/lib/config';
import { supabaseServer } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';
import { normPhone62 } from '@/lib/format';
import { ok, fail, readJson } from '@/lib/http';

// POST /api/auth/otp/verify { phone, code, name } -> sesi login (cookie) + data user.
export async function POST(req) {
  if (!backendReady()) return fail(503, 'Backend login belum dikonfigurasi.');
  const b = await readJson(req);
  const phone = normPhone62(b?.phone);
  const code = String(b?.code || '');
  if (!phone || !/^\d{6}$/.test(code)) return fail(400, 'Nomor atau kode tidak valid.');
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.verifyOtp({ phone: '+' + phone, token: code, type: 'sms' });
  if (error || !data.user) return fail(401, 'Kode salah atau sudah kedaluwarsa.');
  const name = String(b?.name || '').trim().slice(0, 120);
  if (name) {
    const { data: prof } = await sb.from('profiles').select('full_name').eq('id', data.user.id).maybeSingle();
    if (prof && !prof.full_name) await sb.from('profiles').update({ full_name: name }).eq('id', data.user.id);
  }
  return ok({ user: await getSessionUser() });
}
