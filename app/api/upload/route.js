import crypto from 'node:crypto';
import { backendReady } from '@/lib/config';
import { requireOwner, ownerErrorMessage } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { checkPhotos } from '@/lib/titip';
import { ok, fail } from '@/lib/http';

// POST /api/upload (owner, multipart "photos") -> unggah foto listing ke bucket publik "listing".
export async function POST(req) {
  const a = await requireOwner();
  if (a.error) return fail(a.error, ownerErrorMessage[a.error]);
  if (!backendReady()) return fail(503, 'Unggah foto butuh Supabase. Di mode demo, tempel URL foto (mis. /assets/…).');
  const form = await req.formData();
  const files = form.getAll('photos').filter((f) => f && typeof f === 'object' && f.size > 0);
  if (!files.length) return fail(400, 'Pilih foto.');
  const bad = checkPhotos(files);
  if (bad) return fail(422, bad);
  const sb = await supabaseServer();
  const urls = [];
  for (const f of files) {
    const ext = (f.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from('listing').upload(path, f, { contentType: f.type });
    if (error) { console.error('[upload]', error); return fail(500, 'Gagal mengunggah ' + f.name + '.'); }
    urls.push(sb.storage.from('listing').getPublicUrl(path).data.publicUrl);
  }
  return ok({ urls });
}
