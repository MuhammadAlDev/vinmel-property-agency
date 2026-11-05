-- Vinmel Agency: desain Amel 2026-11-06
-- - Data pemilik (seller_profiles) untuk akun penjual.
-- - Review & approval titip: tahap 6 = Ditolak (menggantikan 9), riwayat review, checklist verifikasi.
-- - Data pasar area per kota (market_area_stats) untuk "Perbandingan properti sekitar".
-- - Bucket publik "konten" untuk foto profil owner & foto testimoni.
-- - User boleh menaikkan perannya sendiri hanya dari buyer ke seller (bukan ke owner).
-- Hanya menambah/melonggarkan; tidak menghapus data. ROLLBACK ada di bawah.

-- ───────────── Peran: buyer -> seller boleh oleh user sendiri ─────────────
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    if new.is_superadmin is distinct from old.is_superadmin then
      raise exception 'tidak boleh mengubah status superadmin';
    end if;
    if new.role is distinct from old.role then
      if public.is_owner() then
        if old.is_superadmin then raise exception 'peran superadmin tidak bisa diubah dari aplikasi'; end if;
      elsif not (old.role = 'buyer' and new.role = 'seller' and new.id = auth.uid()) then
        raise exception 'tidak boleh mengubah peran';
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- ───────────── Data pemilik (akun penjual) ─────────────
create table public.seller_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 3 and 120),   -- sesuai KTP
  phone text not null,                      -- 628xxxxxxxxxx
  email text,
  city text not null default '',
  address text not null default '',          -- alamat korespondensi
  status text not null default 'pemilik' check (status in ('pemilik', 'kuasa')),
  cert_owner_name text,                      -- bila kuasa: nama pemilik di sertifikat
  relation text,                             -- bila kuasa: hubungan dengan pemilik
  contact_time text not null default 'siang' check (contact_time in ('pagi', 'siang', 'sore', 'malam')),
  phone_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'pemilik' or (cert_owner_name is not null and relation is not null))
);
create trigger seller_profiles_touch before update on public.seller_profiles for each row execute function public.touch_updated_at();
alter table public.seller_profiles enable row level security;
create policy "data pemilik sendiri atau owner" on public.seller_profiles
  for select using (user_id = auth.uid() or public.is_owner());
create policy "isi data pemilik sendiri" on public.seller_profiles
  for insert with check (user_id = auth.uid());
-- phone_verified hanya diisi server (service role); user tidak bisa menandai nomornya sendiri terverifikasi.
create policy "ubah data pemilik sendiri" on public.seller_profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.protect_seller_verified()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_owner() then
    if tg_op = 'INSERT' then new.phone_verified := false;
    else new.phone_verified := old.phone_verified; end if;
  end if;
  return new;
end;
$$;
create trigger seller_profiles_protect before insert or update on public.seller_profiles
  for each row execute function public.protect_seller_verified();

-- Mengisi data pemilik menjadikan akun "seller".
create or replace function public.mark_seller_on_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set role = 'seller' where id = new.user_id and role = 'buyer';
  return new;
end;
$$;
create trigger seller_profiles_mark_seller after insert on public.seller_profiles
  for each row execute function public.mark_seller_on_profile();

-- ───────────── Titip: tahap 6 = Ditolak ─────────────
alter table public.titip_submissions drop constraint if exists titip_submissions_stage_check;
update public.titip_submissions set stage = 6 where stage = 9;
alter table public.titip_submissions add constraint titip_submissions_stage_check check (stage between 0 and 6);
-- review_note = catatan owner untuk penjual (tampil di halaman status penjual).

-- Riwayat review (aksi owner). Ditulis lewat server setelah aturan dicek.
create table public.titip_reviews (
  id bigint generated always as identity primary key,
  submission_id uuid not null references public.titip_submissions (id) on delete cascade,
  action text not null check (char_length(action) between 2 and 60),
  from_stage int,
  to_stage int not null check (to_stage between 0 and 6),
  note text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index titip_reviews_sub_idx on public.titip_reviews (submission_id, created_at desc);
alter table public.titip_reviews enable row level security;
create policy "owner kelola review" on public.titip_reviews
  for all using (public.is_owner()) with check (public.is_owner());

-- Checklist verifikasi per pengajuan.
create table public.titip_checklist (
  submission_id uuid not null references public.titip_submissions (id) on delete cascade,
  item text not null check (item in ('sert', 'pbg', 'pbb', 'ktp', 'kuasa', 'foto', 'harga', 'lokasi', 'desk')),
  checked boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (submission_id, item)
);
alter table public.titip_checklist enable row level security;
create policy "owner kelola checklist" on public.titip_checklist
  for all using (public.is_owner()) with check (public.is_owner());

-- Aturan approval juga dijaga di database: tahap 4 (Disetujui) hanya bila checklist lengkap.
create or replace function public.titip_check_approval()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_need text[] := array['sert', 'pbg', 'pbb', 'ktp', 'foto', 'harga', 'lokasi', 'desk'];
  v_missing int;
begin
  if new.stage = 4 and old.stage is distinct from 4 then
    if new.submitter_role = 'kuasa' then v_need := v_need || 'kuasa'; end if;
    select count(*) into v_missing from unnest(v_need) i
     where not exists (select 1 from public.titip_checklist c where c.submission_id = new.id and c.item = i and c.checked);
    if v_missing > 0 then raise exception 'checklist verifikasi belum lengkap (% item)', v_missing; end if;
  end if;
  return new;
end;
$$;
create trigger titip_approval_check before update of stage on public.titip_submissions
  for each row execute function public.titip_check_approval();

-- ───────────── Data pasar area (diperbarui tiap kuartal) ─────────────
create table public.market_area_stats (
  city text primary key,                 -- '*' = angka nasional (cadangan untuk kota tanpa data)
  price_growth text,                     -- kenaikan harga rumah per tahun, teks tampilan mis. '0,70%'
  price_growth_src text,
  rent_yield text,                       -- imbal hasil sewa apartemen (kotor)
  rent_yield_src text,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger market_touch before update on public.market_area_stats for each row execute function public.touch_updated_at();
alter table public.market_area_stats enable row level security;
create policy "data pasar publik" on public.market_area_stats for select using (true);
create policy "owner kelola data pasar" on public.market_area_stats
  for all using (public.is_owner()) with check (public.is_owner());

-- Angka awal dari riset Dana (riset-data/dana/riset-investasi-properti-2026-11-04.md).
insert into public.market_area_stats (city, price_growth, price_growth_src, rent_yield, rent_yield_src) values
  ('*', '0,69%', 'rumah baru nasional, Bank Indonesia TW II 2026', '8,22%', 'rata-rata Indonesia'),
  ('Bogor', '3,2%', 'rumah seken, Rumah123 Agu 2026', null, null),
  ('Bekasi', '1,9%', 'rumah seken, Rumah123 Agu 2026', null, null),
  ('Depok', '0,4%', 'rumah seken, Rumah123 Agu 2026', null, null),
  ('Jakarta Selatan', '0,2%', 'rumah seken Jakarta, Rumah123 Agu 2026', '8,05–9,42%', 'studio/1BR sampai 2BR, Jakarta Selatan'),
  ('Jakarta Timur', '0,2%', 'rumah seken Jakarta, Rumah123 Agu 2026', '12,00%', 'rata-rata Jakarta'),
  ('Jakarta Pusat', '0,2%', 'rumah seken Jakarta, Rumah123 Agu 2026', '12,86%', 'studio/1BR, Jakarta Pusat'),
  ('Tangerang', '0,70%', 'rumah baru Jabodebek-Banten, Bank Indonesia TW II 2026', '9,61%', 'Tangerang'),
  ('Tangerang Selatan', '0,70%', 'rumah baru Jabodebek-Banten, Bank Indonesia TW II 2026', '7,69%', 'Tangerang Selatan')
on conflict (city) do nothing;

-- ───────────── Storage: foto profil owner & testimoni ─────────────
insert into storage.buckets (id, name, public) values ('konten', 'konten', true) on conflict (id) do nothing;
create policy "owner unggah foto konten" on storage.objects
  for insert to authenticated with check (bucket_id = 'konten' and public.is_owner());
create policy "owner ubah foto konten" on storage.objects
  for update to authenticated using (bucket_id = 'konten' and public.is_owner());
create policy "owner hapus foto konten" on storage.objects
  for delete to authenticated using (bucket_id = 'konten' and public.is_owner());

-- ───────────── ROLLBACK (jalankan manual bila perlu) ─────────────
-- drop policy "owner unggah foto konten" on storage.objects; drop policy "owner ubah foto konten" on storage.objects;
-- drop policy "owner hapus foto konten" on storage.objects;  (kosongkan bucket "konten" lewat dashboard, lalu hapus bucket)
-- drop table public.market_area_stats;
-- drop trigger titip_approval_check on public.titip_submissions; drop function public.titip_check_approval();
-- drop table public.titip_checklist; drop table public.titip_reviews;
-- alter table public.titip_submissions drop constraint titip_submissions_stage_check;
-- update public.titip_submissions set stage = 9 where stage = 6;
-- alter table public.titip_submissions add constraint titip_submissions_stage_check check (stage in (0, 1, 2, 3, 4, 5, 9));
-- drop table public.seller_profiles; drop function public.mark_seller_on_profile(); drop function public.protect_seller_verified();
-- (protect_profile_role versi sebelumnya ada di 20261105130000_superadmin_penjual.sql)
