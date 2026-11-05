import 'server-only';
import listings from '../data/dummy/listings.json';
import pantau from '../data/dummy/pantau.json';

// Penyimpanan di memori untuk mode demo (tanpa Supabase). Hilang saat server restart.
const g = globalThis;
const clone = (x) => JSON.parse(JSON.stringify(x));
if (!g.__vinmelDemo) {
  g.__vinmelDemo = {
    listings: clone(listings).map((d) => ({ ...d, status: 'tayang' })),
    purchases: clone(pantau).map((o, i) => ({ ...o, id: 'demo-' + (i + 1), buyerPhone: '', buyerEmail: '' })),
    titip: [],
  };
}
// Tambahan CMS (2026-11-05); diisi terpisah supaya store lama saat hot reload tetap lengkap.
const d0 = g.__vinmelDemo;
d0.content ??= {};
d0.surveys ??= [];
d0.utj ??= [];
d0.updates ??= [];
// Tambahan desain 2026-11-06: data pemilik (penjual), riwayat review & checklist titip.
d0.pemilik ??= {};
d0.titipReviews ??= [];
d0.titipChecklist ??= {};
export const demo = d0;
