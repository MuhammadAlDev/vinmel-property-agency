import { backendReady } from '@/lib/config';
import { supabaseServer } from '@/lib/supabase/server';
import { normPhone62 } from '@/lib/format';
import { ok, fail, readJson } from '@/lib/http';

// POST /api/auth/otp/send { phone } -> kirim OTP lewat WhatsApp (Supabase Auth, channel whatsapp).
export async function POST(req) {
  if (!backendReady()) return fail(503, 'Backend login belum dikonfigurasi.');
  const b = await readJson(req);
  const phone = normPhone62(b?.phone);
  if (!phone) return fail(400, 'Nomor WhatsApp belum valid.');
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithOtp({ phone: '+' + phone, options: { channel: 'whatsapp' } });
  if (error) {
    console.error('[otp/send]', error.status, error.message);
    return fail(error.status === 429 ? 429 : 502, error.status === 429 ? 'Terlalu sering. Coba lagi sebentar lagi.' : 'Kode belum terkirim. Coba lagi.');
  }
  return ok();
}
