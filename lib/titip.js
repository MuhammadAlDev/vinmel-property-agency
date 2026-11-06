import 'server-only';
import crypto from 'node:crypto';
import { backendReady, SUPABASE_SERVICE_ROLE_KEY } from './config';
import { supabaseServer, supabaseAdmin } from './supabase/server';
import { demo } from './demo-store';
import { normPhone62, slugOf } from './format';

export const STAGES = [
  [0, 'Dalam review'], [1, 'Perlu revisi'], [2, 'Survei'], [3, 'Approval'], [4, 'Disetujui'], [5, 'Tayang'], [6, 'Ditolak'],
];
// Checklist verifikasi (sama dengan TPCK di desain). Item "kuasa" hanya untuk pengajuan oleh kuasa.
export const CHECK_ITEMS = ['sert', 'pbg', 'pbb', 'ktp', 'kuasa', 'foto', 'harga', 'lokasi', 'desk'];
export const requiredChecks = (submitterRole) => CHECK_ITEMS.filter((k) => k !== 'kuasa' || submitterRole === 'kuasa');
const NOTE_MIN = 10;

// ───────── Media titip (Revisi 2): video tour & foto panorama 360° ─────────
// Diunggah langsung dari browser ke bucket privat "titip-media" lewat signed upload URL (file besar tidak lewat server Next.js).
export const MEDIA = {
  video: { types: { 'video/mp4': 'mp4', 'video/quicktime': 'mov' }, max: 200 * 1024 * 1024, label: 'Video harus MP4 atau MOV, maks. 200 MB.' },
  pano: { types: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }, max: 20 * 1024 * 1024, label: 'Foto 360° harus JPG/PNG/WEBP, maks. 20 MB.' },
};
export async function createMediaUploadUrl(user, b) {
  if (!user || user.demo) return { status: user ? 503 : 401, message: user ? 'Unggah video/foto 360° butuh Supabase (mode demo).' : 'Masuk dulu untuk mengunggah media.' };
  const m = MEDIA[b?.kind];
  if (!m) return { status: 400, message: 'Jenis media tidak valid.' };
  const size = Number(b?.size) || 0;
  if (!m.types[b?.type] || size <= 0 || size > m.max) return { status: 422, message: m.label };
  if (!SUPABASE_SERVICE_ROLE_KEY) return { status: 503, message: 'SUPABASE_SERVICE_ROLE_KEY belum diisi.' };
  const path = `${user.id}/${b.kind}-${crypto.randomUUID()}.${m.types[b.type]}`;
  const { data, error } = await supabaseAdmin().storage.from('titip-media').createSignedUploadUrl(path);
  if (error) { console.error('[titip media url]', error); return { status: 500, message: 'Gagal menyiapkan unggahan.' }; }
  return { bucket: 'titip-media', path: data.path || path, token: data.token };
}
// Path media hanya diterima bila berada di folder user yang mengirim.
const ownMedia = (user, v) => (user && !user.demo && typeof v === 'string' && v.startsWith(user.id + '/') && /^[0-9a-f-]+\/(video|pano)-[0-9a-f-]+\.(mp4|mov|jpg|png|webp)$/.test(v) ? v : null);
const NEAR_KEYS = ['tol', 'kota', 'faskes', 'bandara'];
export function cleanNearby(near) {
  const out = {};
  for (const k of NEAR_KEYS) {
    const list = (Array.isArray(near?.[k]) ? near[k] : []).slice(0, 5)
      .map((x) => ({ n: s(x?.n, 80), d: s(x?.d, 12).replace(/[^0-9.,]/g, '') }))
      .filter((x) => x.n || x.d);
    if (list.length) out[k] = list;
  }
  return out;
}
const httpsOrNull = (v) => { const u = s(v, 500); return /^https:\/\/\S+$/.test(u) ? u : null; };
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
  if ((tp.videoUrl && !httpsOrNull(tp.videoUrl)) || (tp.tourUrl && !httpsOrNull(tp.tourUrl))) e.media = 'Link video dan tur 360° harus diawali https://';
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
  delete payload.photos; delete payload.video; delete payload.pano; delete payload.media; delete payload.tried; delete payload.submitted; delete payload.stage; delete payload.ref; delete payload.step; delete payload.sending;
  payload.photoNames = files.map((f) => f.name);
  const row = {
    ref, user_id: user?.id || null,
    owner_name: s(tp.name, 120), owner_phone: normPhone62(tp.phone), owner_email: s(tp.email, 160) || null,
    submitter_role: tp.role === 'kuasa' ? 'kuasa' : 'pemilik',
    type: tp.type, deal: tp.deal, title: s(tp.title, 140), address: s(tp.address, 300), city: s(tp.city, 80),
    price_num: digits(tp.price), plan: tp.plan === 'eksklusif' ? 'eksklusif' : 'open', payload,
    nearby: cleanNearby(tp.near), video_url: httpsOrNull(tp.videoUrl), tour_url: httpsOrNull(tp.tourUrl),
    video_path: ownMedia(user, tp.media?.video),
    pano_paths: (Array.isArray(tp.media?.pano) ? tp.media.pano : []).map((v) => ownMedia(user, v)).filter(Boolean).slice(0, 10),
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
  if (!backendReady()) return owner ? attachReview(demo.titip.map(shape)) : demo.titip.filter((t) => user && t.user_id === user.id).map(shape);
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
    for (const t of out) {
      const paths = [t.videoPath, ...t.panoPaths].filter(Boolean);
      if (!paths.length) continue;
      const { data: signed } = await sb.storage.from('titip-media').createSignedUrls(paths, 3600);
      const m = Object.fromEntries((signed || []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]));
      t.videoFile = m[t.videoPath] || ''; t.panoUrls = t.panoPaths.map((p) => m[p]).filter(Boolean);
    }
    await attachReview(out);
  }
  return out;
}

function shape(r) {
  return {
    id: r.id, ref: r.ref, userId: r.user_id, name: r.owner_name, phone: r.owner_phone, email: r.owner_email || '', role: r.submitter_role,
    type: r.type, deal: r.deal, title: r.title, address: r.address || '', city: r.city || '', priceNum: Number(r.price_num) || 0, plan: r.plan,
    payload: r.payload || {}, photoPaths: r.photo_paths || [], photoUrls: [], photoCount: (r.photo_paths || []).length || r.demoPhotos || 0,
    stage: r.stage, reviewNote: r.review_note || '', propertyId: r.property_id || null, createdAt: r.created_at,
    nearby: r.nearby || {}, videoUrl: r.video_url || '', tourUrl: r.tour_url || '', videoPath: r.video_path || '', panoPaths: r.pano_paths || [],
  };
}

export async function updateTitip(id, b, user) {
  // Perubahan tahap selalu lewat aturan review (catatan wajib, checklist untuk approval) dan tercatat di riwayat.
  if (b.stage != null) return reviewTitip(id, { stage: b.stage, action: b.action, note: b.reviewNote ?? b.note }, user);
  const patch = {};
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
    nearby: t.nearby || {}, video_url: t.videoUrl || null, tour_url: t.tourUrl || null,
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

// ───────── Review & approval titip (CMS owner) ─────────
const fmtLog = (iso) => { const d = new Date(iso); return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); };

// Tambahkan checklist & riwayat review ke daftar pengajuan (owner).
export async function attachReview(items) {
  if (!items.length) return items;
  if (!backendReady()) {
    for (const t of items) {
      t.checklist = { ...(demo.titipChecklist[t.id] || {}) };
      t.log = demo.titipReviews.filter((r) => r.submission_id === t.id).map((r) => ({ date: fmtLog(r.created_at), act: r.action, note: r.note }));
    }
    return items;
  }
  const sb = await supabaseServer();
  const ids = items.map((t) => t.id);
  const [{ data: ck, error: e1 }, { data: rv, error: e2 }] = await Promise.all([
    sb.from('titip_checklist').select('submission_id, item, checked').in('submission_id', ids),
    sb.from('titip_reviews').select('submission_id, action, note, created_at').in('submission_id', ids).order('created_at', { ascending: false }),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  for (const t of items) {
    t.checklist = Object.fromEntries((ck || []).filter((c) => c.submission_id === t.id).map((c) => [c.item, c.checked]));
    t.log = (rv || []).filter((r) => r.submission_id === t.id).map((r) => ({ date: fmtLog(r.created_at), act: r.action, note: r.note }));
  }
  return items;
}

export async function setChecklist(id, checks, user) {
  const rows = Object.entries(checks || {}).filter(([k]) => CHECK_ITEMS.includes(k))
    .map(([item, v]) => ({ submission_id: id, item, checked: !!v, updated_by: user?.demo ? null : user?.id || null, updated_at: new Date().toISOString() }));
  if (!rows.length) return { error: 'Tidak ada item checklist yang valid.' };
  if (!backendReady()) {
    if (!demo.titip.some((x) => x.id === id)) return { notFound: true };
    demo.titipChecklist[id] = { ...(demo.titipChecklist[id] || {}), ...Object.fromEntries(rows.map((r) => [r.item, r.checked])) };
    return { checklist: demo.titipChecklist[id] };
  }
  const sb = await supabaseServer();
  const { error } = await sb.from('titip_checklist').upsert(rows);
  if (error) throw error;
  const { data } = await sb.from('titip_checklist').select('item, checked').eq('submission_id', id);
  return { checklist: Object.fromEntries((data || []).map((c) => [c.item, c.checked])) };
}

// Aksi review: ubah tahap + catat riwayat. Aturan dicek di server (dan approval juga di database):
// - "Minta revisi" (1) & "Tolak" (6) wajib catatan minimal 10 huruf; catatan tampil di halaman status penjual.
// - "Setujui listing" (4) hanya bila semua checklist wajib tercentang.
export async function reviewTitip(id, b, user) {
  const stage = Number(b.stage);
  if (!STAGE_IDS.includes(stage)) return { error: 'Tahap tidak valid.' };
  const action = s(b.action, 60) || (STAGES.find((x) => x[0] === stage) || [])[1];
  const note = s(b.note, 1000);
  const needNote = stage === 1 || stage === 6;
  if (needNote && note.length < NOTE_MIN) return { error: 'Tulis catatan untuk pemilik minimal 10 huruf.' };
  const t = await getTitip(id);
  if (!t) return { notFound: true };
  if (stage === 4 && t.stage !== 4) {
    const chk = backendReady() ? (await attachReview([t]))[0].checklist : (demo.titipChecklist[id] || {});
    const missing = requiredChecks(t.role).filter((k) => !chk[k]);
    if (missing.length) return { error: 'Lengkapi semua checklist verifikasi sebelum menyetujui listing.' };
  }
  const patch = { stage };
  if (needNote) patch.review_note = note;
  const log = { submission_id: id, action, from_stage: t.stage, to_stage: stage, note, created_by: user?.demo ? null : user?.id || null, created_at: new Date().toISOString() };
  if (!backendReady()) {
    const d = demo.titip.find((x) => x.id === id);
    Object.assign(d, patch);
    demo.titipReviews.unshift(log);
    return { titip: (await attachReview([shape(d)]))[0] };
  }
  const sb = await supabaseServer();
  const { data, error } = await sb.from('titip_submissions').update(patch).eq('id', id).select('*').maybeSingle();
  if (error) { if (/checklist/.test(error.message || '')) return { error: 'Lengkapi semua checklist verifikasi sebelum menyetujui listing.' }; throw error; }
  if (!data) return { notFound: true };
  const { error: e2 } = await sb.from('titip_reviews').insert(log);
  if (e2) throw e2;
  return { titip: (await attachReview([shape(data)]))[0] };
}
