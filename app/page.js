import VinmelApp from '../components/VinmelApp';
import { listListings } from '@/lib/listings';
import { getCityGroups } from '@/lib/wilayah';
import { backendReady } from '@/lib/config';
import dummy from '../data/dummy/listings.json';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let listings;
  try {
    listings = await listListings({ status: 'tayang' });
  } catch (e) {
    console.error('[home] gagal memuat listing, pakai data dummy', e);
    listings = dummy;
  }
  // Listing tanpa koordinat tidak ditampilkan (peta & jarak di desain membutuhkannya).
  listings = listings.filter((d) => d.lat != null && d.lng != null);
  const cities = [...new Set(listings.map((d) => d.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id'));
  const cityGroups = await getCityGroups();
  return (
    <VinmelApp
      backend={backendReady()}
      // Tanpa Supabase di production, pengajuan titip tidak dikirim ke server (tidak ada tempat menyimpan).
      titipApi={backendReady() || process.env.NODE_ENV !== 'production'}
      listings={listings}
      cities={cities}
      cityGroups={cityGroups}
      waNumber={process.env.NEXT_PUBLIC_WA_NUMBER ?? ''}
      siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vinmelagency.com'}
    />
  );
}
