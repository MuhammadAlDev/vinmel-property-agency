import { requireOwner, ownerErrorMessage } from '@/lib/auth';
import { createUpdate } from '@/lib/cms';
import { ok, fail } from '@/lib/http';

// POST /api/pantau/:id/updates (owner, multipart: step, pct, note, photos[]) -> terbit di halaman pembeli.
// Foto disimpan di bucket privat "progres"; pembeli melihatnya lewat signed URL.
export async function POST(req, { params }) {
  const { id } = await params;
  const a = await requireOwner();
  if (a.error) return fail(a.error, ownerErrorMessage[a.error]);
  let form;
  try { form = await req.formData(); } catch { return fail(400, 'Format kiriman tidak valid.'); }
  const files = form.getAll('photos').filter((f) => f && typeof f === 'object' && 'size' in f && f.size > 0);
  try {
    const r = await createUpdate(id, { step: form.get('step'), pct: form.get('pct'), note: form.get('note') }, files, a.user);
    if (r.status) return fail(r.status, r.message);
    return ok({ item: r.update, progress: r.progress }, { status: 201 });
  } catch (e) {
    console.error('[pantau update POST]', e);
    return fail(500, 'Update belum terbit. Coba lagi.');
  }
}
