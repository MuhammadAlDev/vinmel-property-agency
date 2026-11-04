import { getListing, validateListing, updateListing, deleteListing } from '@/lib/listings';
import { requireOwner, ownerErrorMessage } from '@/lib/auth';
import { ok, fail, readJson } from '@/lib/http';

export const dynamic = 'force-dynamic';
const badId = (id) => !/^\d+$/.test(id);

export async function GET(req, { params }) {
  const { id } = await params;
  if (badId(id)) return fail(400, 'ID tidak valid.');
  const item = await getListing(id);
  if (!item || (item.status !== 'tayang' && item.status !== 'terjual' && item.status !== 'tersewa')) {
    const a = item ? await requireOwner() : { error: 404 };
    if (!item || a.error) return fail(404, 'Listing tidak ditemukan.');
  }
  return ok({ item });
}

export async function PATCH(req, { params }) {
  const { id } = await params;
  if (badId(id)) return fail(400, 'ID tidak valid.');
  const a = await requireOwner();
  if (a.error) return fail(a.error, ownerErrorMessage[a.error]);
  const v = validateListing(await readJson(req), { partial: true });
  if (!v.valid) return fail(422, 'Periksa kembali isian.', { errors: v.errors });
  const cur = await getListing(id);
  if (!cur) return fail(404, 'Listing tidak ditemukan.');
  // Listing tanpa koordinat tidak boleh tayang (peta di desain membutuhkannya).
  const next = { lat: v.row.lat ?? cur.lat, lng: v.row.lng ?? cur.lng, status: v.row.status ?? cur.status };
  if (next.status === 'tayang' && (next.lat == null || next.lng == null)) return fail(422, 'Isi koordinat (lat/lng) sebelum listing ditayangkan.', { errors: { lat: 'Wajib sebelum tayang.' } });
  try {
    const item = await updateListing(id, v.row);
    return item ? ok({ item }) : fail(404, 'Listing tidak ditemukan.');
  } catch (e) {
    console.error('[properties PATCH]', e);
    return fail(500, 'Gagal menyimpan listing.');
  }
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  if (badId(id)) return fail(400, 'ID tidak valid.');
  const a = await requireOwner();
  if (a.error) return fail(a.error, ownerErrorMessage[a.error]);
  try {
    return (await deleteListing(id)) ? ok() : fail(404, 'Listing tidak ditemukan.');
  } catch (e) {
    console.error('[properties DELETE]', e);
    return fail(500, 'Gagal menghapus listing.');
  }
}
