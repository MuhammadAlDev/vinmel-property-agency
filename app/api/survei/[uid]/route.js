import { requireOwner, ownerErrorMessage } from '@/lib/auth';
import { updateSurvey } from '@/lib/cms';
import { ok, fail, readJson } from '@/lib/http';

// PATCH /api/survei/:uid (owner) { status: baru|ok|selesai|batal }
export async function PATCH(req, { params }) {
  const { uid } = await params;
  const a = await requireOwner();
  if (a.error) return fail(a.error, ownerErrorMessage[a.error]);
  try {
    const r = await updateSurvey(uid, ((await readJson(req)) || {}).status);
    if (r.error) return fail(422, r.error);
    if (r.notFound) return fail(404, 'Jadwal survei tidak ditemukan.');
    return ok({ item: r.survey });
  } catch (e) {
    console.error('[survei PATCH]', e);
    return fail(500, 'Gagal menyimpan status survei.');
  }
}
