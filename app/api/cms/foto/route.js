import { requireOwner, requireSuperadmin, ownerErrorMessage } from '@/lib/auth';
import { uploadContentPhoto } from '@/lib/cms';
import { ok, fail } from '@/lib/http';

// POST /api/cms/foto (multipart: photo, kind=owner|testimoni) -> { url } di bucket publik "konten".
// Foto profil owner hanya oleh superadmin; foto testimoni oleh owner.
export async function POST(req) {
  let form;
  try { form = await req.formData(); } catch { return fail(400, 'Format kiriman tidak valid.'); }
  const kind = form.get('kind') === 'owner' ? 'owner' : 'testimoni';
  const a = kind === 'owner' ? await requireSuperadmin() : await requireOwner();
  if (a.error) return fail(a.error, a.superadmin ? 'Hanya superadmin yang bisa mengubah profil owner.' : ownerErrorMessage[a.error]);
  const f = form.get('photo');
  if (!f || typeof f !== 'object' || !('size' in f) || !f.size) return fail(400, 'Pilih foto dulu.');
  const r = await uploadContentPhoto(f, kind);
  if (r.status) return fail(r.status, r.message);
  return ok({ url: r.url }, { status: 201 });
}
