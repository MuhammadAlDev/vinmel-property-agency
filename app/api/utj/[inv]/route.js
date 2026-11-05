import { requireOwner, ownerErrorMessage } from '@/lib/auth';
import { updateUtj } from '@/lib/cms';
import { ok, fail, readJson } from '@/lib/http';

// PATCH /api/utj/:inv (owner) { status: baru|invoice|bukti|ok|batal }. Status "ok" -> listing jadi Booked.
export async function PATCH(req, { params }) {
  const { inv } = await params;
  const a = await requireOwner();
  if (a.error) return fail(a.error, ownerErrorMessage[a.error]);
  try {
    const r = await updateUtj(inv, ((await readJson(req)) || {}).status);
    if (r.error) return fail(422, r.error);
    if (r.notFound) return fail(404, 'Permintaan UTJ tidak ditemukan.');
    return ok({ item: r.utj });
  } catch (e) {
    console.error('[utj PATCH]', e);
    return fail(500, 'Gagal menyimpan status UTJ.');
  }
}
