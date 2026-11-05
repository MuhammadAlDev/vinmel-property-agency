// Buat / perbarui akun awal Vinmel di Supabase (aman dijalankan berulang):
//   1. superadmin owner   (role owner + is_superadmin, juga dimasukkan ke owner_allowlist)
//   2. pembeli testing    (role buyer, ditautkan ke contoh pembelian 00000000-0000-4000-8000-000000000001)
//   3. penjual testing    (role seller, punya 1 contoh pengajuan titip)
//
// Jalankan SETELAH migrasi + seed:
//   OWNER_PASSWORD='...' npm run db:accounts
//
// Env yang dibaca (JANGAN ditulis ke file yang di-commit):
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (wajib)
//   OWNER_PASSWORD                                         (wajib)
//   OWNER_EMAIL                                            (opsional; default alfiyandzulfikri@gmail.com)
//   OWNER_NAME, OWNER_PHONE                                (opsional)
//   TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD                  (opsional; default alfiyandzulfikri+test1@gmail.com, password diacak bila kosong)
//   TEST_SELLER_EMAIL, TEST_SELLER_PASSWORD                (opsional; default alfiyandzulfikri+test2@gmail.com, password diacak bila kosong)
// Password yang diacak hanya dicetak sekali di terminal.
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const env = process.env;
const need = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OWNER_PASSWORD'].filter((k) => !env[k]);
if (need.length) { console.error('Env belum diisi: ' + need.join(', ')); process.exit(1); }

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const randPass = () => crypto.randomBytes(9).toString('base64url') + 'a1!';
const fail = (what, error) => { console.error(what + ': ' + (error?.message || error)); process.exit(1); };

const ACCOUNTS = [
  { key: 'owner', email: env.OWNER_EMAIL || 'alfiyandzulfikri@gmail.com', password: env.OWNER_PASSWORD, name: env.OWNER_NAME || 'Owner Vinmel', phone: env.OWNER_PHONE || null, role: 'owner', superadmin: true },
  { key: 'buyer', email: env.TEST_BUYER_EMAIL || 'alfiyandzulfikri+test1@gmail.com', password: env.TEST_BUYER_PASSWORD, name: 'Pembeli Testing', phone: '6281100000001', role: 'buyer' },
  { key: 'seller', email: env.TEST_SELLER_EMAIL || 'alfiyandzulfikri+test2@gmail.com', password: env.TEST_SELLER_PASSWORD, name: 'Penjual Testing', phone: '6281100000002', role: 'seller' },
];

async function findUser(email) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail('listUsers', error);
    const u = data.users.find((x) => (x.email || '').toLowerCase() === email.toLowerCase());
    if (u || data.users.length < 200) return u || null;
  }
  return null;
}

async function upsertAccount(a) {
  const generated = !a.password;
  const password = a.password || randPass();
  const attrs = { email: a.email.toLowerCase(), password, email_confirm: true, user_metadata: { full_name: a.name } };
  let user = await findUser(a.email);
  if (user) {
    const { data, error } = await sb.auth.admin.updateUserById(user.id, attrs);
    if (error) fail('update ' + a.email, error);
    user = data.user;
  } else {
    const { data, error } = await sb.auth.admin.createUser(attrs);
    if (error) fail('create ' + a.email, error);
    user = data.user;
  }
  // Profil dibuat trigger handle_new_user; pastikan peran & data benar (service role melewati proteksi peran).
  const { error: pe } = await sb.from('profiles').upsert({
    id: user.id, full_name: a.name, email: a.email.toLowerCase(), phone: a.phone, role: a.role, is_superadmin: !!a.superadmin,
  });
  if (pe) fail('profil ' + a.email, pe);
  return { ...a, id: user.id, password, generated };
}

const out = {};
for (const a of ACCOUNTS) out[a.key] = await upsertAccount(a);

// Owner masuk allowlist agar login Google/WA dengan email/nomor yang sama juga menjadi owner.
{
  const { data: ex } = await sb.from('owner_allowlist').select('id').ilike('email', out.owner.email).maybeSingle();
  if (!ex) {
    const { error } = await sb.from('owner_allowlist').insert({ email: out.owner.email.toLowerCase(), phone: out.owner.phone, note: 'superadmin owner' });
    if (error) fail('owner_allowlist', error);
  }
}

// Pembeli testing: tautkan contoh pembelian pertama dari seed (bila ada).
{
  const { error } = await sb.from('purchases')
    .update({ buyer_id: out.buyer.id, buyer_phone: out.buyer.phone, buyer_email: out.buyer.email })
    .eq('id', '00000000-0000-4000-8000-000000000001');
  if (error) console.warn('Peringatan: contoh pembelian tidak tertaut (' + error.message + ')');
}

// Penjual testing: 1 contoh pengajuan titip (ref tetap, jadi tidak dobel).
{
  const ref = 'VMA-TP-TESTING-0001';
  const { data: ex } = await sb.from('titip_submissions').select('id').eq('ref', ref).maybeSingle();
  const row = {
    ref, user_id: out.seller.id, owner_name: out.seller.name, owner_phone: out.seller.phone, owner_email: out.seller.email,
    submitter_role: 'pemilik', type: 'rumah', deal: 'Dijual', title: 'Rumah Testing Titip (contoh)', address: 'Jl. Contoh No. 1',
    city: 'Depok', price_num: 950000000, plan: 'open', payload: { note: 'Data testing, boleh dihapus.' }, stage: 0,
  };
  const { error } = ex ? await sb.from('titip_submissions').update(row).eq('id', ex.id) : await sb.from('titip_submissions').insert(row);
  if (error) console.warn('Peringatan: contoh titip gagal dibuat (' + error.message + ')');
}

console.log('\nAkun siap (simpan password di password manager, jangan di repo):');
for (const a of Object.values(out)) {
  console.log(`- ${a.key.padEnd(6)} ${a.email}  role=${a.role}${a.superadmin ? ' (superadmin)' : ''}  password=${a.generated ? a.password + '  [diacak]' : '(dari env)'}`);
}
