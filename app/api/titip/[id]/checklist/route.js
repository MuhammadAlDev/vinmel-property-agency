import { setChecklist } from '@/lib/titip';
import { requireOwner, ownerErrorMessage } from '@/lib/auth';
import { ok, fail, readJson } from '@/lib/http';

// PUT /api/titip/:id/checklist { checks: { sert: true, ... } } (owner)
export async function PUT(req, { params }) {
  const { id } = await params;
  const a = await requireOwner();
  if (a.error) return fail(a.error, ownerErrorMessage[a.error]);
  try {
    const r = await setChecklist(id, ((await readJson(req)) || {}).checks, a.user);
    if (r.error) return fail(422, r.error);
    if (r.notFound) return fail(404, 'Pengajuan tidak ditemukan.');
    return ok({ checklist: r.checklist });
  } catch (e) {
    console.error('[titip checklist]', e);
    return fail(500, 'Gagal menyimpan checklist.');
  }
}
