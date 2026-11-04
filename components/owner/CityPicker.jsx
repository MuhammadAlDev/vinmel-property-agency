'use client';
import { useEffect, useState } from 'react';

// Pilih provinsi lalu kab/kota dari API wilayah (/api/wilayah/*).
export default function CityPicker({ province, city, onChange, error }) {
  const [provs, setProvs] = useState([]);
  const [cities, setCities] = useState([]);
  const [provId, setProvId] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch('/api/wilayah/provinsi').then((r) => r.json()).then((j) => {
      if (!j.ok) throw new Error();
      setProvs(j.items);
      const hit = j.items.find((p) => p.name.toLowerCase() === String(province || '').toLowerCase());
      if (hit) setProvId(hit.id);
    }).catch(() => setFailed(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!provId) { setCities([]); return; }
    fetch('/api/wilayah/kota?provinsi=' + provId).then((r) => r.json()).then((j) => setCities(j.ok ? j.items : [])).catch(() => setFailed(true));
  }, [provId]);

  if (failed) {
    return (
      <>
        <label className="ow-field">Provinsi<input value={province || ''} onChange={(e) => onChange({ province: e.target.value, city })} /></label>
        <label className="ow-field">Kota (API wilayah tidak terjangkau, isi manual)<input value={city || ''} onChange={(e) => onChange({ province, city: e.target.value })} />{error ? <span className="err">{error}</span> : null}</label>
      </>
    );
  }
  const inList = cities.some((c) => c.name === city);
  return (
    <>
      <label className="ow-field">Provinsi
        <select value={provId} onChange={(e) => { const p = provs.find((x) => x.id === e.target.value); setProvId(e.target.value); onChange({ province: p ? p.name : '', city: '', wilayahCode: '' }); }}>
          <option value="">Pilih provinsi</option>
          {provs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label className="ow-field">Kota / kabupaten
        <select value={inList ? city : ''} onChange={(e) => { const c = cities.find((x) => x.name === e.target.value); onChange({ province, city: e.target.value, wilayahCode: c ? c.id : '' }); }} disabled={!provId}>
          <option value="">{city && !inList ? city + ' (pilih ulang)' : 'Pilih kota'}</option>
          {cities.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        {error ? <span className="err">{error}</span> : null}
      </label>
    </>
  );
}
