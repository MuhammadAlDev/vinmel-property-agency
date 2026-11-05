import { requireOwner, ownerErrorMessage } from '@/lib/auth';
import { CONTENT_KEYS, getContent, saveContent } from '@/lib/cms';
import { ok, fail, readJson } from '@/lib/http';

export const dynamic = 'force-dynamic';

// GET /api/cms/konten (publik) -> { about, stats, testi }
export async function GET() {
  try { return ok({ content: await getContent() }); } catch (e) { console.error('[konten GET]', e); return fail(500, 'Gagal memuat konten.'); }
}

// PUT /api/cms/konten (owner; about khusus superadmin) { about?, stats?, testi? }
export async function PUT(req) {
  const a = await requireOwner();
  if (a.error) return fail(a.error, ownerErrorMessage[a.error]);
  const b = (await readJson(req)) || {};
  const keys = CONTENT_KEYS.filter((k) => k in b);
  if (!keys.length) return fail(400, 'Tidak ada konten yang dikirim.');
  // Profil owner (about) hanya boleh diubah superadmin; dicek dari tabel profiles di server.
  if (keys.includes('about') && !a.user.isSuperadmin) return fail(403, 'Hanya superadmin yang bisa mengubah profil owner.');
  try {
    const out = {};
    for (const k of keys) out[k] = await saveContent(k, b[k], a.user);
    return ok({ content: out });
  } catch (e) {
    console.error('[konten PUT]', e);
    return fail(500, 'Gagal menyimpan konten.');
  }
}
