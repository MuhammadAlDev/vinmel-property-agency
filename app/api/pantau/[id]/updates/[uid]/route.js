import { requireOwner, ownerErrorMessage } from '@/lib/auth';
import { deleteUpdate } from '@/lib/cms';
import { ok, fail } from '@/lib/http';

// DELETE /api/pantau/:id/updates/:uid (owner) -> hapus update + fotonya
export async function DELETE(req, { params }) {
  const { id, uid } = await params;
  const a = await requireOwner();
  if (a.error) return fail(a.error, ownerErrorMessage[a.error]);
  try {
    return (await deleteUpdate(id, uid)) ? ok() : fail(404, 'Update tidak ditemukan.');
  } catch (e) {
    console.error('[pantau update DELETE]', e);
    return fail(500, 'Gagal menghapus update.');
  }
}
