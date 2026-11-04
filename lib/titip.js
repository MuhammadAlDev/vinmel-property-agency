import 'server-only';
import crypto from 'node:crypto';
import { backendReady, SUPABASE_SERVICE_ROLE_KEY } from './config';
import { supabaseServer, supabaseAdmin } from './supabase/server';
import { demo } from './demo-store';
import { normPhone62, slugOf } from './format';

export const STAGES = [
  [0, 'Dalam review'], [1, 'Perlu revisi'], [2, 'Survei'], [3, 'Approval'], [4, 'Disetujui'], [5, 'Tayang'], [9, 'Ditolak'],
];
const STAGE_IDS = STAGES.map((x) => x[0]);
const TYPES = ['rumah', 'kos', 'apartemen', 'tanah'];
const MAX_PHOTOS = 12;
const MAX_BYTES = 8 * 1024 * 1024;
const IMG_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' };

const s = (v, max = 300) => String(v ?? '').trim().slice(0, max);
const digits = (v) => Number(String(v ?? '').replace(/[^0-9]/g, '')) || 0;
const newRef = () => 'VMA-TP-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();

// Validasi isian formulir titip (sama dengan aturan di desain, dicek ulang di server).
export function validateTitip(tp) {
  const e = {};
  if (s(tp.name).length < 3) e.name = 'Isi nama lengkap.';
  if (!normPhone62(tp.phone)) e.phone = 'Nomor WhatsApp belum valid.';
  if (tp.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s(tp.email))) e.email = 'Email belum valid.';
  if (!TYPES.includes(tp.type)) e.type = 'Tipe properti tidak valid.';
  if (!['Dijual', 'Disewa'].includes(tp.deal)) e.deal = 'Pilih Dijual atau Disewa.';
  if (s(tp.title).length < 5) e.title = 'Judul iklan minimal 5 karakter.';
  if (!s(tp.city)) e.city = 'Pilih kota.';
  if (digits(tp.price) <= 0) e.price = 'Isi harga.';
  if (!tp.agree) e.agree = 'Setujui syarat titip properti.';
  return e;
}

export function checkPhotos(files) {
  if (files.length > MAX_PHOTOS) return 'Maksimal ' + MAX_PHOTOS + ' foto.';
  for (const f of files) {
    if (!IMG_TYPES[f.type]) return 'Foto harus JPG, PNG, WEBP, atau HEIC (' + f.name + ').';
    if (f.size > MAX_BYTES) return 'Ukuran foto maksimal 8 MB (' + f.name + ').';
  }
  return '';
}

export async function createTitip(tp, files, user) {
  const ref = newRef();
  const payload = { ...tp };
  delete payload.photos; delete payload.tried; delete payload.submitted; delete payload.stage; delete payload.ref; delete payload.step; delete payload.sending;
  payload.photoNames = files.map((f) => f.name);
  const row = {
    ref, user_id: user?.id || null,
    owner_name: s(tp.name, 120), owner_phone: normPhone62(tp.phone), owner_email: s(tp.email, 160) || null,
    submitter_role: tp.role === 'kuasa' ? 'kuasa' : 'pemilik',
    type: tp.type, deal: tp.deal, title: s(tp.title, 140), address: s(tp.address, 300), city: s(tp.city, 80),
    price_num: digits(tp.price), plan: tp.plan === 'eksklusif' ? 'eksklusif' : 'open', payload,
  };
  if (!backendReady()) {
    demo.titip.unshift({ id: crypto.randomUUID(), ...row, photo_paths: [], stage: 0, review_note: '', created_at: new Date().toISOString(), demoPhotos: files.length });
    return { ref };
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) throw Object.assign(new Error('SUPABASE_SERVICE_ROLE_KEY belum diisi'), { status: 503 });
  const admin = supabaseAdmin();
  const paths = [];
  for (const [i, f] of files.entries()) {
    const path = `${ref}/${String(i + 1).padStart(2, '0')}.${IMG_TYPES[f.type]}`;
    const { error } = await admin.storage.from('titip').upload(path, f, { contentType: f.type, upsert: false });
    if (error) throw error;
    paths.push(path);
  }
  const { error } = await admin.from('titip_submissions').insert({ ...row, photo_paths: paths });
  if (error) throw error;
  return { ref };
}

export async function listTitip({ owner = false, user = null } = {}) {
  if (!backendReady()) return owner ? demo.titip.map(shape) : [];
  const sb = await supabaseServer();
  let qb = sb.from('titip_submissions').select('*').order('created_at', { ascending: false }).limit(300);
  if (!owner && user) qb = qb.eq('user_id', user.id);
  const { data, error } = await qb;
  if (error) throw error;
  const out = data.map(shape);
  if (owner) {
    // URL bertanda (1 jam) untuk foto di bucket privat.
    for (const t of out) {
      if (!t.photoPaths.length) continue;
      const { data: signed } = await sb.storage.from('titip').createSignedUrls(t.photoPaths, 3600);
      t.photoUrls = (signed || []).map((x) => x.signedUrl).filter(Boolean);
    }
  }
  return out;
}

function shape(r) {
  return {
    id: r.id, ref: r.ref, userId: r.user_id, name: r.owner_name, phone: r.owner_phone, email: r.owner_email || '', role: r.submitter_role,
    type: r.type, deal: r.deal, title: r.title, address: r.address || '', city: r.city || '', priceNum: Number(r.price_num) || 0, plan: r.plan,
    payload: r.payload || {}, photoPaths: r.photo_paths || [], photoUrls: [], photoCount: (r.photo_paths || []).length || r.demoPhotos || 0,
    stage: r.stage, reviewNote: r.review_note || '', propertyId: r.property_id || null, createdAt: r.created_at,
  };
}

export async function updateTitip(id, b) {
  const patch = {};
  if (b.stage != null) { if (!STAGE_IDS.includes(Number(b.stage))) return { error: 'Tahap tidak valid.' }; patch.stage = Number(b.stage); }
  if (b.reviewNote != null) patch.review_note = s(b.reviewNote, 1000);
  if (!backendReady()) {
    const t = demo.titip.find((x) => x.id === id);
    if (!t) return { notFound: true };
    Object.assign(t, patch);
    return { titip: shape(t) };
  }
  const sb = await supabaseServer();
  const { data, error } = await sb.from('titip_submissions').update(patch).eq('id', id).select('*').maybeSingle();
  if (error) throw error;
  return data ? { titip: shape(data) } : { notFound: true };
}

// Ubah pengajuan titip menjadi draft listing. Owner melengkapi koordinat & foto di CMS sebelum ditayangkan.
export function titipToListingRow(t) {
  const p = t.payload || {};
  const n = (v) => Number(String(v ?? '').replace(/[^0-9.]/g, '')) || 0;
  const on = (o) => Object.keys(o || {}).filter((k) => o[k]);
  const rp = (v) => (n(v) ? 'Rp ' + String(n(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : undefined);
  const row = {
    status: 'draft', featured: false, type: t.type, deal: t.deal, title: t.title,
    location: [t.address, t.city].filter(Boolean).join(', ').slice(0, 160) || t.city, city: t.city,
    price_num: t.priceNum, unit: t.deal === 'Disewa' ? '/bulan' : '',
    lt_num: n(p.lt), lb_num: n(p.lb), kt_num: Math.round(n(p.kt)), km_label: p.km ? String(p.km) : null, cert: p.cert || null,
    lat: null, lng: null, photos: [], description: String(p.desc || '').split(/\n\s*\n/).filter(Boolean), fasilitas: [],
    ext: {
      pay: p.pay || '', build: p.build || '', reno: p.reno === 'ya', facing: p.facing || '', floors: Math.round(n(p.floors)),
      was: t.deal === 'Dijual' ? rp(p.wasPrice) : undefined, unitType: p.unitType || undefined,
      avail: on(p.avail), sec: on(p.sec), fac: on(p.fac),
      near: [p.nearTol, p.nearKota, p.nearFaskes, p.nearBandara].map((x) => (x ? x + ' km' : '—')),
      walk: 2, lv: 'proses', pbb: p.pbb || '', imb: p.imb || '', isNew: p.isNew === 'ya', dev: p.dev || '',
      ipl: p.iplMode === 'gratis' ? ['gratis', '', String(p.iplYears || '')] : p.iplMode === 'bayar' ? ['bayar', 'Rp ' + (p.iplAmount || '') + ' / bulan', ''] : null,
    },
    source_titip_id: backendReady() ? t.id : undefined,
  };
  row.slug = slugOf(row) + '-' + t.ref.toLowerCase().slice(-4);
  return row;
}

export async function getTitip(id) {
  if (!backendReady()) { const t = demo.titip.find((x) => x.id === id); return t ? shape(t) : null; }
  const sb = await supabaseServer();
  const { data, error } = await sb.from('titip_submissions').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? shape(data) : null;
}

// Salin foto titip (bucket privat) ke bucket publik "listing" dan kembalikan URL publiknya.
export async function copyTitipPhotos(t, listingId) {
  if (!backendReady() || !t.photoPaths.length || !SUPABASE_SERVICE_ROLE_KEY) return [];
  const admin = supabaseAdmin();
  const urls = [];
  for (const p of t.photoPaths) {
    const dest = `${listingId}/${p.replace(/\//g, '-')}`;
    const { error } = await admin.storage.from('titip').copy(p, dest, { destinationBucket: 'listing' });
    if (!error) urls.push(admin.storage.from('listing').getPublicUrl(dest).data.publicUrl);
  }
  return urls;
}

export async function linkTitipToListing(id, propertyId) {
  if (!backendReady()) { const t = demo.titip.find((x) => x.id === id); if (t) t.property_id = propertyId; return; }
  const sb = await supabaseServer();
  await sb.from('titip_submissions').update({ property_id: propertyId }).eq('id', id);
}
