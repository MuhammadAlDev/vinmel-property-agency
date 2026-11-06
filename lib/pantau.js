import 'server-only';
import { backendReady } from './config';
import { supabaseServer } from './supabase/server';
import { demo } from './demo-store';
import { normPhone62 } from './format';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const fmtDate = (iso) => { if (!iso) return ''; const d = new Date(iso); return String(d.getDate()).padStart(2, '0') + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); };
const STATES = ['done', 'current', 'next'];
const to08 = (v) => (String(v || '').startsWith('62') ? '0' + String(v).slice(2) : String(v || ''));

// Bentuk data "Pantau properti" untuk CMS & API (photos = [{src,label,date}]).
function rowToPurchase(p) {
  const steps = (p.purchase_steps || []).slice().sort((a, b) => a.position - b.position);
  // Tahap tambahan dari CMS (is_custom) dikirim terpisah: desain menyisipkannya sendiri sebelum tahap terakhir.
  const custom = steps.filter((x) => x.kind === 'build' && x.is_custom);
  const pick = (kind) => steps.filter((s) => s.kind === kind && !s.is_custom).map((s) => ({
    title: s.title, date: s.date_text, state: s.state, ...(s.pct != null ? { pct: s.pct } : {}), note: s.note, doc: s.doc, photos: s.photos || [],
  }));
  return {
    id: p.id, key: p.id, buyerId: p.buyer_id, buyerPhone: p.buyer_phone || '', buyerEmail: p.buyer_email || '', propertyId: p.property_id,
    title: p.title, unit: p.unit, location: p.location, cover: p.cover || '/placeholder-properti.svg', progress: p.progress, statusText: p.status_text,
    purchased: p.purchased_on || '', handover: p.handover || '', updated: fmtDate(p.updated_at), notary: p.notary || {},
    steps: pick('build'), legal: pick('legal'),
    customSteps: custom.map((x) => ({ id: x.custom_id || 'st' + x.id, title: x.title, date: x.date_text, note: x.note, state: x.state })),
    handoverAt: p.handover_at || null, handoverDate: p.handover_at ? fmtDate(p.handover_at) : '', buyerName: p.buyerName || '',
  };
}

// Bentuk yang dipakai DesignComponent (photos = [[src, label, date]]).
export function toDesignOwned(p) {
  return {
    key: String(p.id || p.key), id: p.id, title: p.title, unit: p.unit, location: p.location, cover: p.cover, progress: p.progress,
    statusText: p.statusText, purchased: p.purchased, handover: p.handover, updated: p.updated,
    buyer: p.buyerName || (p.buyerPhone ? to08(p.buyerPhone) : '') || p.buyerEmail || 'Belum tertaut ke akun pembeli',
    customSteps: p.customSteps || [], handoverDate: p.handoverDate || '',
    notary: { name: '', address: '', phone: '', hours: '', ...(p.notary || {}) },
    legal: (p.legal || []).map((x) => ({ title: x.title, date: x.date, state: x.state, pct: x.pct, note: x.note, doc: x.doc || '' })),
    steps: (p.steps || []).map((x) => ({ title: x.title, date: x.date, state: x.state, pct: x.pct, note: x.note, photos: (x.photos || []).map((ph) => [ph.src, ph.label || '', ph.date || '']) })),
  };
}

const SELECT = '*, purchase_steps(*)';

export async function listPurchases({ owner = false, user = null } = {}) {
  if (!backendReady()) return owner || user?.demo ? demo.purchases : [];
  const sb = await supabaseServer();
  let qb = sb.from('purchases').select(SELECT).order('created_at', { ascending: false });
  if (!owner && user) qb = qb.eq('buyer_id', user.id);
  const { data, error } = await qb;
  if (error) throw error;
  if (owner) {
    // Nama pembeli untuk daftar pembeli di CMS (owner boleh membaca semua profil).
    const ids = [...new Set(data.map((p) => p.buyer_id).filter(Boolean))];
    if (ids.length) {
      const { data: profs } = await sb.from('profiles').select('id, full_name').in('id', ids);
      const nm = Object.fromEntries((profs || []).map((x) => [x.id, x.full_name]));
      data.forEach((p) => { p.buyerName = nm[p.buyer_id] || ''; });
    }
  }
  return data.map(rowToPurchase);
}

// ───────── Progres dari CMS (Revisi 2): tahap tambahan, status tahap, serah terima ─────────
// b = { extraSteps?: [{id,title,date,note}], stepState?: { [judul]: {state,pct?} }, handover?: {date}|null }
export async function saveProgress(purchaseId, b) {
  const clean = (list) => (Array.isArray(list) ? list : []).slice(0, 10).map((x) => ({
    id: s(x?.id, 40) || 'st' + Date.now(), title: s(x?.title, 120), date: s(x?.date, 60), note: s(x?.note, 1000),
  })).filter((x) => x.title.length >= 3);
  const states = b.stepState && typeof b.stepState === 'object' ? Object.entries(b.stepState).slice(0, 60)
    .map(([t, v]) => [s(t, 120), STATES.includes(v?.state) ? v.state : null, v?.pct != null ? Math.min(100, Math.max(0, Math.round(Number(v.pct) || 0))) : null])
    .filter((x) => x[1]) : null;
  const ho = 'handover' in b ? (b.handover ? new Date().toISOString() : null) : undefined;

  if (!backendReady()) {
    const p = demo.purchases.find((x) => String(x.id) === String(purchaseId));
    if (!p) return { notFound: true };
    if (b.extraSteps) p.customSteps = clean(b.extraSteps).map((x) => ({ ...x, state: 'next' }));
    if (states) for (const [t, st, pct] of states) {
      for (const x of p.steps) if (x.title === t) { x.state = st; if (pct != null) x.pct = pct; }
      for (const x of p.customSteps || []) if (x.title === t) x.state = st;
    }
    if (ho !== undefined) { p.handoverAt = ho; p.handoverDate = ho ? fmtDate(ho) : ''; if (ho) p.progress = 100; }
    return { purchase: p };
  }
  const sb = await supabaseServer();
  const { data: pur, error: pe } = await sb.from('purchases').select(SELECT).eq('id', purchaseId).maybeSingle();
  if (pe) throw pe;
  if (!pur) return { notFound: true };
  if (b.extraSteps) {
    const build = (pur.purchase_steps || []).filter((x) => x.kind === 'build').sort((a, c) => a.position - c.position);
    const base = build.filter((x) => !x.is_custom);
    const del = await sb.from('purchase_steps').delete().eq('purchase_id', purchaseId).eq('kind', 'build').eq('is_custom', true);
    if (del.error) throw del.error;
    const ex = clean(b.extraSteps);
    const prevState = Object.fromEntries(build.filter((x) => x.is_custom).map((x) => [x.custom_id, x.state]));
    // Urutan: tahap bawaan kecuali terakhir, tahap tambahan, lalu tahap terakhir (serah terima kunci).
    const order = [...base.slice(0, -1).map((x) => ({ id: x.id })), ...ex.map((x) => ({ custom: x })), ...base.slice(-1).map((x) => ({ id: x.id }))];
    for (const [i, o] of order.entries()) {
      if (o.id) { const r = await sb.from('purchase_steps').update({ position: i }).eq('id', o.id); if (r.error) throw r.error; continue; }
      const r = await sb.from('purchase_steps').insert({
        purchase_id: purchaseId, kind: 'build', position: i, title: o.custom.title, date_text: o.custom.date, note: o.custom.note,
        state: prevState[o.custom.id] || 'next', is_custom: true, custom_id: o.custom.id,
      });
      if (r.error) throw r.error;
    }
  }
  if (states) for (const [t, st, pct] of states) {
    const r = await sb.from('purchase_steps').update({ state: st, ...(pct != null ? { pct } : {}) }).eq('purchase_id', purchaseId).eq('kind', 'build').eq('title', t);
    if (r.error) throw r.error;
  }
  if (ho !== undefined) {
    const r = await sb.from('purchases').update(ho ? { handover_at: ho, progress: 100, status_text: 'Selesai · serah terima ' + fmtDate(ho) } : { handover_at: null }).eq('id', purchaseId);
    if (r.error) throw r.error;
    if (ho) { const r2 = await sb.from('purchase_steps').update({ state: 'done' }).eq('purchase_id', purchaseId).eq('kind', 'build'); if (r2.error) throw r2.error; }
  }
  const { data, error } = await sb.from('purchases').select(SELECT).eq('id', purchaseId).single();
  if (error) throw error;
  return { purchase: rowToPurchase(data) };
}

const s = (v, max = 300) => String(v ?? '').trim().slice(0, max);
function cleanSteps(list, kind) {
  return (Array.isArray(list) ? list : []).slice(0, 30).map((x, i) => ({
    kind, position: i, title: s(x.title, 120) || 'Tahap ' + (i + 1), date_text: s(x.date, 60),
    state: STATES.includes(x.state) ? x.state : 'next',
    pct: x.state === 'current' && x.pct !== '' && x.pct != null ? Math.min(100, Math.max(0, Math.round(Number(x.pct) || 0))) : null,
    note: s(x.note, 1000), doc: s(x.doc, 200),
    photos: (Array.isArray(x.photos) ? x.photos : []).slice(0, 12)
      .map((p) => ({ src: s(p.src, 500), label: s(p.label, 120), date: s(p.date, 40) }))
      .filter((p) => /^(https:\/\/|\/)/.test(p.src)),
  }));
}

export function validatePurchase(b) {
  const errors = {};
  const row = {
    title: s(b.title, 140), unit: s(b.unit, 60), location: s(b.location, 160), cover: s(b.cover, 500) || null,
    progress: Math.min(100, Math.max(0, Math.round(Number(b.progress) || 0))), status_text: s(b.statusText, 120),
    purchased_on: s(b.purchased, 40), handover: s(b.handover, 40),
    buyer_phone: b.buyerPhone ? normPhone62(b.buyerPhone) : null, buyer_email: s(b.buyerEmail, 160).toLowerCase() || null,
    property_id: b.propertyId ? Number(b.propertyId) || null : null,
    notary: { name: s(b.notary?.name, 120), address: s(b.notary?.address, 240), phone: s(b.notary?.phone, 40), hours: s(b.notary?.hours, 80) },
  };
  if (row.title.length < 3) errors.title = 'Isi judul properti.';
  if (b.buyerPhone && !row.buyer_phone) errors.buyerPhone = 'Nomor WA pembeli belum valid (contoh 0812xxxxxxx).';
  if (row.cover && !/^(https:\/\/|\/)/.test(row.cover)) errors.cover = 'URL foto sampul harus https:// atau /assets/…';
  const steps = [...cleanSteps(b.steps, 'build'), ...cleanSteps(b.legal, 'legal')];
  return { row, steps, errors, valid: !Object.keys(errors).length };
}

export async function savePurchase(id, b) {
  const v = validatePurchase(b);
  if (!v.valid) return { errors: v.errors };
  if (!backendReady()) {
    const shaped = rowToPurchase({ ...v.row, id: id || 'demo-' + Date.now(), updated_at: new Date().toISOString(), purchase_steps: v.steps });
    const i = demo.purchases.findIndex((p) => p.id === id);
    if (i > -1) demo.purchases[i] = shaped; else demo.purchases.unshift(shaped);
    return { purchase: shaped };
  }
  const sb = await supabaseServer();
  let pid = id;
  if (pid) {
    const { error } = await sb.from('purchases').update(v.row).eq('id', pid);
    if (error) throw error;
  } else {
    const { data, error } = await sb.from('purchases').insert(v.row).select('id').single();
    if (error) throw error;
    pid = data.id;
  }
  // Tautkan ke akun pembeli yang sudah terdaftar (nomor WA / email).
  if (v.row.buyer_phone || v.row.buyer_email) {
    let pq = sb.from('profiles').select('id').limit(1);
    pq = v.row.buyer_phone ? pq.eq('phone', v.row.buyer_phone) : pq.eq('email', v.row.buyer_email);
    const { data: prof } = await pq.maybeSingle();
    await sb.from('purchases').update({ buyer_id: prof?.id || null }).eq('id', pid);
  }
  // Tahap tambahan dari CMS (is_custom) tidak disentuh form lama.
  const del = await sb.from('purchase_steps').delete().eq('purchase_id', pid).eq('is_custom', false);
  if (del.error) throw del.error;
  if (v.steps.length) {
    const ins = await sb.from('purchase_steps').insert(v.steps.map((x) => ({ ...x, purchase_id: pid })));
    if (ins.error) throw ins.error;
  }
  const { data, error } = await sb.from('purchases').select(SELECT).eq('id', pid).single();
  if (error) throw error;
  return { purchase: rowToPurchase(data) };
}

export async function deletePurchase(id) {
  if (!backendReady()) { const i = demo.purchases.findIndex((p) => p.id === id); if (i > -1) demo.purchases.splice(i, 1); return i > -1; }
  const sb = await supabaseServer();
  const { error, count } = await sb.from('purchases').delete({ count: 'exact' }).eq('id', id);
  if (error) throw error;
  return count > 0;
}
