import { listListings, parseFilters, validateListing, createListing } from '@/lib/listings';
import { requireOwner, ownerErrorMessage } from '@/lib/auth';
import { ok, fail, readJson } from '@/lib/http';

export const dynamic = 'force-dynamic';

// GET /api/properties?type=&deal=&city=&q=&pmin=&pmax=&featured=1  (publik: hanya yang tayang)
// GET /api/properties?scope=owner&status=draft  (owner: semua status)
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  let owner = false;
  if (sp.get('scope') === 'owner') {
    const a = await requireOwner();
    if (a.error) return fail(a.error, ownerErrorMessage[a.error]);
    owner = true;
  }
  try {
    const items = await listListings(parseFilters(sp, { owner }));
    return ok({ items, count: items.length });
  } catch (e) {
    console.error('[properties GET]', e);
    return fail(500, 'Gagal memuat listing.');
  }
}

// POST /api/properties (owner) -> buat listing baru
export async function POST(req) {
  const a = await requireOwner();
  if (a.error) return fail(a.error, ownerErrorMessage[a.error]);
  const v = validateListing(await readJson(req));
  if (!v.valid) return fail(422, 'Periksa kembali isian.', { errors: v.errors });
  try {
    return ok({ item: await createListing(v.row, a.user.id === 'demo-owner' ? null : a.user.id) }, { status: 201 });
  } catch (e) {
    console.error('[properties POST]', e);
    return fail(500, e.code === '23505' ? 'Listing dengan judul & lokasi yang sama sudah ada.' : 'Gagal menyimpan listing.');
  }
}
