'use client';
import { useCallback, useEffect, useState } from 'react';
import DesignComponent from './DesignComponent';

const to08 = (p) => (String(p || '').startsWith('62') ? '0' + String(p).slice(2) : String(p || ''));

// Pembungkus DesignComponent: mengambil sesi login & data "Pantau properti" dari backend
// dan mengirim pengajuan titip properti ke /api/titip.
export default function VinmelApp({ backend, titipApi, ...props }) {
  const [user, setUser] = useState(undefined);
  const [owned, setOwned] = useState(null);

  const refresh = useCallback(async () => {
    if (!backend) return;
    const me = await fetch('/api/auth/me', { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
    const u = me?.user || null;
    if (!u) {
      try { window.localStorage.removeItem('vinmel_user'); } catch {}
      setUser(null); setOwned(null);
      return;
    }
    setUser({ name: u.name, phone: to08(u.phone), email: u.email, via: u.via, role: u.role });
    const p = await fetch('/api/pantau', { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
    setOwned(p?.items?.length ? p.items : null);
  }, [backend]);

  useEffect(() => { refresh(); }, [refresh]);

  const onLogout = useCallback(() => {
    if (!backend) return;
    setUser(null); setOwned(null);
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  }, [backend]);

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
    return { ref: j.ref };
  }, []);

  return (
    <>
      <DesignComponent
        {...props}
        authApi={backend ? '/api' : ''}
        sessionUser={backend ? user : undefined}
        owned={owned}
        onLogin={refresh}
        onLogout={onLogout}
        onSubmitTitip={titipApi ? onSubmitTitip : undefined}
      />
      {user?.role === 'owner' ? (
        <a href="/owner" style={{ position: 'fixed', left: 16, bottom: 16, zIndex: 60, background: '#1F4D3A', color: '#FFFFFF', padding: '10px 16px', borderRadius: 999, fontWeight: 700, fontSize: 14, textDecoration: 'none', boxShadow: '0 6px 20px rgba(0,0,0,.18)' }}>
          Dashboard owner
        </a>
      ) : null}
    </>
  );
}
