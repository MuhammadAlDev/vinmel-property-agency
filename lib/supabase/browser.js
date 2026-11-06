'use client';
import { createClient } from '@supabase/supabase-js';

// Klien Supabase di browser, HANYA untuk unggah file lewat signed upload URL dari server
// (token sekali pakai). Tidak dipakai untuk membaca/menulis data; semua data lewat /api.
let client;
export function supabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return (client ||= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
}
