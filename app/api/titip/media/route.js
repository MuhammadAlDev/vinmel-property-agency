import { getSessionUser } from '@/lib/auth';
import { createMediaUploadUrl } from '@/lib/titip';
import { ok, fail, readJson } from '@/lib/http';

// POST /api/titip/media { kind: 'video'|'pano', name, type, size } (user login)
// -> { bucket, path, token } untuk unggah langsung ke bucket privat "titip-media" (uploadToSignedUrl).
// Ukuran & tipe dicek di sini dan juga oleh batas bucket di Supabase.
export async function POST(req) {
  const user = await getSessionUser();
  const r = await createMediaUploadUrl(user, (await readJson(req)) || {});
  if (r.status) return fail(r.status, r.message);
  return ok(r);
}
