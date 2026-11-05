// Konfigurasi backend. Tanpa env Supabase, aplikasi berjalan dalam "mode demo":
// data diambil dari data/dummy/*.json dan perubahan hanya disimpan di memori server.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const backendReady = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);
export const demoMode = () => !backendReady();
// Dashboard owner di mode demo hanya boleh dibuka saat pengembangan lokal.
export const demoOwnerAllowed = () => demoMode() && process.env.NODE_ENV !== 'production';
