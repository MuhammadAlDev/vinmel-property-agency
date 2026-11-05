import { getSessionUser } from '@/lib/auth';
import { createUtj } from '@/lib/cms';
import { ok, fail, readJson } from '@/lib/http';

export const dynamic = 'force-dynamic';

// POST /api/utj { propId } (user login) -> permintaan invoice UTJ dari tombol "Bayar UTJ"
export async function POST(req) {
  try {
    const user = await getSessionUser();
    const r = await createUtj((await readJson(req)) || {}, user);
    if (r.status) return fail(r.status, r.message);
    return ok({ item: r.utj, existing: !!r.existing }, { status: r.existing ? 200 : 201 });
  } catch (e) {
    console.error('[utj POST]', e);
    return fail(e.status || 500, 'Permintaan UTJ belum tersimpan. Lanjutkan lewat WhatsApp.');
  }
}
