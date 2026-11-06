import { validateTitip, checkPhotos, createTitip, listTitip } from '@/lib/titip';
import { getSessionUser, requireOwner, ownerErrorMessage } from '@/lib/auth';
import { ok, fail } from '@/lib/http';
import { backendReady } from '@/lib/config';

export const dynamic = 'force-dynamic';

// POST /api/titip (multipart/form-data): field "data" = JSON isian formulir, field "photos" = file foto (min. 3).
export async function POST(req) {
  if (!backendReady() && process.env.NODE_ENV === 'production') return fail(503, 'Backend belum dikonfigurasi.');
  let form;
  try { form = await req.formData(); } catch { return fail(400, 'Format kiriman tidak valid.'); }
  let tp;
  try { tp = JSON.parse(String(form.get('data') || '{}')); } catch { return fail(400, 'Data formulir tidak valid.'); }
  const errors = validateTitip(tp);
  if (Object.keys(errors).length) return fail(422, 'Periksa kembali isian.', { errors });
  const files = form.getAll('photos').filter((f) => f && typeof f === 'object' && 'size' in f && f.size > 0);
  if (files.length < 3) return fail(422, 'Unggah minimal 3 foto properti.', { errors: { photos: 'Minimal 3 foto.' } });
  const bad = checkPhotos(files);
  if (bad) return fail(422, bad, { errors: { photos: bad } });
  try {
    const user = await getSessionUser();
    const { ref } = await createTitip(tp, files, user);
    return ok({ ref }, { status: 201 });
  } catch (e) {
    console.error('[titip POST]', e);
    return fail(e.status || 500, 'Pengajuan belum terkirim. Coba lagi atau hubungi kami lewat WhatsApp.');
  }
}

// GET /api/titip -> owner: semua pengajuan; user login: pengajuan miliknya.
export async function GET(req) {
  const scope = new URL(req.url).searchParams.get('scope');
  if (scope === 'owner') {
    const a = await requireOwner();
    if (a.error) return fail(a.error, ownerErrorMessage[a.error]);
    return ok({ items: await listTitip({ owner: true }) });
  }
  const user = await getSessionUser();
  if (!user) return fail(401, 'Silakan masuk.');
  return ok({ items: await listTitip({ user }) });
}
