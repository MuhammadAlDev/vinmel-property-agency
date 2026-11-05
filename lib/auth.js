import 'server-only';
import { backendReady, demoOwnerAllowed } from './config';
import { supabaseServer } from './supabase/server';

const DEMO_OWNER = { id: 'demo-owner', name: 'Owner (mode demo)', role: 'owner', via: 'demo', demo: true };

// User yang sedang login + profilnya, atau null.
export async function getSessionUser() {
  if (!backendReady()) return null;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: prof } = await sb.from('profiles').select('full_name, phone, email, role').eq('id', user.id).maybeSingle();
  const provider = user.app_metadata?.provider;
  return {
    id: user.id,
    name: prof?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || 'Pengguna',
    phone: prof?.phone || user.phone || '',
    email: prof?.email || user.email || '',
    role: prof?.role || 'buyer',
    via: provider === 'google' ? 'google' : 'wa',
  };
}

// Untuk route/halaman owner. Mengembalikan { user } atau { error: status }.
export async function requireOwner() {
  if (!backendReady()) return demoOwnerAllowed() ? { user: DEMO_OWNER } : { error: 503 };
  const user = await getSessionUser();
  if (!user) return { error: 401 };
  if (user.role !== 'owner') return { error: 403 };
  return { user };
}

export const ownerErrorMessage = {
  401: 'Silakan masuk sebagai owner.',
  403: 'Akun ini bukan akun owner.',
  503: 'Backend (Supabase) belum dikonfigurasi.',
};
