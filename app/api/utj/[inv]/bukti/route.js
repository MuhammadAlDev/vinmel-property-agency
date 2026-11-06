import { backendReady } from '@/lib/config';
import { getSessionUser } from '@/lib/auth';
import { demo } from '@/lib/demo-store';

// Mode demo lokal saja: menyajikan bukti UTJ dari memori server (owner atau pengirimnya).
// Dengan Supabase, bukti dibaca lewat URL bertanda dari bucket privat "utj-bukti".
export async function GET(req, { params }) {
  if (backendReady()) return new Response('Not found', { status: 404 });
  const { inv } = await params;
  const user = await getSessionUser();
  const r = demo.utj.find((x) => x.inv === inv);
  const f = demo.utjFiles?.[inv];
  if (!r || !f || !user || (user.role !== 'owner' && r.user_id !== user.id)) return new Response('Not found', { status: 404 });
  return new Response(f.buf, { headers: { 'Content-Type': f.type, 'Cache-Control': 'private, no-store' } });
}
