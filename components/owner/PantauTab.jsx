'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

const STATES = [['done', 'Selesai'], ['current', 'Sedang berjalan'], ['next', 'Akan datang']];
const EMPTY = { buyerPhone: '', buyerEmail: '', title: '', unit: '', location: '', cover: '', progress: 0, statusText: '', purchased: '', handover: '',
  notary: { name: '', address: '', phone: '', hours: 'Senin – Jumat, 08.30 – 16.30' }, steps: [], legal: [] };
const photosToText = (ps) => (ps || []).map((p) => [p.src, p.label, p.date].join(' | ')).join('\n');
const textToPhotos = (t) => String(t || '').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((a) => a[0]).map(([src, label = '', date = '']) => ({ src, label, date }));

function StepEditor({ title, list, onChange, withPhotos, withDoc }) {
  const upd = (i, patch) => onChange(list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i, d) => { const a = list.slice(); const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; onChange(a); };
  return (
    <div className="full" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="ow-row"><h3 className="ow-h2" style={{ margin: 0, fontSize: 16 }}>{title}</h3><span className="ow-spacer" />
        <button type="button" className="ow-btn ghost" onClick={() => onChange([...list, { title: '', date: '', state: 'next', note: '', doc: '', photos: [], photosText: '' }])}>+ Tahap</button></div>
      {list.map((s, i) => (
        <div key={i} className="ow-step">
          <label className="ow-field">Judul tahap<input value={s.title} onChange={(e) => upd(i, { title: e.target.value })} /></label>
          <label className="ow-field">Tanggal / periode<input value={s.date} onChange={(e) => upd(i, { date: e.target.value })} placeholder="Agu – Nov 2026" /></label>
          <label className="ow-field">Status<select value={s.state} onChange={(e) => upd(i, { state: e.target.value })}>{STATES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          {s.state === 'current' ? <label className="ow-field">Progres tahap (%)<input value={s.pct ?? ''} onChange={(e) => upd(i, { pct: e.target.value.replace(/\D/g, '').slice(0, 3) })} inputMode="numeric" /></label> : null}
          <label className="ow-field" style={{ gridColumn: '1 / -1' }}>Catatan<textarea value={s.note} onChange={(e) => upd(i, { note: e.target.value })} style={{ minHeight: 60 }} /></label>
          {withDoc ? <label className="ow-field">Dokumen / nomor<input value={s.doc || ''} onChange={(e) => upd(i, { doc: e.target.value })} placeholder="No. PBG: …" /></label> : null}
          {withPhotos ? <label className="ow-field" style={{ gridColumn: '1 / -1' }}>Foto progres (per baris: URL | keterangan | tanggal)
            <textarea value={s.photosText ?? photosToText(s.photos)} onChange={(e) => upd(i, { photosText: e.target.value })} style={{ minHeight: 60 }} placeholder="/assets/foto.jpg | Struktur lantai 2 | 24 Jul 2026" /></label> : null}
          <div className="ow-row" style={{ gap: 6 }}>
            <button type="button" className="ow-btn ghost" onClick={() => move(i, -1)} aria-label="Naikkan">↑</button>
            <button type="button" className="ow-btn ghost" onClick={() => move(i, 1)} aria-label="Turunkan">↓</button>
            <button type="button" className="ow-btn danger" onClick={() => onChange(list.filter((_, j) => j !== i))}>Hapus</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PantauTab({ notify }) {
  const [items, setItems] = useState(null);
  const [edit, setEdit] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => { api('/api/pantau?scope=owner').then((j) => setItems(j.items)).catch((e) => notify(e.message)); }, [notify]);
  useEffect(() => { load(); }, [load]);

  const set = (patch) => setEdit((e) => ({ ...e, form: { ...e.form, ...patch } }));
  const save = async () => {
    setBusy(true); setErrors({});
    const f = edit.form;
    const body = { ...f, steps: f.steps.map((s) => ({ ...s, photos: s.photosText != null ? textToPhotos(s.photosText) : s.photos })) };
    try {
      if (edit.id) await api('/api/pantau/' + edit.id, { method: 'PATCH', body });
      else await api('/api/pantau', { method: 'POST', body });
      notify('Data pembeli tersimpan.'); setEdit(null); load();
    } catch (e) { setErrors(e.errors || {}); notify(e.message); }
    setBusy(false);
  };
  const remove = async (p) => {
    if (!window.confirm('Hapus data pantau "' + p.title + ' ' + p.unit + '"?')) return;
    try { await api('/api/pantau/' + p.id, { method: 'DELETE' }); notify('Dihapus.'); load(); } catch (e) { notify(e.message); }
  };

  const F = edit?.form;
  const inp = (label, key, ph) => (
    <label className="ow-field">{label}<input value={F[key] ?? ''} onChange={(e) => set({ [key]: e.target.value })} placeholder={ph} />{errors[key] ? <span className="err">{errors[key]}</span> : null}</label>
  );

  return (
    <>
      <div className="ow-row"><h1 className="ow-h1">Pantau pembeli</h1><span className="ow-spacer" />
        <button className="ow-btn" onClick={() => { setErrors({}); setEdit({ id: null, form: JSON.parse(JSON.stringify(EMPTY)) }); }}>+ Tambah pembeli</button></div>
      <p className="ow-muted" style={{ margin: 0 }}>Pembeli melihat data ini di bagian "Pantau properti saya" setelah masuk dengan nomor WA / email Google yang sama.</p>
      <div className="ow-card">
        {!items ? <p className="ow-muted">Memuat…</p> : !items.length ? <p className="ow-muted">Belum ada data pembeli.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="ow-table">
              <thead><tr><th></th><th>Properti</th><th className="hide-sm">Pembeli</th><th>Progres</th><th></th></tr></thead>
              <tbody>{items.map((p) => (
                <tr key={p.id}>
                  <td><img className="ow-thumb" src={p.cover} alt="" /></td>
                  <td><b>{p.title}</b> {p.unit}<div className="ow-muted">{p.location} · diperbarui {p.updated || '—'}</div></td>
                  <td className="hide-sm">{p.buyerPhone || p.buyerEmail || <span className="ow-muted">Belum ditautkan</span>}{p.buyerId ? <div><span className="ow-badge tayang">Akun terhubung</span></div> : null}</td>
                  <td><b>{p.progress}%</b><div className="ow-muted">{p.statusText}</div></td>
                  <td><div className="ow-row" style={{ gap: 6 }}>
                    <button className="ow-btn ghost" onClick={() => { setErrors({}); setEdit({ id: p.id, form: JSON.parse(JSON.stringify({ ...EMPTY, ...p })) }); }}>Ubah progres</button>
                    <button className="ow-btn danger" onClick={() => remove(p)}>Hapus</button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
      {edit ? (
        <div className="ow-modal" role="dialog" aria-modal="true" aria-label="Data pembeli">
          <div className="ow-card">
            <div className="ow-row" style={{ marginBottom: 12 }}><h2 className="ow-h2" style={{ margin: 0 }}>{edit.id ? 'Ubah progres pembeli' : 'Tambah pembeli'}</h2><span className="ow-spacer" /><button className="ow-btn ghost" onClick={() => setEdit(null)}>Tutup</button></div>
            <div className="ow-form">
              {inp('No. WhatsApp pembeli', 'buyerPhone', '0812xxxxxxx')}
              {inp('Email Google pembeli (opsional)', 'buyerEmail', 'nama@gmail.com')}
              {inp('Judul properti', 'title', 'Rumah Minimalis 2 Lantai')}
              {inp('Unit / kavling', 'unit', 'Unit B-12')}
              {inp('Lokasi', 'location', 'Bintaro, Tangerang Selatan')}
              {inp('URL foto sampul', 'cover', '/assets/… atau https://…')}
              <label className="ow-field">Progres total (%)<input value={F.progress} onChange={(e) => set({ progress: e.target.value.replace(/\D/g, '').slice(0, 3) })} inputMode="numeric" /></label>
              {inp('Status singkat', 'statusText', 'Tahap dinding & atap')}
              {inp('Tanggal pembelian', 'purchased', '12 Jan 2026')}
              {inp('Estimasi serah terima', 'handover', 'Mar 2027')}
              <label className="ow-field">Notaris<input value={F.notary.name} onChange={(e) => set({ notary: { ...F.notary, name: e.target.value } })} /></label>
              <label className="ow-field">Alamat notaris<input value={F.notary.address} onChange={(e) => set({ notary: { ...F.notary, address: e.target.value } })} /></label>
              <label className="ow-field">Telepon notaris<input value={F.notary.phone} onChange={(e) => set({ notary: { ...F.notary, phone: e.target.value } })} /></label>
              <label className="ow-field">Jam layanan notaris<input value={F.notary.hours} onChange={(e) => set({ notary: { ...F.notary, hours: e.target.value } })} /></label>
              <StepEditor title="Tahap pembangunan" list={F.steps} onChange={(steps) => set({ steps })} withPhotos />
              <StepEditor title="Tahap legalitas" list={F.legal} onChange={(legal) => set({ legal })} withDoc />
            </div>
            <div className="ow-row" style={{ marginTop: 16 }}>
              <button className="ow-btn" onClick={save} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
              <button className="ow-btn ghost" onClick={() => setEdit(null)}>Batal</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
