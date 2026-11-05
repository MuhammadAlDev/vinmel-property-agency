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

export function cleanContent(key, v) {
  if (key === 'about') return { name: s(v?.name, 80), bio: s(v?.bio, 1200) };
  if (key === 'stats') return (Array.isArray(v) ? v : []).slice(0, 3).map((x) => [s(x?.[0], 20), s(x?.[1], 40)]);
  if (key === 'testi') return (Array.isArray(v) ? v : []).slice(0, 12).map((x) => ({ name: s(x?.name, 80), prop: s(x?.prop, 120), quote: s(x?.quote, 600) }));
  return null;
}

export async function getContent() {
  if (!backendReady()) return { ...demo.content };
  const sb = await supabaseServer();
  const { data, error } = await sb.from('site_content').select('key, value');
  if (error) throw error;
  const out = {};
  for (const r of data || []) if (r.value != null) out[r.key] = r.value;
  return out;
}

export async function saveContent(key, value, user) {
  const v = cleanContent(key, value);
  if (!backendReady()) { demo.content[key] = v; return v; }
  const sb = await supabaseServer();
  const { error } = await sb.from('site_content').upsert({ key, value: v, updated_by: user?.demo ? null : user?.id || null });
  if (error) throw error;
  return v;
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
const shapeUtj = (r) => ({ inv: r.inv, id: r.property_id, title: r.property_title, name: r.name, phone: to08(r.phone || ''), date: fmtDate(r.created_at), status: r.status, amount: Number(r.amount) || 1000000 });
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

export async function listUtj() {
  if (!backendReady()) return demo.utj.map(shapeUtj);
  const sb = await supabaseServer();
  const { data, error } = await sb.from('utj_requests').select('*').order('created_at', { ascending: false }).limit(300);
  if (error) throw error;
  return data.map(shapeUtj);
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
