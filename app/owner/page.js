import './owner.css';
import { requireOwner } from '@/lib/auth';
import { demoMode } from '@/lib/config';
import OwnerDashboard from '@/components/owner/OwnerDashboard';
import OwnerLogin from '@/components/owner/OwnerLogin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard Owner — Vinmel Agency', robots: { index: false, follow: false } };

export default async function OwnerPage() {
  const a = await requireOwner();
  if (a.error === 503) {
    return (
      <div className="ow"><main className="ow-main"><div className="ow-card">
        <h1 className="ow-h1">Dashboard owner belum aktif</h1>
        <p className="ow-muted">Backend Supabase belum dikonfigurasi di server ini (NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY).</p>
      </div></main></div>
    );
  }
  if (a.error) return <OwnerLogin notOwner={a.error === 403} />;
  return <OwnerDashboard user={a.user} demo={demoMode()} />;
}
