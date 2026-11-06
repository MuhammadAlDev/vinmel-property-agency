import { redirect } from 'next/navigation';

// CMS owner kini memakai desain Amel (halaman utama, #owner). Alat lama (tambah listing lengkap, foto, koordinat,
// tahap & legalitas pembeli) tetap ada di /owner/lanjutan.
export default function OwnerPage() {
  redirect('/#owner');
}
