'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, rp } from './api';
import CityPicker from './CityPicker';

const STATUSES = [['draft', 'Draft'], ['tayang', 'Tayang'], ['terjual', 'Terjual'], ['tersewa', 'Tersewa'], ['arsip', 'Arsip']];
const TYPES = [['rumah', 'Rumah'], ['kos', 'Kos'], ['apartemen', 'Apartemen'], ['tanah', 'Tanah']];
const CERTS = ['SHM', 'HGB', 'Strata', 'Girik / AJB', 'Lainnya'];

const EMPTY = { title: '', type: 'rumah', deal: 'Dijual', location: '', city: '', province: '', wilayahCode: '', priceNum: '', unit: '', ltNum: '', lbNum: '', ktNum: '', kmLabel: '', cert: 'SHM', lat: '', lng: '', photos: '', description: '', fasilitas: '', status: 'draft', featured: false,
  ext: { pay: '', build: '', reno: false, facing: '', floors: '', was: '', unitType: '', lv: 'proses', pbb: '', imb: '', isNew: false, dev: '' } };

function toForm(d) {
  return {
    ...EMPTY, title: d.title, type: d.type, deal: d.deal, location: d.location, city: d.city, province: d.province || '', wilayahCode: d.wilayahCode || '',
    priceNum: d.priceNum, unit: d.unit || '', ltNum: d.ltNum || '', lbNum: d.lbNum || '', ktNum: d.ktNum || '', kmLabel: d.km === '—' ? '' : d.km, cert: d.cert, lat: d.lat ?? '', lng: d.lng ?? '',
    photos: (d.photos || []).filter((p) => !p.includes('placeholder')).join('\n'), description: (d.desc || []).join('\n\n'), fasilitas: (d.fasilitas || []).join(', '),
    status: d.status, featured: !!d.featured, ext: { ...EMPTY.ext, ...d.ext, floors: d.ext?.floors || '', was: d.ext?.was || '', unitType: d.ext?.unitType || '' },
  };
}

export default function ListingTab({ notify, demo }) {
  const [items, setItems] = useState(null);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(null); // { id|null, form }
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api('/api/properties?scope=owner' + (status ? '&status=' + status : '') + (q ? '&q=' + encodeURIComponent(q) : ''))
      .then((j) => setItems(j.items)).catch((e) => notify(e.message));
  }, [status, q, notify]);
  useEffect(() => { load(); }, [load]);

  const set = (patch) => setEdit((e) => ({ ...e, form: { ...e.form, ...patch } }));
  const setExt = (patch) => setEdit((e) => ({ ...e, form: { ...e.form, ext: { ...e.form.ext, ...patch } } }));

  const save = async () => {
    setBusy(true); setErrors({});
    const f = edit.form;
    const body = { ...f, photos: f.photos.split('\n').map((x) => x.trim()).filter(Boolean), kmLabel: f.kmLabel || null, ext: { ...f.ext } };
    if (f.deal === 'Disewa' && !f.unit) body.unit = '/bulan';
    try {
      if (edit.id) await api('/api/properties/' + edit.id, { method: 'PATCH', body });
      else await api('/api/properties', { method: 'POST', body });
      notify('Listing tersimpan.'); setEdit(null); load();
    } catch (e) { setErrors(e.errors || {}); notify(e.message); }
    setBusy(false);
  };
  const quick = async (d, patch, msg) => {
    try { await api('/api/properties/' + d.id, { method: 'PATCH', body: patch }); notify(msg); load(); } catch (e) { notify(e.message); }
  };
  const remove = async (d) => {
    if (!window.confirm('Hapus listing "' + d.title + '"? Tindakan ini tidak bisa dibatalkan.')) return;
    try { await api('/api/properties/' + d.id, { method: 'DELETE' }); notify('Listing dihapus.'); load(); } catch (e) { notify(e.message); }
  };
  const upload = async (files) => {
    const fd = new FormData();
    [...files].forEach((f) => fd.append('photos', f));
    try { const j = await api('/api/upload', { method: 'POST', form: fd }); set({ photos: [edit.form.photos, ...j.urls].filter(Boolean).join('\n') }); notify(j.urls.length + ' foto diunggah.'); }
    catch (e) { notify(e.message); }
  };

  const F = edit?.form;
  const field = (label, key, props = {}) => (
    <label className={'ow-field' + (props.full ? ' full' : '')}>{label}
      {props.textarea ? <textarea value={F[key]} onChange={(e) => set({ [key]: e.target.value })} /> : <input value={F[key]} onChange={(e) => set({ [key]: e.target.value })} inputMode={props.num ? 'decimal' : undefined} placeholder={props.ph} />}
      {props.hint ? <span className="ow-muted">{props.hint}</span> : null}
      {errors[key] ? <span className="err">{errors[key]}</span> : null}
    </label>
  );

  return (
    <>
      <div className="ow-row">
        <h1 className="ow-h1">Listing properti</h1><span className="ow-spacer" />
        <button className="ow-btn" onClick={() => { setErrors({}); setEdit({ id: null, form: { ...EMPTY, ext: { ...EMPTY.ext } } }); }}>+ Tambah listing</button>
      </div>
      <div className="ow-card">
        <div className="ow-row" style={{ marginBottom: 12 }}>
          <label className="ow-field" style={{ flex: '1 1 240px' }}>Cari<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Judul, lokasi, kota" /></label>
          <label className="ow-field">Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Semua</option>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        </div>
        {!items ? <p className="ow-muted">Memuat…</p> : !items.length ? <p className="ow-muted">Belum ada listing.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="ow-table">
              <thead><tr><th></th><th>Properti</th><th className="hide-sm">Kota</th><th>Harga</th><th>Status</th><th className="hide-sm">Pilihan</th><th></th></tr></thead>
              <tbody>
                {items.map((d) => (
                  <tr key={d.id}>
                    <td><img className="ow-thumb" src={d.photos[0]} alt="" /></td>
                    <td><b>{d.title}</b><div className="ow-muted">{TYPES.find((t) => t[0] === d.type)?.[1]} · {d.deal} · {d.location}</div></td>
                    <td className="hide-sm">{d.city}</td>
                    <td>{d.price}{d.unit ? ' ' + d.unit : ''}</td>
                    <td><select aria-label={'Status ' + d.title} value={d.status} onChange={(e) => quick(d, { status: e.target.value }, 'Status diubah.')}>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
                    <td className="hide-sm"><input type="checkbox" aria-label={'Tampilkan ' + d.title + ' di listing pilihan'} checked={!!d.featured} onChange={(e) => quick(d, { featured: e.target.checked }, e.target.checked ? 'Masuk listing pilihan.' : 'Dikeluarkan dari listing pilihan.')} /></td>
                    <td><div className="ow-row" style={{ gap: 6 }}>
                      <button className="ow-btn ghost" onClick={() => { setErrors({}); setEdit({ id: d.id, form: toForm(d) }); }}>Ubah</button>
                      <a className="ow-btn ghost" href={'/#properti-' + String(d.title + ' ' + d.location).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')} target="_blank" rel="noreferrer">Lihat</a>
                      <button className="ow-btn danger" onClick={() => remove(d)}>Hapus</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {edit ? (
        <div className="ow-modal" role="dialog" aria-modal="true" aria-label={edit.id ? 'Ubah listing' : 'Tambah listing'}>
          <div className="ow-card">
            <div className="ow-row" style={{ marginBottom: 12 }}><h2 className="ow-h2" style={{ margin: 0 }}>{edit.id ? 'Ubah listing' : 'Tambah listing'}</h2><span className="ow-spacer" /><button className="ow-btn ghost" onClick={() => setEdit(null)}>Tutup</button></div>
            <div className="ow-form">
              {field('Judul', 'title', { full: true, ph: 'Rumah Minimalis 2 Lantai' })}
              <label className="ow-field">Tipe<select value={F.type} onChange={(e) => set({ type: e.target.value })}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              <label className="ow-field">Transaksi<select value={F.deal} onChange={(e) => set({ deal: e.target.value, unit: e.target.value === 'Disewa' ? '/bulan' : '' })}><option>Dijual</option><option>Disewa</option></select></label>
              <label className="ow-field">Status<select value={F.status} onChange={(e) => set({ status: e.target.value })}>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>{errors.status ? <span className="err">{errors.status}</span> : null}</label>
              <CityPicker province={F.province} city={F.city} error={errors.city} onChange={(p) => set(p)} />
              {field('Lokasi (tampil di kartu)', 'location', { ph: 'Bintaro, Tangerang Selatan' })}
              {field('Harga (angka, Rupiah)', 'priceNum', { num: true, ph: '1850000000', hint: F.priceNum ? rp(F.priceNum) + (F.unit ? ' ' + F.unit : '') : '' })}
              <label className="ow-field">Satuan harga<select value={F.unit} onChange={(e) => set({ unit: e.target.value })}><option value="">— (harga total)</option><option value="/bulan">/bulan</option><option value="/m²">/m²</option></select></label>
              <label className="ow-field">Harga coret (opsional)<input value={F.ext.was} onChange={(e) => setExt({ was: e.target.value })} placeholder="Rp 1,95 M" /></label>
              {field('Luas tanah (m²)', 'ltNum', { num: true })}
              {field('Luas bangunan (m²)', 'lbNum', { num: true })}
              {field('Kamar tidur', 'ktNum', { num: true })}
              {field('Kamar mandi (teks)', 'kmLabel', { ph: '2 atau 1 (dalam)' })}
              <label className="ow-field">Sertifikat<select value={F.cert} onChange={(e) => set({ cert: e.target.value })}>{CERTS.map((c) => <option key={c}>{c}</option>)}</select></label>
              {field('Latitude', 'lat', { num: true, ph: '-6.272', hint: 'Salin dari Google Maps / OpenStreetMap (klik kanan titik lokasi).' })}
              {field('Longitude', 'lng', { num: true, ph: '106.728' })}
              <label className="ow-field">Pembayaran<select value={F.ext.pay} onChange={(e) => setExt({ pay: e.target.value })}><option value="">—</option><option value="kpr">Bisa KPR</option><option value="cash">Cash only</option></select></label>
              <label className="ow-field">Status bangunan<select value={F.ext.build} onChange={(e) => setExt({ build: e.target.value })}><option value="">—</option><option value="ready">Ready unit</option><option value="inden">Inden</option></select></label>
              <label className="ow-field">Arah hadap<input value={F.ext.facing} onChange={(e) => setExt({ facing: e.target.value })} placeholder="Utara" /></label>
              <label className="ow-field">Jumlah lantai<input value={F.ext.floors} onChange={(e) => setExt({ floors: e.target.value })} inputMode="numeric" /></label>
              <label className="ow-field">Tipe unit (apartemen)<input value={F.ext.unitType} onChange={(e) => setExt({ unitType: e.target.value })} placeholder="2 BR" /></label>
              <label className="ow-field">Legalitas<select value={F.ext.lv} onChange={(e) => setExt({ lv: e.target.value })}><option value="verified">Terverifikasi</option><option value="proses">Dalam proses</option></select></label>
              <label className="ow-field">PBB<input value={F.ext.pbb} onChange={(e) => setExt({ pbb: e.target.value })} placeholder="Lunas 2026" /></label>
              <label className="ow-field">IMB / PBG<input value={F.ext.imb} onChange={(e) => setExt({ imb: e.target.value })} placeholder="Ada (PBG)" /></label>
              <label className="ow-check"><input type="checkbox" checked={!!F.ext.reno} onChange={(e) => setExt({ reno: e.target.checked })} /> Perlu renovasi</label>
              <label className="ow-check"><input type="checkbox" checked={!!F.featured} onChange={(e) => set({ featured: e.target.checked })} /> Tampilkan di listing pilihan (beranda)</label>
              {field('Fasilitas utama (pisahkan dengan koma)', 'fasilitas', { full: true, ph: 'Carport, Taman, PLN 2200 VA' })}
              {field('Deskripsi (pisahkan paragraf dengan baris kosong)', 'description', { full: true, textarea: true })}
              <label className="ow-field full">Foto (satu URL per baris; foto pertama = sampul)
                <textarea value={F.photos} onChange={(e) => set({ photos: e.target.value })} placeholder="/assets/xxx.jpg atau https://…" />
                <span className="ow-row"><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => e.target.files.length && upload(e.target.files)} disabled={demo} />{demo ? <span className="ow-muted">Unggah foto aktif setelah Supabase dikonfigurasi.</span> : null}</span>
                {F.photos ? <span className="ow-photos">{F.photos.split('\n').filter(Boolean).slice(0, 8).map((u) => <img key={u} src={u} alt="" />)}</span> : null}
              </label>
            </div>
            <div className="ow-row" style={{ marginTop: 16 }}>
              <button className="ow-btn" onClick={save} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan listing'}</button>
              <button className="ow-btn ghost" onClick={() => setEdit(null)}>Batal</button>
              {Object.keys(errors).length ? <span className="ow-field"><span className="err">Ada isian yang perlu diperbaiki.</span></span> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
