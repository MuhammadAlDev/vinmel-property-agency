import { backendReady } from '@/lib/config';
import { supabaseServer } from '@/lib/supabase/server';
import { getSessionUser, becomeSeller } from '@/lib/auth';
import { normPhone62 } from '@/lib/format';
import { getPemilik } from '@/lib/penjual';
import { ok, fail, readJson } from '@/lib/http';

// POST /api/auth/otp/verify { phone, code, name, role? } -> sesi login (cookie) + data user.
// role 'penjual' menjadikan akun pembeli sebagai penjual. Peran owner hanya dari database (owner_allowlist/profiles).
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
  let user = await getSessionUser();
  if (b?.role === 'penjual') user = await becomeSeller(sb, user);
  // Penjual: sertakan data pemilik (hanya bila lengkap) supaya desain langsung membuka halaman yang tepat.
  if (user?.role === 'seller') { const p = await getPemilik(user).catch(() => null); user = { ...user, pemilik: p && p.complete ? p : null }; }
  return ok({ user });
}
