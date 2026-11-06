import { NextResponse } from 'next/server';
import { safeNext } from '@/lib/http';

// GET /api/auth/whatsapp?role=owner&next=<url>
// Login WhatsApp memakai OTP (bukan redirect OAuth), jadi route ini hanya mengembalikan user ke halaman asal
// dengan ?masuk=wa supaya desain langsung membuka formulir OTP. Peran owner ditentukan server lewat owner_allowlist.
export async function GET(req) {
  const { origin, searchParams } = new URL(req.url);
  const u = new URL(safeNext(searchParams.get('next'), origin), origin);
  u.searchParams.set('masuk', 'wa');
  if (searchParams.get('role') === 'owner' && !u.hash) u.hash = 'owner';
  return NextResponse.redirect(u);
}
