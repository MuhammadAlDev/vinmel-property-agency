import { requireOwner, ownerErrorMessage } from '@/lib/auth';
import { updateListingCms } from '@/lib/cms';
import { ok, fail, readJson } from '@/lib/http';

// PATCH /api/cms/listing/:id (owner) { title?, price?, was?, status?, video?, tour? } — dari form "Edit listing" di CMS desain.
export async function PATCH(req, { params }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return fail(400, 'ID tidak valid.');
  const a = await requireOwner();
  if (a.error) return fail(a.error, ownerErrorMessage[a.error]);
  try {
    const r = await updateListingCms(Number(id), (await readJson(req)) || {});
    if (r.notFound) return fail(404, 'Listing tidak ditemukan.');
    if (r.errors) return fail(422, Object.values(r.errors)[0], { errors: r.errors });
    return ok({ item: r.item });
  } catch (e) {
    console.error('[cms listing PATCH]', e);
    return fail(500, 'Gagal menyimpan listing.');
  }
}
