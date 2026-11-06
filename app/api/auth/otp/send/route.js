import { backendReady } from '@/lib/config';
import { supabaseServer } from '@/lib/supabase/server';
import { normPhone62 } from '@/lib/format';
import { getSessionUser } from '@/lib/auth';
import { ok, fail, readJson } from '@/lib/http';

// POST /api/auth/otp/send { phone, role? } -> kirim OTP lewat WhatsApp (Supabase Auth, channel whatsapp).
// Daftar penjual dari akun yang SUDAH login dengan nomor lain (mis. akun Google): nomor ditautkan ke akun itu
// lewat updateUser({ phone }) (OTP phone_change), jadi tidak terbentuk akun kedua.
export async function POST(req) {
  if (!backendReady()) return fail(503, 'Backend login belum dikonfigurasi.');
  const b = await readJson(req);
  const phone = normPhone62(b?.phone);
  if (!phone) return fail(400, 'Nomor WhatsApp belum valid.');
  const sb = await supabaseServer();
  const me = b?.role === 'penjual' ? await getSessionUser() : null;
  const link = !!(me && me.role !== 'owner' && me.phone !== phone);
  const { error } = link
    ? await sb.auth.updateUser({ phone: '+' + phone })
    : await sb.auth.signInWithOtp({ phone: '+' + phone, options: { channel: 'whatsapp' } });
  if (error) {
    console.error('[otp/send]', error.status, error.message);
    return fail(error.status === 429 ? 429 : 502, error.status === 429 ? 'Terlalu sering. Coba lagi sebentar lagi.' : 'Kode belum terkirim. Coba lagi.');
  }
  return ok({ mode: link ? 'link' : 'login' });
}
