'use client';
import { useState } from 'react';
import '../../app/owner/owner.css';
import { api } from './api';

export default function OwnerLogin({ notOwner }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('phone');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const send = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api('/api/auth/otp/send', { method: 'POST', body: { phone } }); setStep('otp'); } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  const verify = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api('/api/auth/otp/verify', { method: 'POST', body: { phone, code } }); window.location.reload(); } catch (x) { setErr(x.message); setBusy(false); }
  };
  const logout = async () => { await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); window.location.reload(); };

  return (
    <div className="ow"><main className="ow-main" style={{ maxWidth: 480 }}>
      <div className="ow-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h1 className="ow-h1">Masuk dashboard owner</h1>
        {notOwner ? (
          <div className="ow-banner">Akun yang sedang login bukan akun owner. Keluar lalu masuk dengan akun owner.
            <div style={{ marginTop: 8 }}><button className="ow-btn ghost" onClick={logout}>Keluar</button></div></div>
        ) : null}
        <a className="ow-btn" href="/api/auth/google?next=/owner" style={{ justifyContent: 'center' }}>Masuk dengan Google</a>
        <div className="ow-muted" style={{ textAlign: 'center' }}>atau lewat OTP WhatsApp</div>
        {step === 'phone' ? (
          <form onSubmit={send} className="ow-field">Nomor WhatsApp
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0812 3456 7890" inputMode="tel" autoComplete="tel" />
            <button className="ow-btn" disabled={busy}>{busy ? 'Mengirim…' : 'Kirim kode OTP'}</button>
          </form>
        ) : (
          <form onSubmit={verify} className="ow-field">Kode OTP (6 digit)
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" />
            <button className="ow-btn" disabled={busy}>{busy ? 'Memeriksa…' : 'Masuk'}</button>
            <button type="button" className="ow-btn ghost" onClick={() => setStep('phone')}>Ganti nomor</button>
          </form>
        )}
        {err ? <div className="ow-field"><span className="err" role="alert">{err}</span></div> : null}
        <a href="/" className="ow-muted">← Kembali ke website</a>
      </div>
    </main></div>
  );
}
