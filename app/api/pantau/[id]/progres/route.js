import { saveProgress, toDesignOwned } from '@/lib/pantau';
import { requireOwner, ownerErrorMessage } from '@/lib/auth';
import { ok, fail, readJson } from '@/lib/http';

// PUT /api/pantau/:id/progres (owner) { extraSteps?, stepState?, handover? }
// Tahap pembangunan tambahan, status tahap saat update terbit, dan tandai serah terima / buka kembali.
export async function PUT(req, { params }) {
  const { id } = await params;
  const a = await requireOwner();
  if (a.error) return fail(a.error, ownerErrorMessage[a.error]);
  try {
    const r = await saveProgress(id, (await readJson(req)) || {});
    if (r.notFound) return fail(404, 'Data pembeli tidak ditemukan.');
    return ok({ item: toDesignOwned(r.purchase) });
  } catch (e) {
    console.error('[pantau progres]', e);
    return fail(500, 'Progres belum tersimpan.');
  }
}
