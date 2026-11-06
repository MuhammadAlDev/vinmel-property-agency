import { getSessionUser } from '@/lib/auth';
import { createUtj, createUtjProof, listUtj } from '@/lib/cms';
import { ok, fail, readJson } from '@/lib/http';

export const dynamic = 'force-dynamic';

// GET /api/utj (user login) -> permintaan UTJ miliknya (dengan URL bertanda bukti transfer)
export async function GET() {
  const user = await getSessionUser();
  if (!user) return fail(401, 'Silakan masuk.');
  try { return ok({ items: await listUtj({ user }) }); } catch (e) { console.error('[utj GET]', e); return fail(500, 'Gagal memuat UTJ.'); }
}

// POST /api/utj (user login)
//   JSON { propId }                          -> permintaan invoice UTJ ("Minta invoice UTJ")
//   multipart { propId, name, phone, invoiceNo?, proof } -> bukti transfer UTJ (foto/PDF maks. 5 MB), status "bukti"
export async function POST(req) {
  try {
    const user = await getSessionUser();
    if ((req.headers.get('content-type') || '').startsWith('multipart/form-data')) {
      let form;
      try { form = await req.formData(); } catch { return fail(400, 'Format kiriman tidak valid.'); }
      const b = Object.fromEntries(['propId', 'name', 'phone', 'invoiceNo'].map((k) => [k, String(form.get(k) || '')]));
      const r = await createUtjProof(b, form.get('proof'), user);
      if (r.status) return fail(r.status, r.message);
      return ok({ item: r.utj }, { status: 201 });
    }
    const r = await createUtj((await readJson(req)) || {}, user);
    if (r.status) return fail(r.status, r.message);
    return ok({ item: r.utj, existing: !!r.existing }, { status: r.existing ? 200 : 201 });
  } catch (e) {
    console.error('[utj POST]', e);
    return fail(e.status || 500, 'Permintaan UTJ belum tersimpan. Lanjutkan lewat WhatsApp.');
  }
}
