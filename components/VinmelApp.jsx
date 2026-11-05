'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import DesignComponent from './DesignComponent';

const to08 = (p) => (String(p || '').startsWith('62') ? '0' + String(p).slice(2) : String(p || ''));
const dots = (v) => String(Math.round(Number(v) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const CONTENT_KEYS = ['about', 'stats', 'testi'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function api(path, opts = {}) {
  const r = await fetch(path, { cache: 'no-store', credentials: 'include', ...opts });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw Object.assign(new Error(j.message || 'Gagal terhubung ke server.'), { status: r.status });
  return j;
}
const send = (path, method, body) => api(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// Pengajuan titip dari backend -> bentuk item TPI di desain.
const titipToDesign = (t) => ({
  id: t.id, db: true, real: true, ref: t.ref, title: t.title || 'Properti tanpa judul', who: t.name || '—', phone: to08(t.phone),
  where: [t.address, t.city].filter(Boolean).join(', '),
  price: t.priceNum ? 'Rp ' + dots(t.priceNum) + (t.deal === 'Disewa' ? ' / bulan' : '') : '—',
  plan: t.plan === 'eksklusif' ? 'Eksklusif' : 'Open listing', stage: t.stage, cover: (t.photoUrls || [])[0] || '', listingId: t.propertyId || null,
});

// Pembungkus DesignComponent: sesi login, data CMS owner & halaman pembeli dari backend (Supabase),
// dan penyimpanan semua aksi CMS (state `cms` di desain) ke API.
export default function VinmelApp({ backend, titipApi, listings: listings0, cmsContent, ...props }) {
  const [user, setUser] = useState(undefined);
  const [owned, setOwned] = useState(null);
  const [listings, setListings] = useState(listings0);
  const [cms, setCmsState] = useState(() => ({ ...(cmsContent || {}) }));
  const [surveys, setSurveys] = useState(undefined);
  const [titip, setTitip] = useState(undefined);
  const [note, setNote] = useState('');
  const cmsRef = useRef(cms);
  const userRef = useRef(user);
  const timers = useRef({});
  userRef.current = user;

  const setCms = useCallback((fn) => {
    const next = typeof fn === 'function' ? fn(cmsRef.current) : fn;
    cmsRef.current = next;
    setCmsState(next);
  }, []);
  const notify = useCallback((t) => { setNote(t); clearTimeout(timers.current.note); timers.current.note = setTimeout(() => setNote(''), 6000); }, []);

  const waOwner = useCallback((msg) => 'https://wa.me/' + String(props.waNumber || '6283182311993').replace(/\D/g, '') + '?text=' + encodeURIComponent(msg), [props.waNumber]);
  const surveyToDesign = useCallback((r) => ({
    ...r, wa: waOwner('Halo owner Vinmel, saya ingin menanyakan jadwal survei ' + r.title + ' pada ' + r.dateLabel + ' · ' + r.slotLabel + ' atas nama ' + r.name + '.'),
  }), [waOwner]);

  const loadTitip = useCallback(async (owner) => {
    const j = await api('/api/titip' + (owner ? '?scope=owner' : '')).catch(() => null);
    if (j) setTitip(j.items.map(titipToDesign));
  }, []);

  const refresh = useCallback(async () => {
    if (!backend) return;
    const me = await api('/api/auth/me').catch(() => null);
    const u = me?.user || null;
    if (!u) {
      try { window.localStorage.removeItem('vinmel_user'); } catch {}
      setUser(null); setOwned(null); setSurveys(undefined); setTitip(undefined);
      setCms((c) => Object.fromEntries(CONTENT_KEYS.filter((k) => k in c).map((k) => [k, c[k]])));
      return;
    }
    setUser({ name: u.name, phone: to08(u.phone), email: u.email, via: u.via, role: u.role });
    if (u.role === 'owner') {
      try {
        const j = await api('/api/cms');
        setCms({ ...j.cms, listing: {}, tpSt: {}, utjSt: {} });
        setListings(j.listings.filter((d) => d.lat != null && d.lng != null));
        setTitip(j.titip.map(titipToDesign));
        setSurveys(j.surveys.map(surveyToDesign));
        setOwned(j.owned.length ? j.owned : null);
      } catch (e) { notify('Data CMS gagal dimuat: ' + e.message); }
      return;
    }
    const [p, sv] = await Promise.all([api('/api/pantau').catch(() => null), api('/api/survei').catch(() => null), loadTitip(false)]);
    setOwned(p?.items?.length ? p.items : null);
    setSurveys(sv ? sv.items.map(surveyToDesign) : undefined);
    setCms((c) => ({
      ...c,
      updates: p?.updates || {},
      progress: Object.fromEntries((p?.items || []).map((o) => [o.key, o.progress])),
      svSt: Object.fromEntries((sv?.items || []).map((r) => [r.uid, r.status])),
    }));
  }, [backend, loadTitip, notify, setCms, surveyToDesign]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const onLogout = useCallback(() => {
    if (!backend) return;
    setUser(null); setOwned(null); setSurveys(undefined); setTitip(undefined);
    setCms((c) => Object.fromEntries(CONTENT_KEYS.filter((k) => k in c).map((k) => [k, c[k]])));
    setListings(listings0);
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  }, [backend, listings0, setCms]);

  // ── Simpan perubahan CMS ke backend ──
  const dropKey = (mapKey, k) => setCms((c) => { const m = { ...(c[mapKey] || {}) }; delete m[k]; return { ...c, [mapKey]: m }; });

  const saveListing = useCallback(async (id, o) => {
    const body = {};
    for (const k of ['title', 'price', 'status', 'video', 'tour']) if (o[k] !== undefined) body[k] = o[k];
    if (o.was !== undefined) body.was = Number(o.was) || 0;
    try {
      const j = await send('/api/cms/listing/' + id, 'PATCH', body);
      setListings((list) => list.map((d) => (d.id === j.item.id ? j.item : d)));
    } catch (e) {
      notify('Listing belum tersimpan: ' + e.message);
    }
    dropKey('listing', String(id));
  }, [notify]); // eslint-disable-line react-hooks/exhaustive-deps

  const postUpdate = useCallback(async (key, u) => {
    const fd = new FormData();
    fd.append('step', String(u.step)); fd.append('pct', String(u.pct)); fd.append('note', u.note);
    try {
      for (const ph of u.photos || []) {
        if (!ph?.src) continue;
        const blob = await fetch(ph.src).then((r) => r.blob());
        fd.append('photos', new File([blob], ph.name || 'foto.jpg', { type: blob.type || 'image/jpeg' }));
      }
      const j = await api('/api/pantau/' + encodeURIComponent(key) + '/updates', { method: 'POST', body: fd });
      setCms((c) => ({ ...c, updates: { ...c.updates, [key]: (c.updates?.[key] || []).map((x) => (x.id === u.id ? j.item : x)) }, progress: { ...c.progress, [key]: j.progress } }));
    } catch (e) {
      notify('Update belum terbit: ' + e.message);
      setCms((c) => ({ ...c, updates: { ...c.updates, [key]: (c.updates?.[key] || []).filter((x) => x.id !== u.id) } }));
    }
  }, [notify, setCms]);

  const onCms = useCallback((patch) => {
    const prev = cmsRef.current;
    const next = { ...prev, ...patch };
    setCms(next);
    if (userRef.current?.role !== 'owner') return;
    const changed = (k) => Object.keys(next[k] || {}).filter((x) => !same((prev[k] || {})[x], next[k][x]));

    if ('listing' in patch) changed('listing').forEach((id) => saveListing(id, next.listing[id]));
    if ('tpSt' in patch) {
      changed('tpSt').forEach((ref) => {
        const it = (titip || []).find((x) => x.ref === ref);
        if (!it) return;
        const stage = next.tpSt[ref];
        send('/api/titip/' + it.id, 'PATCH', { stage })
          .then(() => setTitip((list) => (list || []).map((x) => (x.ref === ref ? { ...x, stage } : x))))
          .catch((e) => notify('Tahap titip belum tersimpan: ' + e.message))
          .finally(() => dropKey('tpSt', ref));
      });
    }
    if ('svSt' in patch) {
      changed('svSt').forEach((uid) => send('/api/survei/' + encodeURIComponent(uid), 'PATCH', { status: next.svSt[uid] }).catch((e) => {
        notify('Status survei belum tersimpan: ' + e.message);
        setCms((c) => ({ ...c, svSt: { ...c.svSt, [uid]: (prev.svSt || {})[uid] || 'baru' } }));
      }));
    }
    if ('utjSt' in patch) {
      changed('utjSt').forEach((inv) => {
        const status = next.utjSt[inv];
        send('/api/utj/' + encodeURIComponent(inv), 'PATCH', { status })
          .then(() => setCms((c) => ({ ...c, utj: (c.utj || []).map((x) => (x.inv === inv ? { ...x, status } : x)) })))
          .catch((e) => notify('Status UTJ belum tersimpan: ' + e.message))
          .finally(() => dropKey('utjSt', inv));
      });
    }
    if ('updates' in patch) {
      for (const key of new Set([...Object.keys(prev.updates || {}), ...Object.keys(next.updates || {})])) {
        const a = prev.updates?.[key] || [], b = next.updates?.[key] || [];
        b.filter((u) => !a.some((x) => x.id === u.id)).forEach((u) => postUpdate(key, u));
        a.filter((u) => !b.some((x) => x.id === u.id) && !/^up\d+$/.test(u.id)).forEach((u) =>
          api('/api/pantau/' + encodeURIComponent(key) + '/updates/' + u.id, { method: 'DELETE' }).catch((e) => notify('Update belum terhapus: ' + e.message)));
      }
    }
    // Konten diketik per huruf -> simpan setelah jeda.
    CONTENT_KEYS.filter((k) => k in patch).forEach((k) => {
      clearTimeout(timers.current[k]);
      timers.current[k] = setTimeout(() => send('/api/cms/konten', 'PUT', { [k]: cmsRef.current[k] }).catch((e) => notify('Konten belum tersimpan: ' + e.message)), 800);
    });
  }, [notify, postUpdate, saveListing, setCms, titip]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSurvey = useCallback((rec) => {
    send('/api/survei', 'POST', rec).then((j) => {
      if (userRef.current) {
        setSurveys((list) => [surveyToDesign({ ...rec, ...j.item }), ...(list || []).filter((x) => x.uid !== rec.uid)]);
        setCms((c) => ({ ...c, svSt: { ...c.svSt, [rec.uid]: 'baru' } }));
      }
    }).catch((e) => notify('Jadwal survei belum tercatat di sistem (' + e.message + '). Tetap konfirmasi lewat WhatsApp.'));
  }, [notify, setCms, surveyToDesign]);

  const onUtjRequest = useCallback((d) => {
    if (!userRef.current) { notify('Masuk dulu supaya permintaan UTJ tercatat di akunmu. Pesan WhatsApp tetap terkirim ke owner.'); return; }
    send('/api/utj', 'POST', { propId: d.id }).then((j) => {
      notify((j.existing ? 'Permintaan UTJ sudah tercatat: ' : 'Permintaan UTJ tercatat: ') + j.item.inv + '. Owner mengirim invoice lewat WhatsApp.');
      if (userRef.current?.role === 'owner' && !j.existing) setCms((c) => ({ ...c, utj: [j.item, ...(c.utj || [])] }));
    }).catch((e) => notify('Permintaan UTJ belum tercatat: ' + e.message));
  }, [notify, setCms]);

  const onSubmitTitip = useCallback(async (tp) => {
    const { photos = [], ...rest } = tp;
    const fd = new FormData();
    fd.append('data', JSON.stringify(rest));
    for (const ph of photos) {
      if (!ph?.src) continue;
      const blob = await fetch(ph.src).then((r) => r.blob());
      fd.append('photos', new File([blob], ph.name || 'foto.jpg', { type: blob.type || 'image/jpeg' }));
    }
    const r = await fetch('/api/titip', { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.message || 'Pengajuan belum terkirim. Coba lagi.');
    if (userRef.current) loadTitip(userRef.current.role === 'owner');
    return { ref: j.ref };
  }, [loadTitip]);

  const tpSt = cms.tpSt || {};
  const titipItems = titip ? titip.map((t) => (tpSt[t.ref] != null ? { ...t, stage: tpSt[t.ref] } : t)) : undefined;

  return (
    <>
      <DesignComponent
        {...props}
        listings={listings}
        authApi={backend ? '/api' : ''}
        sessionUser={backend ? user : undefined}
        owned={owned}
        onLogin={refresh}
        onLogout={onLogout}
        onSubmitTitip={titipApi ? onSubmitTitip : undefined}
        live={!!backend}
        cms={backend ? cms : undefined}
        onCms={backend ? onCms : undefined}
        surveys={backend && user ? surveys : undefined}
        onSurvey={backend ? onSurvey : undefined}
        onUtjRequest={backend ? onUtjRequest : undefined}
        titipItems={backend && user ? titipItems : undefined}
      />
      {note ? (
        <div role="status" style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 88, zIndex: 120, maxWidth: 'min(520px, calc(100vw - 32px))', background: '#1B2420', color: '#FFFFFF', padding: '12px 16px', borderRadius: 12, fontSize: 14, lineHeight: 1.45, boxShadow: '0 8px 24px rgba(0,0,0,.22)' }}>
          {note}
        </div>
      ) : null}
    </>
  );
}
