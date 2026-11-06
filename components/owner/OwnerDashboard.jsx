'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import ListingTab from './ListingTab';
import TitipTab from './TitipTab';
import PantauTab from './PantauTab';

const TABS = [['ringkasan', 'Ringkasan'], ['listing', 'Listing'], ['titip', 'Titip properti'], ['pantau', 'Pantau pembeli']];

export default function OwnerDashboard({ user, demo }) {
  const [tab, setTab] = useState('ringkasan');
  // ?tab=listing|titip|pantau (dipakai tautan dari CMS desain)
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (TABS.some(([k]) => k === t)) setTab(t);
  }, []);
  const [toast, setToast] = useState('');
  const [stats, setStats] = useState(null);
  const notify = useCallback((t) => { setToast(t); setTimeout(() => setToast(''), 4000); }, []);

  useEffect(() => {
    if (tab !== 'ringkasan') return;
    Promise.all([
      api('/api/properties?scope=owner'), api('/api/titip?scope=owner'), api('/api/pantau?scope=owner'),
    ]).then(([l, t, p]) => setStats({
      tayang: l.items.filter((x) => x.status === 'tayang').length,
      draft: l.items.filter((x) => x.status === 'draft').length,
      total: l.items.length,
      titipBaru: t.items.filter((x) => x.stage === 0).length,
      titip: t.items.length,
      pembeli: p.items.length,
    })).catch((e) => notify(e.message));
  }, [tab, notify]);

  const logout = async () => { await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); window.location.href = '/'; };

  return (
    <div className="ow">
      <header className="ow-top">
        <a className="ow-brand" href="/#owner">Vinmel · Alat lanjutan owner</a>
        <nav className="ow-tabs" aria-label="Menu dashboard">
          {TABS.map(([k, l]) => <button key={k} className="ow-tab" aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}
        </nav>
        <span className="ow-spacer" />
        <span className="ow-muted">{user.name}</span>
        {!demo ? <button className="ow-btn ghost" onClick={logout}>Keluar</button> : null}
      </header>
      <main className="ow-main">
        {demo ? <div className="ow-banner">Mode demo: Supabase belum dikonfigurasi. Data dari data/dummy dan perubahan hanya tersimpan di memori server (hilang saat server restart). Halaman ini hanya bisa dibuka saat pengembangan lokal.</div> : null}
        {tab === 'ringkasan' ? (
          <>
            <h1 className="ow-h1">Ringkasan</h1>
            <div className="ow-grid">
              {[['Listing tayang', stats?.tayang], ['Listing draft', stats?.draft], ['Pengajuan titip baru', stats?.titipBaru], ['Total pengajuan titip', stats?.titip], ['Pembeli dipantau', stats?.pembeli]].map(([l, v]) => (
                <div key={l} className="ow-card"><div className="ow-stat">{v ?? '…'}</div><div className="ow-muted">{l}</div></div>
              ))}
            </div>
            <div className="ow-card ow-muted">Kelola listing di tab <b>Listing</b>, tinjau pengajuan pemilik di <b>Titip properti</b>, dan perbarui progres pembangunan &amp; legalitas pembeli di <b>Pantau pembeli</b>.</div>
          </>
        ) : null}
        {tab === 'listing' ? <ListingTab notify={notify} demo={demo} /> : null}
        {tab === 'titip' ? <TitipTab notify={notify} onListingCreated={() => setTab('listing')} /> : null}
        {tab === 'pantau' ? <PantauTab notify={notify} /> : null}
      </main>
      {toast ? <div className="ow-toast" role="status">{toast}</div> : null}
    </div>
  );
}
