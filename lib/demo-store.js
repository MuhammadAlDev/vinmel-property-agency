import 'server-only';
import listings from '../data/dummy/listings.json';
import pantau from '../data/dummy/pantau.json';

// Penyimpanan di memori untuk mode demo (tanpa Supabase). Hilang saat server restart.
const g = globalThis;
if (!g.__vinmelDemo) {
  const clone = (x) => JSON.parse(JSON.stringify(x));
  g.__vinmelDemo = {
    listings: clone(listings).map((d) => ({ ...d, status: 'tayang' })),
    purchases: clone(pantau).map((o, i) => ({ ...o, id: 'demo-' + (i + 1), buyerPhone: '', buyerEmail: '' })),
    titip: [],
  };
}
export const demo = g.__vinmelDemo;
