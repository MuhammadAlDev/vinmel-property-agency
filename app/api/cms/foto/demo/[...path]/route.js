import { backendReady } from '@/lib/config';
import { demo } from '@/lib/demo-store';

// Mode demo lokal saja: menyajikan foto konten yang diunggah ke memori server.
export async function GET(req, { params }) {
  if (backendReady()) return new Response('Not found', { status: 404 });
  const { path } = await params;
  const f = demo.photos?.[path.join('/')];
  if (!f) return new Response('Not found', { status: 404 });
  return new Response(f.buf, { headers: { 'Content-Type': f.type, 'Cache-Control': 'private, max-age=3600' } });
}
