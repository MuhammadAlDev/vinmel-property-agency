-- Vinmel Agency: sambungan CMS owner & halaman pembeli (desain Amel 2026-11-05)
-- Menambah: status listing "booked", link video & tur 360°, konten situs (Tentang/angka/testimoni),
-- jadwal survei dari situs (uid/phone/note), permintaan UTJ, update progres pembeli + foto (bucket privat "progres").
-- Hanya menambah kolom/tabel/policy; tidak menghapus data. Lihat bagian ROLLBACK di bawah.

-- ───────────── Listing: status booked + media ─────────────
alter table public.properties drop constraint if exists properties_status_check;
alter table public.properties add constraint properties_status_check
  check (status in ('draft', 'tayang', 'booked', 'terjual', 'tersewa', 'arsip'));
alter table public.properties add column if not exists video_url text;
alter table public.properties add column if not exists tour_url text;
alter table public.properties add constraint properties_media_https
  check ((video_url is null or video_url ~ '^https://') and (tour_url is null or tour_url ~ '^https://'));

drop policy if exists "listing tayang publik" on public.properties;
create policy "listing tayang publik" on public.properties
  for select using (status in ('tayang', 'booked', 'terjual', 'tersewa') or public.is_owner());

-- ───────────── Konten situs (menu "Konten & kontak" di CMS) ─────────────
create table public.site_content (
  key text primary key check (key in ('about', 'stats', 'testi')),
  value jsonb not null default 'null'::jsonb,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger site_content_touch before update on public.site_content for each row execute function public.touch_updated_at();
alter table public.site_content enable row level security;
create policy "konten publik" on public.site_content for select using (true);
create policy "owner kelola konten" on public.site_content
  for all using (public.is_owner()) with check (public.is_owner());

-- ───────────── Jadwal survei dari situs ─────────────
-- uid dibuat di browser (dipakai CMS sebagai kunci status); label tanggal/jam disimpan apa adanya untuk tampilan.
alter table public.survey_requests add column if not exists uid text;
alter table public.survey_requests add column if not exists property_title text;
alter table public.survey_requests add column if not exists date_label text;
alter table public.survey_requests add column if not exists slot_label text;
alter table public.survey_requests add column if not exists updated_at timestamptz not null default now();
update public.survey_requests set uid = 'sv-' || id::text where uid is null;
alter table public.survey_requests alter column uid set not null;
create unique index if not exists survey_requests_uid_key on public.survey_requests (uid);
create index if not exists survey_requests_user_idx on public.survey_requests (user_id);
create trigger survey_touch before update on public.survey_requests for each row execute function public.touch_updated_at();
-- Survei dibuat lewat server (service role) supaya nomor & tanggal divalidasi; anon tidak boleh insert langsung.
drop policy if exists "buat survei" on public.survey_requests;

-- ───────────── Permintaan UTJ (uang tanda jadi) ─────────────
-- status: baru (menunggu invoice) → invoice → bukti → ok (terverifikasi, listing jadi booked) | batal
create table public.utj_requests (
  id uuid primary key default gen_random_uuid(),
  inv text not null unique,
  user_id uuid references auth.users (id) on delete set null,
  property_id bigint references public.properties (id) on delete set null,
  property_title text not null,
  name text not null,
  phone text,
  amount bigint not null default 1000000,
  status text not null default 'baru' check (status in ('baru', 'invoice', 'bukti', 'ok', 'batal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index utj_user_idx on public.utj_requests (user_id);
create trigger utj_touch before update on public.utj_requests for each row execute function public.touch_updated_at();
alter table public.utj_requests enable row level security;
create policy "utj sendiri atau owner" on public.utj_requests
  for select using (user_id = auth.uid() or public.is_owner());
create policy "owner kelola utj" on public.utj_requests
  for update using (public.is_owner()) with check (public.is_owner());
create policy "owner hapus utj" on public.utj_requests
  for delete using (public.is_owner());
-- Insert dilakukan server (service role) untuk user yang sudah login.

-- ───────────── Update progres untuk halaman pembeli ─────────────
create table public.purchase_updates (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases (id) on delete cascade,
  step int not null default 0 check (step between 0 and 50),
  pct int not null default 0 check (pct between 0 and 100),
  note text not null,
  photos jsonb not null default '[]'::jsonb,  -- [{path, name}] di bucket privat "progres"
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index purchase_updates_idx on public.purchase_updates (purchase_id, created_at desc);
alter table public.purchase_updates enable row level security;
create policy "pembeli lihat update sendiri" on public.purchase_updates
  for select using (public.is_owner() or exists (
    select 1 from public.purchases p where p.id = purchase_id and p.buyer_id = auth.uid()));
create policy "owner kelola update" on public.purchase_updates
  for all using (public.is_owner()) with check (public.is_owner());

-- ───────────── Storage: foto update progres (privat) ─────────────
-- Path: <purchase_id>/<uuid>.<ext>. Pembeli hanya bisa membaca (signed URL) foto unit miliknya.
insert into storage.buckets (id, name, public) values ('progres', 'progres', false) on conflict (id) do nothing;
create policy "owner unggah foto progres" on storage.objects
  for insert to authenticated with check (bucket_id = 'progres' and public.is_owner());
create policy "owner hapus foto progres" on storage.objects
  for delete to authenticated using (bucket_id = 'progres' and public.is_owner());
create policy "baca foto progres" on storage.objects
  for select to authenticated using (bucket_id = 'progres' and (public.is_owner() or exists (
    select 1 from public.purchases p where p.id::text = (storage.foldername(name))[1] and p.buyer_id = auth.uid())));

-- ───────────── ROLLBACK (manual, bila perlu dibatalkan) ─────────────
-- drop policy "baca foto progres" on storage.objects; drop policy "owner hapus foto progres" on storage.objects;
-- drop policy "owner unggah foto progres" on storage.objects;  (hapus isi bucket "progres" lewat dashboard, lalu hapus bucket)
-- drop table public.purchase_updates; drop table public.utj_requests; drop table public.site_content;
-- drop trigger survey_touch on public.survey_requests; drop index survey_requests_uid_key;
-- alter table public.survey_requests drop column uid, drop column property_title, drop column date_label, drop column slot_label, drop column updated_at;
-- create policy "buat survei" on public.survey_requests for insert with check (user_id is null or user_id = auth.uid());
-- update public.properties set status = 'tayang' where status = 'booked';
-- alter table public.properties drop constraint properties_media_https, drop column video_url, drop column tour_url;
-- alter table public.properties drop constraint properties_status_check;
-- alter table public.properties add constraint properties_status_check check (status in ('draft','tayang','terjual','tersewa','arsip'));
-- drop policy "listing tayang publik" on public.properties;
-- create policy "listing tayang publik" on public.properties for select using (status in ('tayang','terjual','tersewa') or public.is_owner());
