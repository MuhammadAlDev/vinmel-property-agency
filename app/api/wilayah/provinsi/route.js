import { getProvinces } from '@/lib/wilayah';
import { ok, fail } from '@/lib/http';

export const revalidate = 86400;
export async function GET() {
  try { return ok({ items: await getProvinces() }); } catch { return fail(502, 'API wilayah tidak bisa dihubungi.'); }
}
