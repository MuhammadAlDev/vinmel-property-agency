import { getCities } from '@/lib/wilayah';
import { ok, fail } from '@/lib/http';

// GET /api/wilayah/kota?provinsi=31
export async function GET(req) {
  const id = new URL(req.url).searchParams.get('provinsi') || '';
  if (!/^\d{2}$/.test(id)) return fail(400, 'Parameter provinsi wajib (kode 2 digit).');
  try { return ok({ items: await getCities(id) }); } catch { return fail(502, 'API wilayah tidak bisa dihubungi.'); }
}
