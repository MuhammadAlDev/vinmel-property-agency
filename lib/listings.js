import 'server-only';
import { backendReady } from './config';
import { supabaseServer } from './supabase/server';
import { demo } from './demo-store';
import { priceLabel, m2Label, countLabel, slugOf } from './format';

export const TYPES = ['rumah', 'kos', 'apartemen', 'tanah'];
export const DEALS = ['Dijual', 'Disewa'];
export const STATUSES = ['draft', 'tayang', 'booked', 'terjual', 'tersewa', 'arsip'];
// Status yang tampil di situs publik (booked/terjual tetap tampil dengan badge).
export const PUBLIC_STATUSES = ['tayang', 'booked', 'terjual', 'tersewa'];
// Status DB -> status desain (desain memakai satu status "terjual" untuk terjual/tersewa, dan "draft" untuk yang disembunyikan).
const DESIGN_STATUS = { tayang: 'tayang', booked: 'booked', terjual: 'terjual', tersewa: 'terjual', draft: 'draft', arsip: 'draft' };
export const CERTS = ['SHM', 'HGB', 'Strata', 'Girik / AJB', 'Lainnya'];
export const PLACEHOLDER_PHOTO = '/placeholder-properti.svg';

const EXT0 = { pay: '', build: '', reno: false, facing: '', floors: 0, ipl: null, avail: [], sec: [], fac: [], near: ['—', '—', '—', '—'], walk: 2, lv: 'proses', pbb: '', imb: '', isNew: false, dev: '' };

// Baris tabel properties -> bentuk data yang dipakai desain (DesignComponent).
export function rowToDesign(r) {
  return {
    id: Number(r.id),
    slug: r.slug || slugOf(r),
    status: DESIGN_STATUS[r.status] || 'tayang',
    dbStatus: r.status || 'tayang',
    video: r.video_url || '',
    tour: r.tour_url || '',
    featured: !!r.featured,
    type: r.type,
    deal: r.deal,
    title: r.title,
    location: r.location,
    city: r.city,
    province: r.province || '',
    wilayahCode: r.wilayah_code || '',
    priceNum: Number(r.price_num) || 0,
    price: r.price_label || priceLabel(r.price_num),
    unit: r.unit || '',
    ltNum: Number(r.lt_num) || 0,
    lbNum: Number(r.lb_num) || 0,
    ktNum: Number(r.kt_num) || 0,
    lt: r.lt_label || m2Label(r.lt_num),
    lb: r.lb_label || m2Label(r.lb_num),
    kt: r.kt_label || countLabel(r.kt_num),
    km: r.km_label || '—',
    cert: r.cert || '—',
    lat: r.lat == null ? null : Number(r.lat),
    lng: r.lng == null ? null : Number(r.lng),
    photos: r.photos && r.photos.length ? r.photos : [PLACEHOLDER_PHOTO],
    desc: r.description && r.description.length ? r.description : [''],
    fasilitas: r.fasilitas || [],
    ext: { ...EXT0, ...(r.ext || {}) },
  };
}

const str = (v, max = 300) => String(v ?? '').trim().slice(0, max);
const num = (v) => { const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : 0; };
const list = (v, max = 30) => (Array.isArray(v) ? v : String(v ?? '').split(/\n|,/)).map((x) => str(x, 2000)).filter(Boolean).slice(0, max);

// Validasi input dari CMS owner -> baris tabel. partial=true untuk PATCH.
export function validateListing(body, { partial = false } = {}) {
  const b = body || {};
  const row = {};
  const errors = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
  const need = (k) => !partial || has(k);

  if (need('title')) { row.title = str(b.title, 140); if (row.title.length < 5) errors.title = 'Judul minimal 5 karakter.'; }
  if (need('type')) { row.type = b.type; if (!TYPES.includes(b.type)) errors.type = 'Tipe tidak valid.'; }
  if (need('deal')) { row.deal = b.deal; if (!DEALS.includes(b.deal)) errors.deal = 'Pilih Dijual atau Disewa.'; }
  if (need('location')) { row.location = str(b.location, 160); if (row.location.length < 3) errors.location = 'Isi lokasi (contoh: Bintaro, Tangerang Selatan).'; }
  if (need('city')) { row.city = str(b.city, 80); if (!row.city) errors.city = 'Pilih kota.'; }
  if (has('province')) row.province = str(b.province, 80);
  if (has('wilayahCode')) row.wilayah_code = str(b.wilayahCode, 10);
  if (need('priceNum')) { row.price_num = Math.round(num(b.priceNum)); if (row.price_num <= 0) errors.priceNum = 'Harga harus lebih dari 0.'; }
  if (has('priceLabel')) row.price_label = str(b.priceLabel, 40) || null;
  if (has('unit')) { row.unit = ['', '/bulan', '/m²'].includes(b.unit) ? b.unit : ''; }
  if (has('ltNum')) row.lt_num = Math.max(0, num(b.ltNum));
  if (has('lbNum')) row.lb_num = Math.max(0, num(b.lbNum));
  if (has('ktNum')) row.kt_num = Math.max(0, Math.round(num(b.ktNum)));
  if (has('ltLabel')) row.lt_label = str(b.ltLabel, 40) || null;
  if (has('lbLabel')) row.lb_label = str(b.lbLabel, 40) || null;
  if (has('ktLabel')) row.kt_label = str(b.ktLabel, 40) || null;
  if (has('kmLabel')) row.km_label = str(b.kmLabel, 40) || null;
  if (has('cert')) row.cert = str(b.cert, 40) || null;
  if (need('lat')) { row.lat = num(b.lat); if (!(row.lat >= -11.5 && row.lat <= 6.5) || !String(b.lat ?? '').trim()) errors.lat = 'Latitude harus di wilayah Indonesia (−11,5 s/d 6,5).'; }
  if (need('lng')) { row.lng = num(b.lng); if (!(row.lng >= 94 && row.lng <= 141.5)) errors.lng = 'Longitude harus di wilayah Indonesia (94 s/d 141,5).'; }
  if (has('photos')) row.photos = list(b.photos, 20).filter((u) => /^(https:\/\/|\/)/.test(u));
  if (has('description')) row.description = Array.isArray(b.description) ? list(b.description, 10) : String(b.description || '').split(/\n\s*\n/).map((x) => str(x, 2000)).filter(Boolean);
  if (has('fasilitas')) row.fasilitas = list(b.fasilitas, 20);
  if (has('status')) { row.status = b.status; if (!STATUSES.includes(b.status)) errors.status = 'Status tidak valid.'; }
  if (has('featured')) row.featured = !!b.featured;
  if (has('ext') && b.ext && typeof b.ext === 'object') {
    const e = b.ext;
    row.ext = {
      pay: ['kpr', 'cash', ''].includes(e.pay) ? e.pay : '',
      build: ['ready', 'inden', ''].includes(e.build) ? e.build : '',
      reno: !!e.reno,
      facing: str(e.facing, 30),
      floors: Math.max(0, Math.round(num(e.floors))),
      was: str(e.was, 30) || undefined,
      unitType: str(e.unitType, 30) || undefined,
      lv: e.lv === 'verified' ? 'verified' : 'proses',
      pbb: str(e.pbb, 60), imb: str(e.imb, 80),
      isNew: !!e.isNew, dev: str(e.dev, 80),
      avail: list(e.avail, 10), sec: list(e.sec, 10), fac: list(e.fac, 20),
      near: Array.isArray(e.near) && e.near.length === 4 ? e.near.map((x) => str(x, 20) || '—') : ['—', '—', '—', '—'],
      walk: Math.min(3, Math.max(1, Math.round(num(e.walk)) || 2)),
      ipl: Array.isArray(e.ipl) ? e.ipl.slice(0, 3).map((x) => str(x, 60)) : null,
    };
  }
  if (row.deal === 'Disewa' && !has('unit')) row.unit = '/bulan';
  if (row.title && row.location) row.slug = slugOf(row);
  return { row, errors, valid: Object.keys(errors).length === 0 };
}

function applyFilters(items, f) {
  const q = (f.q || '').toLowerCase();
  return items.filter((d) =>
    (!f.status || (d.dbStatus || d.status) === f.status) &&
    (!f.statuses || f.statuses.includes(d.dbStatus || d.status)) &&
    (!f.type || d.type === f.type) &&
    (!f.deal || d.deal === f.deal) &&
    (!f.city || d.city === f.city) &&
    (!f.pmin || d.priceNum >= f.pmin) &&
    (!f.pmax || d.priceNum <= f.pmax) &&
    (f.featured == null || d.featured === f.featured) &&
    (!q || (d.title + ' ' + d.location + ' ' + d.city).toLowerCase().includes(q)));
}

export function parseFilters(sp, { owner = false } = {}) {
  const g = (k) => sp.get(k) || '';
  const f = {
    type: TYPES.includes(g('type')) ? g('type') : '',
    deal: DEALS.includes(g('deal')) ? g('deal') : '',
    city: g('city').slice(0, 80),
    q: g('q').slice(0, 80),
    pmin: Number(g('pmin')) || 0,
    pmax: Number(g('pmax')) || 0,
    featured: g('featured') === '1' ? true : g('featured') === '0' ? false : null,
  };
  // Publik hanya melihat listing tayang (+ terjual/tersewa via RLS); owner boleh filter status apa pun.
  f.status = owner ? (STATUSES.includes(g('status')) ? g('status') : '') : (g('status') === 'semua' ? '' : 'tayang');
  return f;
}

export async function listListings(f = { status: 'tayang' }) {
  if (!backendReady()) return applyFilters(demo.listings, f);
  const sb = await supabaseServer();
  let qb = sb.from('properties').select('*').order('featured', { ascending: false }).order('created_at', { ascending: false }).limit(500);
  if (f.status) qb = qb.eq('status', f.status);
  if (f.statuses) qb = qb.in('status', f.statuses);
  if (f.type) qb = qb.eq('type', f.type);
  if (f.deal) qb = qb.eq('deal', f.deal);
  if (f.city) qb = qb.eq('city', f.city);
  if (f.pmin) qb = qb.gte('price_num', f.pmin);
  if (f.pmax) qb = qb.lte('price_num', f.pmax);
  if (f.featured != null) qb = qb.eq('featured', f.featured);
  if (f.q) { const s = f.q.replace(/[%,()]/g, ' '); qb = qb.or(`title.ilike.%${s}%,location.ilike.%${s}%,city.ilike.%${s}%`); }
  const { data, error } = await qb;
  if (error) throw error;
  return data.map(rowToDesign);
}

export async function getListing(id) {
  if (!backendReady()) return demo.listings.find((d) => d.id === Number(id)) || null;
  const sb = await supabaseServer();
  const { data, error } = await sb.from('properties').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToDesign(data) : null;
}

export async function createListing(row, userId) {
  if (!backendReady()) {
    const id = Math.max(0, ...demo.listings.map((d) => d.id)) + 1;
    const d = rowToDesign({ status: 'draft', ...row, id });
    demo.listings.unshift(d);
    return d;
  }
  const sb = await supabaseServer();
  const { data, error } = await sb.from('properties').insert({ ...row, created_by: userId }).select('*').single();
  if (error) throw error;
  return rowToDesign(data);
}

export async function updateListing(id, row) {
  if (!backendReady()) {
    const i = demo.listings.findIndex((d) => d.id === Number(id));
    if (i < 0) return null;
    const cur = demo.listings[i];
    const asRow = { id: cur.id, slug: cur.slug, status: cur.dbStatus || cur.status, video_url: cur.video || null, tour_url: cur.tour || null, featured: cur.featured, type: cur.type, deal: cur.deal, title: cur.title, location: cur.location, city: cur.city, province: cur.province, price_num: cur.priceNum, unit: cur.unit, lt_num: cur.ltNum, lb_num: cur.lbNum, kt_num: cur.ktNum, lt_label: cur.lt, lb_label: cur.lb, kt_label: cur.kt, km_label: cur.km, cert: cur.cert, lat: cur.lat, lng: cur.lng, photos: cur.photos, description: cur.desc, fasilitas: cur.fasilitas, ext: cur.ext };
    // Label lama dibuang bila angkanya diubah supaya dihitung ulang.
    if ('price_num' in row) asRow.price_label = null; else asRow.price_label = cur.price;
    if ('lt_num' in row) asRow.lt_label = null;
    if ('lb_num' in row) asRow.lb_label = null;
    if ('kt_num' in row) asRow.kt_label = null;
    demo.listings[i] = rowToDesign({ ...asRow, ...row });
    return demo.listings[i];
  }
  const sb = await supabaseServer();
  const patch = { ...row };
  if ('price_num' in row && !('price_label' in row)) patch.price_label = null;
  if ('lt_num' in row && !('lt_label' in row)) patch.lt_label = null;
  if ('lb_num' in row && !('lb_label' in row)) patch.lb_label = null;
  if ('kt_num' in row && !('kt_label' in row)) patch.kt_label = null;
  const { data, error } = await sb.from('properties').update(patch).eq('id', id).select('*').maybeSingle();
  if (error) throw error;
  return data ? rowToDesign(data) : null;
}

export async function deleteListing(id) {
  if (!backendReady()) {
    const i = demo.listings.findIndex((d) => d.id === Number(id));
    if (i > -1) demo.listings.splice(i, 1);
    return i > -1;
  }
  const sb = await supabaseServer();
  const { error, count } = await sb.from('properties').delete({ count: 'exact' }).eq('id', id);
  if (error) throw error;
  return count > 0;
}
