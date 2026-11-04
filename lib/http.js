import { NextResponse } from 'next/server';
export const ok = (data = {}, init) => NextResponse.json({ ok: true, ...data }, init);
export const fail = (status, message, extra = {}) => NextResponse.json({ ok: false, message, ...extra }, { status });
export async function readJson(req) {
  try { return await req.json(); } catch { return null; }
}

// Hanya izinkan redirect ke origin sendiri (cegah open redirect).
export function safeNext(raw, origin) {
  try {
    const u = new URL(raw || '/', origin);
    return u.origin === origin ? u.pathname + u.search + u.hash : '/';
  } catch { return '/'; }
}
