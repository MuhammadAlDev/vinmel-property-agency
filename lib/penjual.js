import 'server-only';
import { backendReady, SUPABASE_SERVICE_ROLE_KEY } from './config';
import { supabaseServer, supabaseAdmin } from './supabase/server';
import { demo } from './demo-store';
import { normPhone62 } from './format';

// Data pemilik untuk akun penjual (halaman "Data pemilik" di desain, tabel seller_profiles).
const s = (v, max = 300) => String(v ?? '').trim().slice(0, max);
const TIMES = ['pagi', 'siang', 'sore', 'malam'];
const to08 = (p) => (String(p || '').startsWith('62') ? '0' + String(p).slice(2) : String(p || ''));

export function validatePemilik(b) {
  const e = {};
  if (s(b.name).length < 3) e.name = 'Isi nama lengkap sesuai KTP.';
  if (!normPhone62(b.phone)) e.phone = 'Nomor WhatsApp belum valid.';
  if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s(b.email))) e.email = 'Format email belum benar.';
  if (s(b.city).length < 3) e.city = 'Isi kota domisili.';
  if (s(b.address).length < 10) e.address = 'Isi alamat korespondensi minimal 10 huruf.';
  if (b.status === 'kuasa' && s(b.ownerName).length < 3) e.ownerName = 'Isi nama pemilik sesuai sertifikat.';
  if (b.status === 'kuasa' && s(b.relation).length < 3) e.relation = 'Isi hubungan dengan pemilik.';
  return e;
}

const toRow = (b, userId) => {
  const kuasa = b.status === 'kuasa';
  return {
    user_id: userId, full_name: s(b.name, 120), phone: normPhone62(b.phone), email: s(b.email, 160) || null,
    city: s(b.city, 80), address: s(b.address, 400), status: kuasa ? 'kuasa' : 'pemilik',
    cert_owner_name: kuasa ? s(b.ownerName, 120) : null, relation: kuasa ? s(b.relation, 80) : null,
    contact_time: TIMES.includes(b.time) ? b.time : 'siang',
  };
};

// Bentuk yang dipakai desain (state `pemilik`).
export const toDesign = (r) => r && ({
  name: r.full_name, phone: to08(r.phone), email: r.email || '', city: r.city || '', address: r.address || '',
  status: r.status, ownerName: r.cert_owner_name || '', relation: r.relation || '', time: r.contact_time,
  verified: !!r.phone_verified, complete: String(r.full_name || '').length >= 3 && String(r.address || '').length >= 10, updated: r.updated_at ? new Date(r.updated_at).toLocaleDateString('id-ID') : '',
});

export async function getPemilik(user) {
  if (!user) return null;
  if (!backendReady()) return toDesign(demo.pemilik[user.id]) || null;
  const sb = await supabaseServer();
  const { data, error } = await sb.from('seller_profiles').select('*').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  return toDesign(data);
}

// Simpan data pemilik milik user yang login (RLS: hanya baris sendiri). Mengisi data pemilik = akun menjadi penjual.
export async function savePemilik(user, b) {
  const row = toRow(b, user.id);
  if (!backendReady()) {
    demo.pemilik[user.id] = { ...(demo.pemilik[user.id] || {}), ...row, phone_verified: user.via === 'wa' && row.phone === normPhone62(user.phone), updated_at: new Date().toISOString() };
    return toDesign(demo.pemilik[user.id]);
  }
  const sb = await supabaseServer();
  const { data, error } = await sb.from('seller_profiles').upsert(row).select('*').single();
  if (error) throw error;
  // Nomor dianggap terverifikasi bila sama dengan nomor WA yang dipakai login OTP (dicek server, bukan isian user).
  const verified = user.via === 'wa' && row.phone === normPhone62(user.phone);
  if (verified !== data.phone_verified && SUPABASE_SERVICE_ROLE_KEY) {
    await supabaseAdmin().from('seller_profiles').update({ phone_verified: verified }).eq('user_id', user.id);
    data.phone_verified = verified;
  }
  return toDesign(data);
}

// Isian awal dari halaman "Daftar akun penjual" (nama/email/kota/status). Alamat dilengkapi di Data pemilik.
export async function saveRegistrasi(sb, userId, phone62, b) {
  const row = {
    user_id: userId, full_name: s(b.name, 120) || 'Penjual', phone: phone62, email: s(b.email, 160) || null,
    city: s(b.city, 80), status: 'pemilik', contact_time: 'siang',
  };
  if (b.status === 'kuasa') { row.status = 'kuasa'; row.cert_owner_name = ''; row.relation = ''; }
  const { data: ex } = await sb.from('seller_profiles').select('user_id').eq('user_id', userId).maybeSingle();
  if (ex) return;
  const { error } = await sb.from('seller_profiles').insert(row);
  if (error) console.error('[register] data pemilik awal', error);
  if (SUPABASE_SERVICE_ROLE_KEY) await supabaseAdmin().from('seller_profiles').update({ phone_verified: true }).eq('user_id', userId);
}
