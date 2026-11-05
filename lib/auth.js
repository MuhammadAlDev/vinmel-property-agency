import 'server-only';
import { backendReady, demoOwnerAllowed } from './config';
import { supabaseServer } from './supabase/server';

const DEMO_OWNER = { id: 'demo-owner', name: 'Owner (mode demo)', phone: '6283182311993', email: 'alfiyandzulfikri@gmail.com', role: 'owner', isSuperadmin: true, via: 'google', demo: true };

// User yang sedang login + profilnya, atau null.
const DEMO_BUYER = { id: 'demo-buyer', name: 'Pembeli Demo', phone: '081234567890', email: '', role: 'buyer', isSuperadmin: false, via: 'wa', demo: true };
const DEMO_SELLER = { id: 'demo-seller', name: 'Penjual Demo', phone: '6281100000002', email: '', role: 'seller', isSuperadmin: false, via: 'wa', demo: true };
const DEMO = { owner: DEMO_OWNER, buyer: DEMO_BUYER, seller: DEMO_SELLER };

// Mode demo lokal saja: VINMEL_DEMO_AS=owner|buyer|seller menyimulasikan sesi login agar alur CMS/pembeli bisa dicoba
// tanpa Supabase. Tidak berlaku di production (demoOwnerAllowed() = false).
export const demoSessionAs = () => (demoOwnerAllowed() && ['owner', 'buyer', 'seller'].includes(process.env.VINMEL_DEMO_AS) ? process.env.VINMEL_DEMO_AS : '');

export async function getSessionUser() {
  if (!backendReady()) return DEMO[demoSessionAs()] || null;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: prof } = await sb.from('profiles').select('full_name, phone, email, role, is_superadmin').eq('id', user.id).maybeSingle();
  const provider = user.app_metadata?.provider;
  return {
    id: user.id,
    name: prof?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || 'Pengguna',
    phone: prof?.phone || user.phone || '',
    email: prof?.email || user.email || '',
    // Peran & superadmin selalu dari tabel profiles (server), bukan dari daftar email/nomor di browser.
    role: prof?.role || 'buyer',
    isSuperadmin: !!(prof?.role === 'owner' && prof?.is_superadmin),
    via: provider === 'google' ? 'google' : provider === 'email' ? 'email' : 'wa',
  };
}

// Untuk route/halaman owner. Mengembalikan { user } atau { error: status }.
export async function requireOwner() {
  if (!backendReady()) {
    if (!demoOwnerAllowed()) return { error: 503 };
    const as = demoSessionAs();
    return !as || as === 'owner' ? { user: DEMO_OWNER } : { error: 403 };
  }
  const user = await getSessionUser();
  if (!user) return { error: 401 };
  if (user.role !== 'owner') return { error: 403 };
  return { user };
}

// Khusus superadmin (owner utama), mis. profil owner di situs.
export async function requireSuperadmin() {
  const a = await requireOwner();
  if (a.error) return a;
  if (!a.user.isSuperadmin) return { error: 403, superadmin: true };
  return a;
}

// Naikkan akun pembeli menjadi penjual (dipakai saat login/daftar sebagai penjual). Owner tidak diubah.
export async function becomeSeller(sb, user) {
  if (!user || user.role !== 'buyer') return user;
  const { error } = await sb.from('profiles').update({ role: 'seller' }).eq('id', user.id);
  if (error) { console.error('[auth] gagal menjadikan penjual', error); return user; }
  return { ...user, role: 'seller' };
}

export const ownerErrorMessage = {
  401: 'Silakan masuk sebagai owner.',
  403: 'Akun ini bukan akun owner.',
  503: 'Backend (Supabase) belum dikonfigurasi.',
};
