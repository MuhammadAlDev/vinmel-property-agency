import { reviewTitip } from '@/lib/titip';
import { requireOwner, ownerErrorMessage } from '@/lib/auth';
import { ok, fail, readJson } from '@/lib/http';

// POST /api/titip/:id/review { stage, action, note } (owner) -> ubah tahap + catat riwayat review.
export async function POST(req, { params }) {
  const { id } = await params;
  const a = await requireOwner();
  if (a.error) return fail(a.error, ownerErrorMessage[a.error]);
  try {
    const r = await reviewTitip(id, (await readJson(req)) || {}, a.user);
    if (r.error) return fail(422, r.error);
    if (r.notFound) return fail(404, 'Pengajuan tidak ditemukan.');
    return ok({ item: r.titip });
  } catch (e) {
    console.error('[titip review]', e);
    return fail(500, 'Gagal menyimpan review.');
  }
}
