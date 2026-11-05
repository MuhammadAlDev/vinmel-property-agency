import VinmelApp from '../components/VinmelApp';
import { listListings, PUBLIC_STATUSES } from '@/lib/listings';
import { getContent, getMarket } from '@/lib/cms';
import { getCityGroups } from '@/lib/wilayah';
import { demoSessionAs } from '@/lib/auth';
import { backendReady } from '@/lib/config';
import dummy from '../data/dummy/listings.json';

export const dynamic = 'force-dynamic';

export default async function Home() {
  // live = data CMS & login dari backend. Tanpa Supabase, live hanya bila VINMEL_DEMO_AS diisi (uji lokal).
  const live = backendReady() || !!demoSessionAs();
  let listings;
  try {
    listings = await listListings({ statuses: PUBLIC_STATUSES });
  } catch (e) {
    console.error('[home] gagal memuat listing, pakai data dummy', e);
    listings = dummy;
  }
  // Listing tanpa koordinat tidak ditampilkan (peta & jarak di desain membutuhkannya).
  listings = listings.filter((d) => d.lat != null && d.lng != null);
  const cities = [...new Set(listings.map((d) => d.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id'));
  const [cityGroups, cmsContent, market] = await Promise.all([
    getCityGroups(),
    live ? getContent().catch((e) => { console.error('[home] konten', e); return {}; }) : {},
    getMarket().catch((e) => { console.error('[home] data pasar', e); return null; }),
  ]);
  return (
    <VinmelApp
      backend={live}
      // Production tanpa Supabase: login tetap lewat /api (menolak), bukan login pratinjau yang menerima OTP apa pun.
      authLocked={process.env.NODE_ENV === 'production'}
      market={market}
      // Tanpa Supabase di production, pengajuan titip tidak dikirim ke server (tidak ada tempat menyimpan).
      titipApi={backendReady() || process.env.NODE_ENV !== 'production'}
      listings={listings}
      cmsContent={cmsContent}
      cities={cities}
      cityGroups={cityGroups}
      waNumber={process.env.NEXT_PUBLIC_WA_NUMBER ?? ''}
      siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vinmelagency.com'}
    />
  );
}
