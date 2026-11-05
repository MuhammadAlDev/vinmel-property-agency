import { backendReady } from '@/lib/config';
import { supabaseServer } from '@/lib/supabase/server';
import { getSessionUser, becomeSeller } from '@/lib/auth';
import { saveRegistrasi } from '@/lib/penjual';
import { normPhone62 } from '@/lib/format';
import { ok, fail, readJson } from '@/lib/http';

// POST /api/auth/register { phone, code, name, email?, city, status, role: 'penjual' }
// Daftar akun penjual: verifikasi OTP WhatsApp (kode dicek Supabase, tidak ada kode bebas), lalu akun jadi
// penjual dan isian awal disimpan ke seller_profiles. Alamat dll. dilengkapi di halaman Data pemilik.
export async function POST(req) {
  if (!backendReady()) return fail(503, 'Backend login belum dikonfigurasi.');
  const b = await readJson(req);
  const phone = normPhone62(b?.phone);
  const code = String(b?.code || '');
  const name = String(b?.name || '').trim().slice(0, 120);
  if (!phone || !/^\d{6}$/.test(code)) return fail(400, 'Nomor atau kode tidak valid.');
  if (name.length < 3) return fail(400, 'Isi nama lengkap minimal 3 huruf.');
  if (String(b?.city || '').trim().length < 3) return fail(400, 'Isi kota domisili.');
  if (b?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(b.email).trim())) return fail(400, 'Format email belum benar.');
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.verifyOtp({ phone: '+' + phone, token: code, type: 'sms' });
  if (error || !data.user) return fail(401, 'Kode salah atau sudah kedaluwarsa.');
  const { data: prof } = await sb.from('profiles').select('full_name').eq('id', data.user.id).maybeSingle();
  if (prof && !prof.full_name) await sb.from('profiles').update({ full_name: name }).eq('id', data.user.id);
  let user = await becomeSeller(sb, await getSessionUser());
  if (user?.role !== 'owner') await saveRegistrasi(sb, data.user.id, phone, { ...b, name });
  return ok({ user });
}
