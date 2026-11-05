import { updateTitip } from '@/lib/titip';
import { requireOwner, ownerErrorMessage } from '@/lib/auth';
import { ok, fail, readJson } from '@/lib/http';

// PATCH /api/titip/:id { stage, reviewNote } (owner)
export async function PATCH(req, { params }) {
  const { id } = await params;
  const a = await requireOwner();
  if (a.error) return fail(a.error, ownerErrorMessage[a.error]);
  try {
    const r = await updateTitip(id, (await readJson(req)) || {});
    if (r.error) return fail(422, r.error);
    if (r.notFound) return fail(404, 'Pengajuan tidak ditemukan.');
    return ok({ item: r.titip });
  } catch (e) {
    console.error('[titip PATCH]', e);
    return fail(500, 'Gagal menyimpan.');
  }
}
