import { listPurchases, savePurchase, toDesignOwned } from '@/lib/pantau';
import { getSessionUser, requireOwner, ownerErrorMessage } from '@/lib/auth';
import { ok, fail, readJson } from '@/lib/http';

export const dynamic = 'force-dynamic';

// GET /api/pantau -> pembeli: properti miliknya (format desain). ?scope=owner -> owner: semua (format CMS).
export async function GET(req) {
  if (new URL(req.url).searchParams.get('scope') === 'owner') {
    const a = await requireOwner();
    if (a.error) return fail(a.error, ownerErrorMessage[a.error]);
    return ok({ items: await listPurchases({ owner: true }) });
  }
  const user = await getSessionUser();
  if (!user) return fail(401, 'Silakan masuk untuk memantau properti.');
  const items = await listPurchases({ user });
  return ok({ items: items.map(toDesignOwned) });
}

// POST /api/pantau (owner) -> catat pembelian baru + tahap progres
export async function POST(req) {
  const a = await requireOwner();
  if (a.error) return fail(a.error, ownerErrorMessage[a.error]);
  try {
    const r = await savePurchase(null, (await readJson(req)) || {});
    if (r.errors) return fail(422, 'Periksa kembali isian.', { errors: r.errors });
    return ok({ item: r.purchase }, { status: 201 });
  } catch (e) {
    console.error('[pantau POST]', e);
    return fail(500, 'Gagal menyimpan.');
  }
}
