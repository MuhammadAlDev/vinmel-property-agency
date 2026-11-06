import { getSessionUser } from '@/lib/auth';
import { createSurvey, listSurveys } from '@/lib/cms';
import { backendReady } from '@/lib/config';
import { ok, fail, readJson } from '@/lib/http';

export const dynamic = 'force-dynamic';

// POST /api/survei { uid, propId, title, name, phone, note, date (YYYY-MM-DD), slot, dateLabel, slotLabel }
// Boleh tanpa login (tamu); bila login, survei tertaut ke akunnya.
export async function POST(req) {
  if (!backendReady() && process.env.NODE_ENV === 'production') return fail(503, 'Backend belum dikonfigurasi.');
  try {
    const user = await getSessionUser();
    const r = await createSurvey((await readJson(req)) || {}, user);
    if (r.errors) return fail(422, Object.values(r.errors)[0], { errors: r.errors });
    return ok({ item: r.survey }, { status: 201 });
  } catch (e) {
    console.error('[survei POST]', e);
    return fail(e.status || 500, 'Jadwal survei belum tersimpan. Konfirmasi tetap bisa lewat WhatsApp.');
  }
}

// GET /api/survei -> survei milik user yang login
export async function GET() {
  const user = await getSessionUser();
  if (!user) return fail(401, 'Silakan masuk.');
  try { return ok({ items: await listSurveys({ user }) }); } catch (e) { console.error('[survei GET]', e); return fail(500, 'Gagal memuat survei.'); }
}
