-- Vinmel Agency: peran superadmin (owner) dan penjual (titip properti)
-- - profiles.role kini: owner | buyer | seller. Owner = pengelola CMS.
-- - profiles.is_superadmin: owner utama (pemilik bisnis). Hanya bisa diubah lewat service role / SQL editor.
-- - Pengajuan titip tertaut otomatis ke akun penjual berdasarkan nomor WA / email (seperti pembelian).
-- - Akun yang mengajukan titip otomatis berperan "seller" (kecuali owner).
-- Hanya menambah/melonggarkan; tidak menghapus data. ROLLBACK ada di bawah.

-- ───────────── Peran ─────────────
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('owner', 'buyer', 'seller'));
alter table public.profiles add column if not exists is_superadmin boolean not null default false;

-- Superadmin selalu owner.
alter table public.profiles drop constraint if exists profiles_superadmin_is_owner;
alter table public.profiles add constraint profiles_superadmin_is_owner check (not is_superadmin or role = 'owner');

create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner' and is_superadmin);
$$;

-- Lindungi peran & status superadmin.
-- auth.uid() kosong = service role / SQL editor (boleh semua).
-- Owner boleh mengubah peran user lain, tapi tidak boleh menurunkan/menyentuh superadmin dan tidak boleh
-- mengubah is_superadmin. User biasa tidak boleh mengubah perannya.
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    if new.is_superadmin is distinct from old.is_superadmin then
      raise exception 'tidak boleh mengubah status superadmin';
    end if;
    if new.role is distinct from old.role then
      if not public.is_owner() then
        raise exception 'tidak boleh mengubah peran';
      end if;
      if old.is_superadmin then
        raise exception 'peran superadmin tidak bisa diubah dari aplikasi';
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- ───────────── Penjual (titip) ─────────────
-- Tautkan pengajuan titip ke akun berdasarkan nomor WA / email saat profil dibuat.
create or replace function public.link_titip_to_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.titip_submissions set user_id = new.id
   where user_id is null
     and ((new.phone is not null and owner_phone = new.phone)
       or (new.email is not null and lower(owner_email) = lower(new.email)));
  if found and new.role = 'buyer' then
    update public.profiles set role = 'seller' where id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_link_titip on public.profiles;
create trigger profiles_link_titip
  after insert on public.profiles
  for each row execute function public.link_titip_to_profile();

-- Pengajuan titip dari akun yang login menjadikan akun itu "seller" (owner tetap owner).
create or replace function public.mark_seller_on_titip()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null then
    update public.profiles set role = 'seller' where id = new.user_id and role = 'buyer';
  end if;
  return new;
end;
$$;
drop trigger if exists titip_mark_seller on public.titip_submissions;
create trigger titip_mark_seller
  after insert or update of user_id on public.titip_submissions
  for each row execute function public.mark_seller_on_titip();

create index if not exists titip_owner_phone_idx on public.titip_submissions (owner_phone);

-- ───────────── ROLLBACK (jalankan manual bila perlu) ─────────────
-- drop trigger if exists titip_mark_seller on public.titip_submissions;
-- drop function if exists public.mark_seller_on_titip();
-- drop trigger if exists profiles_link_titip on public.profiles;
-- drop function if exists public.link_titip_to_profile();
-- drop index if exists public.titip_owner_phone_idx;
-- update public.profiles set role = 'buyer' where role = 'seller';
-- alter table public.profiles drop constraint if exists profiles_superadmin_is_owner;
-- alter table public.profiles drop column if exists is_superadmin;  -- fungsi is_superadmin() ikut di-drop dulu:
-- drop function if exists public.is_superadmin();
-- alter table public.profiles drop constraint if exists profiles_role_check;
-- alter table public.profiles add constraint profiles_role_check check (role in ('owner', 'buyer'));
-- (protect_profile_role versi lama ada di 20261104120000_init.sql)
