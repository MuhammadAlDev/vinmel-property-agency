import { getTitip, titipToListingRow, copyTitipPhotos, linkTitipToListing } from '@/lib/titip';
import { createListing, updateListing } from '@/lib/listings';
import { requireOwner, ownerErrorMessage } from '@/lib/auth';
import { ok, fail } from '@/lib/http';

// POST /api/titip/:id/jadikan-listing (owner) -> draft listing dari pengajuan titip.
export async function POST(req, { params }) {
  const { id } = await params;
  const a = await requireOwner();
  if (a.error) return fail(a.error, ownerErrorMessage[a.error]);
  const t = await getTitip(id);
  if (!t) return fail(404, 'Pengajuan tidak ditemukan.');
  if (t.propertyId) return fail(409, 'Pengajuan ini sudah dibuatkan listing.', { propertyId: t.propertyId });
  try {
    let item = await createListing(titipToListingRow(t), a.user.demo ? null : a.user.id);
    const photos = await copyTitipPhotos(t, item.id);
    if (photos.length) item = await updateListing(item.id, { photos });
    await linkTitipToListing(id, item.id);
    return ok({ item }, { status: 201 });
  } catch (e) {
    console.error('[titip jadikan-listing]', e);
    return fail(500, 'Gagal membuat listing dari pengajuan.');
  }
}
