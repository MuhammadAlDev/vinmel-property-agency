'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, rp } from './api';

const STAGES = [[0, 'Dalam review'], [1, 'Perlu revisi'], [2, 'Survei'], [3, 'Approval'], [4, 'Disetujui'], [5, 'Tayang'], [9, 'Ditolak']];
const stageLabel = (n) => STAGES.find((s) => s[0] === n)?.[1] || '—';
const wa = (phone, text) => 'https://wa.me/' + phone + '?text=' + encodeURIComponent(text);
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '');

export default function TitipTab({ notify, onListingCreated }) {
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(null);
  const [note, setNote] = useState('');

  const load = useCallback(() => { api('/api/titip?scope=owner').then((j) => setItems(j.items)).catch((e) => notify(e.message)); }, [notify]);
  useEffect(() => { load(); }, [load]);

  const update = async (t, patch, msg) => {
    try { await api('/api/titip/' + t.id, { method: 'PATCH', body: patch }); notify(msg); load(); } catch (e) { notify(e.message); }
  };
  const toListing = async (t) => {
    try { await api('/api/titip/' + t.id + '/jadikan-listing', { method: 'POST' }); notify('Draft listing dibuat. Lengkapi koordinat & foto sebelum tayang.'); onListingCreated(); }
    catch (e) { notify(e.message); }
  };

  return (
    <>
      <h1 className="ow-h1">Pengajuan titip properti</h1>
      <div className="ow-card">
        {!items ? <p className="ow-muted">Memuat…</p> : !items.length ? <p className="ow-muted">Belum ada pengajuan. Pengajuan dari formulir "Titip properti" di website akan muncul di sini.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="ow-table">
              <thead><tr><th>Ref</th><th>Properti</th><th className="hide-sm">Pemilik</th><th>Tahap</th><th></th></tr></thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id}>
                    <td><b>{t.ref}</b><div className="ow-muted">{fmt(t.createdAt)}</div></td>
                    <td><b>{t.title}</b><div className="ow-muted">{t.type} · {t.deal} · {t.city} · {rp(t.priceNum)} · {t.plan === 'eksklusif' ? 'Eksklusif' : 'Open listing'} · {t.photoCount} foto</div></td>
                    <td className="hide-sm">{t.name}{t.role === 'kuasa' ? ' (kuasa)' : ''}<div className="ow-muted">{t.phone}{t.email ? ' · ' + t.email : ''}</div></td>
                    <td><select aria-label={'Tahap ' + t.ref} value={t.stage} onChange={(e) => update(t, { stage: Number(e.target.value) }, 'Tahap diubah ke ' + stageLabel(Number(e.target.value)) + '.')}>
                      {STAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
                    <td><div className="ow-row" style={{ gap: 6 }}>
                      <button className="ow-btn ghost" onClick={() => { setOpen(t); setNote(t.reviewNote); }}>Detail</button>
                      <a className="ow-btn ghost" target="_blank" rel="noreferrer" href={wa(t.phone, 'Halo ' + t.name + ', kami dari Vinmel Agency terkait pengajuan titip properti ' + t.ref + ' (' + t.title + '). Status saat ini: ' + stageLabel(t.stage) + '.')}>WhatsApp</a>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {open ? (
        <div className="ow-modal" role="dialog" aria-modal="true" aria-label={'Detail ' + open.ref}>
          <div className="ow-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="ow-row"><h2 className="ow-h2" style={{ margin: 0 }}>{open.ref} · {open.title}</h2><span className="ow-spacer" /><button className="ow-btn ghost" onClick={() => setOpen(null)}>Tutup</button></div>
            <div className="ow-muted">Tahap: <b>{stageLabel(open.stage)}</b> · Pemilik: {open.name} ({open.phone}) · Alamat: {open.address}, {open.city}</div>
            {open.photoUrls.length ? <div className="ow-photos">{open.photoUrls.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" /></a>)}</div> : <div className="ow-muted">{open.photoCount} foto {open.photoCount ? '(pratinjau tersedia setelah Supabase aktif)' : ''}</div>}
            <table className="ow-table"><tbody>
              {Object.entries(open.payload).filter(([, v]) => v !== '' && v != null && !(typeof v === 'object' && !Object.keys(v).length)).map(([k, v]) => (
                <tr key={k}><td className="ow-muted" style={{ width: 180 }}>{k}</td><td>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</td></tr>
              ))}
            </tbody></table>
            <label className="ow-field">Catatan review (dikirim ke pemilik lewat WhatsApp secara manual)<textarea value={note} onChange={(e) => setNote(e.target.value)} /></label>
            <div className="ow-row">
              <button className="ow-btn" onClick={() => update(open, { reviewNote: note }, 'Catatan disimpan.')}>Simpan catatan</button>
              <button className="ow-btn ghost" onClick={() => update(open, { stage: 1, reviewNote: note }, 'Ditandai perlu revisi.')}>Minta revisi</button>
              {open.propertyId ? <span className="ow-badge tayang">Sudah jadi listing #{open.propertyId}</span> : <button className="ow-btn ghost" onClick={() => toListing(open)}>Jadikan draft listing</button>}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
