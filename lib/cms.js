import 'server-only';
import crypto from 'node:crypto';
import { backendReady, SUPABASE_SERVICE_ROLE_KEY } from './config';
import { supabaseServer, supabaseAdmin } from './supabase/server';
import { demo } from './demo-store';
import { normPhone62, priceLabel } from './format';
import { getListing, updateListing } from './listings';
import { checkPhotos } from './titip';

// Sambungan backend untuk CMS owner & halaman pembeli di desain Amel (2026-11-05).
// Bentuk data yang dikembalikan mengikuti state `cms` di DesignComponent.

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const fmtDate = (iso) => { if (!iso) return ''; const d = new Date(iso); return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); };
const s = (v, max = 300) => String(v ?? '').trim().slice(0, max);
const to08 = (p) => (String(p || '').startsWith('62') ? '0' + String(p).slice(2) : String(p || ''));
const isHttps = (u) => /^https:\/\/[^\s]+$/.test(u);
const needAdmin = () => { if (!SUPABASE_SERVICE_ROLE_KEY) throw Object.assign(new Error('SUPABASE_SERVICE_ROLE_KEY belum diisi'), { status: 503 }); return supabaseAdmin(); };

// ───────── Konten: about / stats / testi ─────────
export const CONTENT_KEYS = ['about', 'stats', 'testi'];

// Foto konten: hanya URL bucket "konten" project ini atau aset bawaan (/assets/...). Object URL (blob:) ditolak.
const SAMPLE_PHOTOS = ['/assets/5f601a0525609f32bf2a936debf4dedd.jpg', '/assets/ea8ae1907bf95848f5b450a512857bce.jpg', '/assets/85e619bba2d11fb8adf8bd971eb8c75b.jpg'];
const photoOk = (u) => {
  const v = s(u, 500);
  if (!v) return '';
  if (/^\/assets\/[a-f0-9]{32}\.(jpg|jpeg|png|webp)$/.test(v)) return v;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  if (base && v.startsWith(base + '/storage/v1/object/public/konten/')) return v;
  if (!backendReady() && v.startsWith('/api/cms/foto/demo/')) return v;
  return '';
};
const httpsOr = (u) => { const v = s(u, 300); return isHttps(v) ? v : ''; };

export function cleanContent(key, v) {
  if (key === 'about') return {
    name: s(v?.name, 80), role: s(v?.role, 80), bio: s(v?.bio, 1200), since: s(v?.since, 4).replace(/\D/g, ''), area: s(v?.area, 160),
    photo: photoOk(v?.photo), ig: httpsOr(v?.ig), tiktok: httpsOr(v?.tiktok), yt: httpsOr(v?.yt), fb: httpsOr(v?.fb),
  };
  // Angka kepercayaan: [angka, label, keterangan] tampil di situs; sumber (kolom ke-4) disimpan terpisah di stats_src.
  if (key === 'stats') return (Array.isArray(v) ? v : []).slice(0, 4).map((x) => [s(x?.[0], 20), s(x?.[1], 60), s(x?.[2], 160)]);
  if (key === 'stats_src') return (Array.isArray(v) ? v : []).slice(0, 4).map((x) => s(x?.[3], 200));
  if (key === 'testi') return (Array.isArray(v) ? v : []).slice(0, 12).map((x) => {
    const photo = photoOk(x?.photo);
    // Testimoni contoh (persona Aira/Mei/Rani) tetap ditandai "Contoh" sampai Vian memutuskan testimoni asli.
    const sample = !!x?.sample || SAMPLE_PHOTOS.includes(photo);
    return { name: s(x?.name, 80), prop: s(x?.prop, 120), quote: s(x?.quote, 600), photo, ...(sample ? { sample: true } : {}) };
  });
  return null;
}

// ───────── Data pasar area (Perbandingan properti sekitar) ─────────
// Bentuk desain: { HP: { kota: [kenaikan, sumber] }, YL: { kota: [yield, sumber] }, hp0, yl0 } (kota '*' = nasional).
export async function getMarket() {
  if (!backendReady()) return null; // pakai angka bawaan desain
  const sb = await supabaseServer();
  const { data, error } = await sb.from('market_area_stats').select('*');
  if (error) throw error;
  const out = { HP: {}, YL: {}, hp0: null, yl0: null };
  for (const r of data || []) {
    if (r.city === '*') { if (r.price_growth) out.hp0 = [r.price_growth, r.price_growth_src || '']; if (r.rent_yield) out.yl0 = [r.rent_yield, r.rent_yield_src || '']; continue; }
    if (r.price_growth) out.HP[r.city] = [r.price_growth, r.price_growth_src || ''];
    if (r.rent_yield) out.YL[r.city] = [r.rent_yield, r.rent_yield_src || ''];
  }
  return out;
}

// ───────── Foto konten (profil owner, testimoni) -> bucket publik "konten" ─────────
export async function uploadContentPhoto(file, kind) {
  const bad = checkPhotos([file]);
  if (bad) return { status: 422, message: bad };
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type];
  if (!ext) return { status: 422, message: 'Foto harus JPG, PNG, atau WEBP.' };
  const path = `${kind === 'owner' ? 'owner' : 'testimoni'}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  if (!backendReady()) {
    demo.photos ??= {};
    demo.photos[path] = { type: file.type, buf: Buffer.from(await file.arrayBuffer()) };
    return { url: '/api/cms/foto/demo/' + path };
  }
  const sb = await supabaseServer();
  const { error } = await sb.storage.from('konten').upload(path, file, { contentType: file.type, upsert: false });
  if (error) { console.error('[konten upload]', error); return { status: 500, message: 'Gagal mengunggah foto.' }; }
  return { url: sb.storage.from('konten').getPublicUrl(path).data.publicUrl };
}

// internal=true (CMS owner): angka kepercayaan ikut membawa sumbernya. stats_src hanya bisa dibaca owner (RLS).
export async function getContent({ internal = false } = {}) {
  let out;
  if (!backendReady()) out = { ...demo.content };
  else {
    const sb = await supabaseServer();
    const { data, error } = await sb.from('site_content').select('key, value');
    if (error) throw error;
    out = {};
    for (const r of data || []) if (r.value != null) out[r.key] = r.value;
  }
  const src = out.stats_src;
  delete out.stats_src;
  if (internal && Array.isArray(out.stats)) out.stats = out.stats.map((x, i) => [x[0] || '', x[1] || '', x[2] || '', (src || [])[i] || '']);
  return out;
}

export async function saveContent(key, value, user) {
  const rows = [{ key, value: cleanContent(key, value) }];
  if (key === 'stats') rows.push({ key: 'stats_src', value: cleanContent('stats_src', value) });
  if (!backendReady()) { for (const r of rows) demo.content[r.key] = r.value; }
  else {
    const sb = await supabaseServer();
    const { error } = await sb.from('site_content').upsert(rows.map((r) => ({ ...r, updated_by: user?.demo ? null : user?.id || null })));
    if (error) throw error;
  }
  return key === 'stats' ? rows[0].value.map((x, i) => [...x, rows[1].value[i] || '']) : rows[0].value;
}

// ───────── Listing dari CMS: judul, harga, harga coret, status, video, tur 360° ─────────
const CMS_STATUS = ['tayang', 'booked', 'terjual', 'draft'];
export async function updateListingCms(id, b) {
  const cur = await getListing(id);
  if (!cur) return { notFound: true };
  const row = {};
  const errors = {};
  if (b.title !== undefined) { row.title = s(b.title, 140); if (row.title.length < 4) errors.title = 'Judul minimal 4 huruf.'; }
  if (b.price !== undefined) { row.price_num = Math.round(Number(b.price) || 0); if (row.price_num <= 0) errors.price = 'Isi harga dengan angka.'; }
  if (b.status !== undefined) {
    if (!CMS_STATUS.includes(b.status)) errors.status = 'Status tidak valid.';
    // Desain memakai "terjual" untuk terjual & tersewa.
    else row.status = b.status === 'terjual' && cur.deal === 'Disewa' ? 'tersewa' : b.status;
  }
  for (const [k, col] of [['video', 'video_url'], ['tour', 'tour_url']]) {
    if (b[k] === undefined) continue;
    const u = s(b[k], 500);
    if (u && !isHttps(u)) errors[k] = 'Link harus diawali https://';
    row[col] = u || null;
  }
  if (b.was !== undefined) {
    const was = Math.round(Number(b.was) || 0);
    const price = row.price_num ?? cur.priceNum;
    if (was && was <= price) errors.was = 'Harga coret harus lebih tinggi dari harga sekarang.';
    if (cur.deal === 'Dijual') {
      const per = cur.unit === '/m²' && cur.ltNum ? cur.ltNum : 1;
      const ext = { ...cur.ext };
      if (was) ext.was = priceLabel(was / per); else delete ext.was;
      row.ext = ext;
    }
  }
  if (row.price_num && cur.unit === '/m²' && cur.ltNum) row.price_label = priceLabel(row.price_num / cur.ltNum);
  const nextStatus = row.status ?? cur.dbStatus ?? cur.status;
  if (['tayang', 'booked'].includes(nextStatus) && (cur.lat == null || cur.lng == null)) errors.status = 'Isi koordinat listing (di Alat lanjutan) sebelum ditayangkan.';
  if (Object.keys(errors).length) return { errors };
  return { item: await updateListing(id, row) };
}

// ───────── Jadwal survei ─────────
const SV_DB = { baru: 'baru', ok: 'dikonfirmasi', selesai: 'selesai', batal: 'batal' };
const SV_DESIGN = { baru: 'baru', dikonfirmasi: 'ok', selesai: 'selesai', batal: 'batal' };
export const surveyStatusToDb = (v) => SV_DB[v] || null;

function shapeSurvey(r) {
  return {
    uid: r.uid, id: r.id, propId: r.property_id, title: r.property_title || 'Properti', name: r.name, phone: to08(r.phone), note: r.note || '',
    dateLabel: r.date_label || r.date, slotLabel: r.slot_label || r.slot, date: r.date, status: SV_DESIGN[r.status] || 'baru', createdAt: r.created_at,
  };
}

export function validateSurvey(b) {
  const e = {};
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(b?.date || '') ? new Date(b.date + 'T00:00:00') : null;
  const row = {
    uid: s(b?.uid, 60), name: s(b?.name, 120), phone: normPhone62(b?.phone), note: s(b?.note, 500) || null,
    date: b?.date, slot: b?.slot, date_label: s(b?.dateLabel, 80), slot_label: s(b?.slotLabel, 80),
    property_id: Number(b?.propId) || null, property_title: s(b?.title, 140),
  };
  if (!/^sv[0-9a-z-]{4,58}$/i.test(row.uid)) e.uid = 'ID survei tidak valid.';
  if (row.name.length < 2) e.name = 'Isi nama minimal 2 huruf.';
  if (!row.phone) e.phone = 'Nomor WhatsApp belum valid.';
  if (!d || isNaN(d) || d < today || d - today > 45 * 864e5) e.date = 'Tanggal survei tidak valid.';
  if (!['pagi', 'siang', 'sore'].includes(row.slot)) e.slot = 'Jam survei tidak valid.';
  return { row, errors: e, valid: !Object.keys(e).length };
}

export async function createSurvey(b, user) {
  const v = validateSurvey(b);
  if (!v.valid) return { errors: v.errors };
  const row = { ...v.row, user_id: user && !user.demo ? user.id : null };
  if (row.property_id) {
    const p = await getListing(row.property_id).catch(() => null);
    if (!p) row.property_id = null; else row.property_title = p.title;
  }
  if (!backendReady()) {
    if (demo.surveys.some((x) => x.uid === row.uid)) return { survey: shapeSurvey(demo.surveys.find((x) => x.uid === row.uid)) };
    const r = { id: crypto.randomUUID(), ...row, user_id: user?.id || null, status: 'baru', created_at: new Date().toISOString() };
    demo.surveys.unshift(r);
    return { survey: shapeSurvey(r) };
  }
  const admin = needAdmin();
  const { data, error } = await admin.from('survey_requests').upsert({ ...row, status: 'baru' }, { onConflict: 'uid', ignoreDuplicates: true }).select('*').maybeSingle();
  if (error) throw error;
  return { survey: data ? shapeSurvey(data) : { ...shapeSurvey({ ...row, status: 'baru' }) } };
}

export async function listSurveys({ owner = false, user = null } = {}) {
  if (!backendReady()) return demo.surveys.filter((x) => owner || (user && x.user_id === user.id)).map(shapeSurvey);
  if (!owner && !user) return [];
  const sb = await supabaseServer();
  let qb = sb.from('survey_requests').select('*').order('date', { ascending: true }).limit(300);
  if (!owner) qb = qb.eq('user_id', user.id);
  const { data, error } = await qb;
  if (error) throw error;
  return data.map(shapeSurvey);
}

export async function updateSurvey(uid, status) {
  const st = surveyStatusToDb(status);
  if (!st) return { error: 'Status tidak valid.' };
  if (!backendReady()) { const r = demo.surveys.find((x) => x.uid === uid); if (!r) return { notFound: true }; r.status = st; return { survey: shapeSurvey(r) }; }
  const sb = await supabaseServer();
  const { data, error } = await sb.from('survey_requests').update({ status: st }).eq('uid', uid).select('*').maybeSingle();
  if (error) throw error;
  return data ? { survey: shapeSurvey(data) } : { notFound: true };
}

// ───────── UTJ (uang tanda jadi) ─────────
export const UTJ_STATUS = ['baru', 'invoice', 'bukti', 'ok', 'batal'];
const newInv = () => 'UTJ-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
const shapeUtj = (r, proofUrl) => ({
  inv: r.inv, id: r.property_id, title: r.property_title, name: r.name, phone: to08(r.phone || ''), date: fmtDate(r.created_at), status: r.status,
  amount: Number(r.amount) || 1000000, invoiceNo: r.invoice_no || '',
  ...(r.proof_path || r.proof_demo ? { proof: { name: r.proof_name || 'bukti', src: proofUrl || '', isImg: /^image\//.test(r.proof_type || '') } } : {}),
});
const PROOF_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
const PROOF_MAX = 5 * 1024 * 1024;
// URL bertanda (1 jam) untuk bukti UTJ di bucket privat. RLS storage: hanya owner & pemilik folder yang bisa.
async function signProofs(rows, sb) {
  const paths = rows.map((r) => r.proof_path).filter(Boolean);
  const out = {};
  if (paths.length && sb) {
    const { data } = await sb.storage.from('utj-bukti').createSignedUrls(paths, 3600);
    (data || []).forEach((x) => { if (x.signedUrl) out[x.path] = x.signedUrl; });
  }
  return out;
}
// UTJ hanya untuk rumah & apartemen yang dijual (sama dengan aturan desain).
const utjAllowed = (p) => !!p && p.deal === 'Dijual' && (p.type === 'rumah' || p.type === 'apartemen');

export async function createUtj(b, user) {
  if (!user) return { status: 401, message: 'Masuk dulu untuk mengajukan UTJ.' };
  const p = await getListing(Number(b?.propId) || 0).catch(() => null);
  if (!utjAllowed(p)) return { status: 422, message: 'UTJ hanya untuk rumah dan apartemen yang dijual.' };
  if (!['tayang', 'booked'].includes(p.dbStatus || p.status)) return { status: 422, message: 'Listing ini tidak sedang tayang.' };
  const row = { inv: newInv(), user_id: user.demo ? null : user.id, property_id: p.id, property_title: p.title, name: s(user.name, 120) || 'Calon pembeli', phone: normPhone62(user.phone) || null, status: 'baru' };
  if (!backendReady()) { const r = { id: crypto.randomUUID(), ...row, amount: 1000000, created_at: new Date().toISOString() }; demo.utj.unshift(r); return { utj: shapeUtj(r) }; }
  const admin = needAdmin();
  // Satu permintaan aktif per user per listing (cegah dobel klik).
  const { data: dup } = await admin.from('utj_requests').select('*').eq('user_id', user.id).eq('property_id', p.id).in('status', ['baru', 'invoice', 'bukti']).limit(1).maybeSingle();
  if (dup) return { utj: shapeUtj(dup), existing: true };
  const { data, error } = await admin.from('utj_requests').insert(row).select('*').single();
  if (error) throw error;
  return { utj: shapeUtj(data) };
}

export async function listUtj({ user = null } = {}) {
  if (!backendReady()) return demo.utj.filter((r) => !user || r.user_id === user.id).map((r) => shapeUtj(r, r.proof_demo ? '/api/utj/' + encodeURIComponent(r.inv) + '/bukti' : ''));
  const sb = await supabaseServer();
  let qb = sb.from('utj_requests').select('*').order('created_at', { ascending: false }).limit(300);
  if (user) qb = qb.eq('user_id', user.id);
  const { data, error } = await qb;
  if (error) throw error;
  const signed = await signProofs(data, sb);
  return data.map((r) => shapeUtj(r, signed[r.proof_path]));
}

// Bukti transfer UTJ dari modal "Sudah deal? Bayar UTJ" (user login). File foto/PDF maks. 5 MB -> bucket privat "utj-bukti".
// Status langsung "bukti" (Bukti transfer masuk). Bila user sudah punya permintaan aktif untuk listing ini, bukti ditempel ke situ.
export async function createUtjProof(b, file, user) {
  if (!user) return { status: 401, message: 'Masuk dulu untuk mengirim bukti UTJ.' };
  const p = await getListing(Number(b?.propId) || 0).catch(() => null);
  if (!utjAllowed(p)) return { status: 422, message: 'UTJ hanya untuk rumah dan apartemen yang dijual.' };
  if (!['tayang', 'booked'].includes(p.dbStatus || p.status)) return { status: 422, message: 'Listing ini tidak sedang tayang.' };
  const name = s(b?.name, 120), phone = normPhone62(b?.phone), invoiceNo = s(b?.invoiceNo, 60);
  if (name.length < 3) return { status: 422, message: 'Isi nama lengkap sesuai invoice.' };
  if (!phone) return { status: 422, message: 'Nomor WhatsApp belum valid.' };
  if (!file || typeof file !== 'object' || !file.size) return { status: 422, message: 'Unggah bukti transfer atau invoice UTJ.' };
  if (!PROOF_TYPES[file.type]) return { status: 422, message: 'Bukti harus foto (JPG/PNG/WEBP) atau PDF.' };
  if (file.size > PROOF_MAX) return { status: 422, message: 'Ukuran file maksimal 5 MB.' };
  const base = { property_id: p.id, property_title: p.title, name, phone, invoice_no: invoiceNo || null, status: 'bukti', proof_name: s(file.name, 120), proof_type: file.type, proof_at: new Date().toISOString() };
  if (!backendReady()) {
    demo.utjFiles ??= {};
    const r = { id: crypto.randomUUID(), inv: newInv(), user_id: user.id, amount: 1000000, created_at: new Date().toISOString(), ...base, proof_demo: true };
    demo.utjFiles[r.inv] = { type: file.type, buf: Buffer.from(await file.arrayBuffer()) };
    demo.utj.unshift(r);
    return { utj: shapeUtj(r, '/api/utj/' + encodeURIComponent(r.inv) + '/bukti') };
  }
  const admin = needAdmin();
  const { data: dup } = await admin.from('utj_requests').select('*').eq('user_id', user.id).eq('property_id', p.id).in('status', ['baru', 'invoice', 'bukti']).limit(1).maybeSingle();
  const inv = dup?.inv || newInv();
  const path = `${user.id}/${inv}-${crypto.randomBytes(3).toString('hex')}.${PROOF_TYPES[file.type]}`;
  const up = await admin.storage.from('utj-bukti').upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) { console.error('[utj bukti upload]', up.error); return { status: 500, message: 'Bukti belum terunggah. Coba lagi.' }; }
  const q = dup
    ? admin.from('utj_requests').update({ ...base, proof_path: path }).eq('id', dup.id)
    : admin.from('utj_requests').insert({ ...base, inv, user_id: user.id, proof_path: path });
  const { data, error } = await q.select('*').single();
  if (error) { await admin.storage.from('utj-bukti').remove([path]); throw error; }
  if (dup?.proof_path && dup.proof_path !== path) await admin.storage.from('utj-bukti').remove([dup.proof_path]);
  const sb = await supabaseServer();
  return { utj: shapeUtj(data, (await signProofs([data], sb))[path]) };
}

export async function updateUtj(inv, status) {
  if (!UTJ_STATUS.includes(status)) return { error: 'Status tidak valid.' };
  let r;
  if (!backendReady()) {
    r = demo.utj.find((x) => x.inv === inv);
    if (!r) return { notFound: true };
    r.status = status;
  } else {
    const sb = await supabaseServer();
    const { data, error } = await sb.from('utj_requests').update({ status }).eq('inv', inv).select('*').maybeSingle();
    if (error) throw error;
    if (!data) return { notFound: true };
    r = data;
  }
  // Setelah UTJ terverifikasi, listing otomatis Booked.
  if (status === 'ok' && r.property_id) await updateListing(r.property_id, { status: 'booked' });
  return { utj: shapeUtj(r) };
}

// ───────── Update progres (halaman pembeli) ─────────
const IMG_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' };
const SIGN_SECONDS = 6 * 3600;

async function shapeUpdates(rows, sb) {
  const paths = rows.flatMap((r) => (r.photos || []).map((p) => p.path).filter(Boolean));
  const signed = {};
  if (paths.length && sb) {
    const { data } = await sb.storage.from('progres').createSignedUrls(paths, SIGN_SECONDS);
    (data || []).forEach((x) => { if (x.signedUrl) signed[x.path] = x.signedUrl; });
  }
  const out = {};
  for (const r of rows) {
    const key = String(r.purchase_id);
    (out[key] ||= []).push({
      id: r.id, date: fmtDate(r.created_at), step: r.step, pct: r.pct, note: r.note,
      photos: (r.photos || []).map((p) => ({ name: p.name || '', src: p.src || signed[p.path] || '' })).filter((p) => p.src),
    });
  }
  return out;
}

// { [purchaseId]: [update terbaru dulu] } — RLS membatasi pembeli ke unit miliknya.
export async function listUpdates(purchaseIds) {
  const ids = (purchaseIds || []).map(String);
  if (!ids.length) return {};
  if (!backendReady()) return shapeUpdates(demo.updates.filter((u) => ids.includes(String(u.purchase_id))), null);
  const sb = await supabaseServer();
  const { data, error } = await sb.from('purchase_updates').select('*').in('purchase_id', ids).order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return shapeUpdates(data, sb);
}

export async function createUpdate(purchaseId, b, files, user) {
  const note = s(b.note, 2000);
  if (note.length < 10) return { status: 422, message: 'Tulis catatan update minimal 10 huruf untuk pembeli.' };
  if (files.length > 6) return { status: 422, message: 'Maksimal 6 foto per update.' };
  const bad = checkPhotos(files);
  if (bad) return { status: 422, message: bad };
  const row = {
    purchase_id: purchaseId, note,
    step: Math.min(50, Math.max(0, Math.round(Number(b.step) || 0))),
    pct: Math.min(100, Math.max(0, Math.round(Number(b.pct) || 0))),
    created_by: user && !user.demo ? user.id : null,
  };
  if (!backendReady()) {
    const p = demo.purchases.find((x) => String(x.id) === String(purchaseId));
    if (!p) return { status: 404, message: 'Data pembeli tidak ditemukan.' };
    if (files.length) return { status: 503, message: 'Unggah foto butuh Supabase (mode demo). Kirim update tanpa foto.' };
    const r = { id: crypto.randomUUID(), ...row, photos: [], created_at: new Date().toISOString() };
    demo.updates.unshift(r);
    p.progress = row.pct;
    return { update: (await shapeUpdates([r], null))[String(purchaseId)][0], progress: row.pct };
  }
  const sb = await supabaseServer();
  const { data: pur, error: pe } = await sb.from('purchases').select('id').eq('id', purchaseId).maybeSingle();
  if (pe) throw pe;
  if (!pur) return { status: 404, message: 'Data pembeli tidak ditemukan.' };
  const photos = [];
  for (const f of files) {
    const path = `${purchaseId}/${crypto.randomUUID()}.${IMG_EXT[f.type] || 'jpg'}`;
    const { error } = await sb.storage.from('progres').upload(path, f, { contentType: f.type, upsert: false });
    if (error) { console.error('[progres upload]', error); return { status: 500, message: 'Gagal mengunggah ' + f.name + '.' }; }
    photos.push({ path, name: s(f.name, 120) });
  }
  const { data, error } = await sb.from('purchase_updates').insert({ ...row, photos }).select('*').single();
  if (error) throw error;
  const up = await sb.from('purchases').update({ progress: row.pct }).eq('id', purchaseId);
  if (up.error) throw up.error;
  return { update: (await shapeUpdates([data], sb))[String(purchaseId)][0], progress: row.pct };
}

export async function deleteUpdate(purchaseId, id) {
  if (!backendReady()) { const i = demo.updates.findIndex((u) => u.id === id && String(u.purchase_id) === String(purchaseId)); if (i > -1) demo.updates.splice(i, 1); return i > -1; }
  const sb = await supabaseServer();
  const { data, error } = await sb.from('purchase_updates').delete().eq('id', id).eq('purchase_id', purchaseId).select('photos').maybeSingle();
  if (error) throw error;
  if (!data) return false;
  const paths = (data.photos || []).map((p) => p.path).filter(Boolean);
  if (paths.length) await sb.storage.from('progres').remove(paths);
  return true;
}
