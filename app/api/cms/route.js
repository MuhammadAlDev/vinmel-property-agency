import { requireOwner, ownerErrorMessage } from '@/lib/auth';
import { getContent, listSurveys, listUtj, listUpdates } from '@/lib/cms';
import { listListings } from '@/lib/listings';
import { listTitip } from '@/lib/titip';
import { listPurchases, toDesignOwned } from '@/lib/pantau';
import { ok, fail } from '@/lib/http';

export const dynamic = 'force-dynamic';

// GET /api/cms (owner) -> semua data CMS dalam bentuk state desain:
// { cms: {about, stats, testi, svSt, utj, updates, progress}, listings, titip, surveys, owned }
export async function GET() {
  const a = await requireOwner();
  if (a.error) return fail(a.error, ownerErrorMessage[a.error]);
  try {
    const [content, listings, titip, surveys, utj, purchases] = await Promise.all([
      getContent(), listListings({}), listTitip({ owner: true }), listSurveys({ owner: true }), listUtj(), listPurchases({ owner: true }),
    ]);
    const owned = purchases.map(toDesignOwned);
    const updates = await listUpdates(owned.map((o) => o.key));
    const svSt = Object.fromEntries(surveys.map((r) => [r.uid, r.status]));
    const progress = Object.fromEntries(owned.map((o) => [o.key, o.progress]));
    return ok({ cms: { ...content, svSt, utj, updates, progress }, listings, titip, surveys, owned });
  } catch (e) {
    console.error('[cms GET]', e);
    return fail(500, 'Gagal memuat data CMS.');
  }
}
