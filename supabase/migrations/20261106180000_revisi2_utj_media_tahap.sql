-- Vinmel Agency: desain Amel Revisi 2 (2026-11-06)
-- - Bukti transfer UTJ: kolom di utj_requests + bucket privat "utj-bukti" (maks. 5 MB, foto/PDF),
--   hanya owner dan pemilik permintaan yang bisa membaca.
-- - Titip: fasum berulang (nearby), video tour, link tur 360°, foto panorama. Video & panorama di bucket
--   privat "titip-media" (maks. 200 MB), diunggah langsung dari browser lewat signed upload URL dari server.
-- - Angka kepercayaan: sumber angka disimpan terpisah (stats_src) dan hanya bisa dibaca owner.
-- - Tahap pembangunan tambahan (is_custom), serah terima (purchases.handover_at).
-- - Batas ukuran & tipe file untuk semua bucket.
-- Hanya menambah; tidak menghapus data. ROLLBACK ada di bawah.

-- ───────────── UTJ: bukti transfer ─────────────
alter table public.utj_requests add column if not exists invoice_no text check (invoice_no is null or char_length(invoice_no) <= 60);
alter table public.utj_requests add column if not exists proof_path text;     -- <user_id>/<inv>.<ext> di bucket utj-bukti
alter table public.utj_requests add column if not exists proof_name text;
alter table public.utj_requests add column if not exists proof_type text check (proof_type is null or proof_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf'));
alter table public.utj_requests add column if not exists proof_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('utj-bukti', 'utj-bukti', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- Unggah dilakukan server (service role) setelah validasi. Baca: owner, atau pemilik folder (= user_id).
create policy "baca bukti utj" on storage.objects
  for select to authenticated using (bucket_id = 'utj-bukti' and (public.is_owner() or (storage.foldername(name))[1] = auth.uid()::text));
create policy "owner hapus bukti utj" on storage.objects
  for delete to authenticated using (bucket_id = 'utj-bukti' and public.is_owner());

-- ───────────── Titip: fasum, video, tur 360°, panorama ─────────────
alter table public.titip_submissions add column if not exists nearby jsonb not null default '{}'::jsonb;  -- {tol:[{n,d}], kota:[...], faskes:[...], bandara:[...]}
alter table public.titip_submissions add column if not exists video_url text;
alter table public.titip_submissions add column if not exists video_path text;   -- di bucket titip-media
alter table public.titip_submissions add column if not exists tour_url text;
alter table public.titip_submissions add column if not exists pano_paths text[] not null default '{}';
alter table public.titip_submissions drop constraint if exists titip_media_https;
alter table public.titip_submissions add constraint titip_media_https
  check ((video_url is null or video_url ~ '^https://') and (tour_url is null or tour_url ~ '^https://') and cardinality(pano_paths) <= 10);
alter table public.properties add column if not exists nearby jsonb not null default '{}'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('titip-media', 'titip-media', false, 209715200, array['video/mp4', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- Path: <user_id>/<uuid>.<ext>. Unggah lewat signed upload URL (dibuat server untuk user yang login).
create policy "baca media titip" on storage.objects
  for select to authenticated using (bucket_id = 'titip-media' and (public.is_owner() or (storage.foldername(name))[1] = auth.uid()::text));
create policy "owner hapus media titip" on storage.objects
  for delete to authenticated using (bucket_id = 'titip-media' and public.is_owner());

-- Batas ukuran & tipe untuk bucket yang sudah ada.
update storage.buckets set file_size_limit = 8388608, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
 where id in ('listing', 'titip', 'progres');
update storage.buckets set file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'] where id = 'konten';

-- ───────────── Angka kepercayaan: sumber hanya untuk owner ─────────────
-- stats = [[angka, label, keterangan]] (publik), stats_src = [sumber per baris] (internal).
alter table public.site_content drop constraint if exists site_content_key_check;
alter table public.site_content add constraint site_content_key_check check (key in ('about', 'stats', 'testi', 'stats_src'));
drop policy if exists "konten publik" on public.site_content;
create policy "konten publik" on public.site_content for select using (key <> 'stats_src' or public.is_owner());

-- ───────────── Tahap pembangunan & serah terima ─────────────
alter table public.purchase_steps add column if not exists is_custom boolean not null default false;  -- ditambah owner dari CMS
alter table public.purchase_steps add column if not exists custom_id text;                             -- id dari desain (st...)
alter table public.purchases add column if not exists handover_at timestamptz;                         -- serah terima selesai

-- ───────────── ROLLBACK (jalankan manual bila perlu) ─────────────
-- alter table public.purchases drop column handover_at;
-- alter table public.purchase_steps drop column custom_id, drop column is_custom;   (hapus dulu baris is_custom bila perlu)
-- drop policy "konten publik" on public.site_content; create policy "konten publik" on public.site_content for select using (true);
-- delete from public.site_content where key = 'stats_src';
-- alter table public.site_content drop constraint site_content_key_check;
-- alter table public.site_content add constraint site_content_key_check check (key in ('about', 'stats', 'testi'));
-- drop policy "baca media titip" on storage.objects; drop policy "owner hapus media titip" on storage.objects;
-- drop policy "baca bukti utj" on storage.objects; drop policy "owner hapus bukti utj" on storage.objects;
-- (kosongkan lalu hapus bucket "titip-media" dan "utj-bukti" lewat dashboard)
-- alter table public.properties drop column nearby;
-- alter table public.titip_submissions drop constraint titip_media_https, drop column nearby, drop column video_url,
--   drop column video_path, drop column tour_url, drop column pano_paths;
-- alter table public.utj_requests drop column invoice_no, drop column proof_path, drop column proof_name, drop column proof_type, drop column proof_at;
