import { savePurchase, deletePurchase } from '@/lib/pantau';
import { requireOwner, ownerErrorMessage } from '@/lib/auth';
import { ok, fail, readJson } from '@/lib/http';

// PATCH /api/pantau/:id (owner) -> perbarui data pembelian, progres, tahap pembangunan & legalitas
export async function PATCH(req, { params }) {
  const { id } = await params;
  const a = await requireOwner();
  if (a.error) return fail(a.error, ownerErrorMessage[a.error]);
  try {
    const r = await savePurchase(id, (await readJson(req)) || {});
    if (r.errors) return fail(422, 'Periksa kembali isian.', { errors: r.errors });
    return ok({ item: r.purchase });
  } catch (e) {
    console.error('[pantau PATCH]', e);
    return fail(500, 'Gagal menyimpan.');
  }
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  const a = await requireOwner();
  if (a.error) return fail(a.error, ownerErrorMessage[a.error]);
  return (await deletePurchase(id)) ? ok() : fail(404, 'Data tidak ditemukan.');
}
