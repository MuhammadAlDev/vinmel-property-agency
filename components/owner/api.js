'use client';
// Helper fetch JSON untuk dashboard owner.
export async function api(path, { method = 'GET', body, form } = {}) {
  const init = { method, cache: 'no-store', headers: {} };
  if (form) init.body = form;
  else if (body !== undefined) { init.body = JSON.stringify(body); init.headers['Content-Type'] = 'application/json'; }
  const r = await fetch(path, init);
  const j = await r.json().catch(() => ({ ok: false, message: 'Respons server tidak valid.' }));
  if (!r.ok || j.ok === false) { const e = new Error(j.message || 'Gagal.'); e.errors = j.errors || {}; e.status = r.status; throw e; }
  return j;
}
export const rp = (v) => 'Rp ' + String(Math.round(Number(v) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
