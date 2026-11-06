import { getSessionUser } from '@/lib/auth';
import { getPemilik, savePemilik, validatePemilik } from '@/lib/penjual';
import { ok, fail, readJson } from '@/lib/http';

export const dynamic = 'force-dynamic';

// GET /api/penjual/profil -> data pemilik milik user yang login (atau null)
export async function GET() {
  const user = await getSessionUser();
  if (!user) return fail(401, 'Silakan masuk.');
  try { return ok({ pemilik: await getPemilik(user) }); } catch (e) { console.error('[pemilik GET]', e); return fail(500, 'Gagal memuat data pemilik.'); }
}

// PUT /api/penjual/profil { name, phone, email, city, address, status, ownerName, relation, time }
export async function PUT(req) {
  const user = await getSessionUser();
  if (!user) return fail(401, 'Silakan masuk.');
  if (user.role === 'owner') return fail(403, 'Akun owner tidak perlu data pemilik.');
  const b = (await readJson(req)) || {};
  const errors = validatePemilik(b);
  if (Object.keys(errors).length) return fail(422, 'Masih ada isian yang perlu dilengkapi.', { errors });
  try { return ok({ pemilik: await savePemilik(user, b) }); } catch (e) { console.error('[pemilik PUT]', e); return fail(500, 'Data pemilik belum tersimpan.'); }
}
