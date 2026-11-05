# Vinmel Property Agency

Website Vinmel Agency dengan Next.js 16 + Tailwind CSS + **Supabase** (database, Auth, Storage). Tampilan publik mengikuti desain di artifact Claude (`design/Main.dc.html`).

## Halaman
- `/` website publik: beranda, listing + filter, detail, bandingkan, KPR, **titip properti** (terkirim ke backend), **pantau properti saya** (data pembeli yang login), login OTP WhatsApp / Google, favorit, jadwal survei, peta OpenStreetMap
- `/owner` dashboard owner (CMS): ringkasan, kelola listing, tinjau pengajuan titip (ubah tahap, catatan, jadikan draft listing), kelola progres pembangunan & legalitas pembeli
- Chatbot "Cimel" dan "Rekomendasi AI" masih versi lokal dari desain (ditunda, belum memakai LLM)

## Mode kerja
| Kondisi | Perilaku |
| --- | --- |
| Env Supabase kosong (mode demo) | Data dari `data/dummy/*.json`. Perubahan (listing, titip, pantau) disimpan di memori server dan hilang saat restart. Login = pratinjau desain. `/owner` hanya bisa dibuka saat `npm run dev`. |
| Env Supabase terisi | Data dari database, login OTP WA + Google sungguhan, akses diatur Row Level Security. |

Jangan tayangkan ke publik dalam mode demo.

## Menjalankan
```bash
npm install
cp .env.example .env.local   # isi bila sudah punya project Supabase
npm run dev
```

## Menyiapkan Supabase
1. Buat project di supabase.com, isi `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` di `.env.local` / env hosting.
2. Jalankan `supabase/migrations/20261104120000_init.sql` lalu `supabase/seed.sql` (SQL editor, atau `npx supabase db push` + seed).
3. Daftarkan akun owner: `insert into owner_allowlist (email) values ('<email google owner>');` atau `(phone) values ('62xxxxxxxxxx')`. Akun yang login dengan email/nomor itu otomatis menjadi owner. Akun yang sudah terlanjur ada: `update profiles set role = 'owner' where email = '...';`
4. **Google OAuth**: buat OAuth Client (Web) di Google Cloud Console, redirect URI `https://<project>.supabase.co/auth/v1/callback`, lalu isi Client ID/Secret di Supabase > Authentication > Providers > Google. Tambahkan `https://<domain>/api/auth/callback` ke Authentication > URL Configuration > Redirect URLs.
5. **OTP WhatsApp**: Supabase > Authentication > Providers > Phone, pilih Twilio (atau Twilio Verify) dengan nomor pengirim WhatsApp yang sudah disetujui. Server memanggil `signInWithOtp({ channel: 'whatsapp' })`.

Untuk lokal dengan Supabase CLI: `npx supabase start` (memakai `supabase/config.toml`, kredensial dari env).

## API (route handler Next.js, `app/api`)
| Endpoint | Akses | Keterangan |
| --- | --- | --- |
| `POST /api/auth/otp/send` `{phone}` | publik | kirim OTP WhatsApp |
| `POST /api/auth/otp/verify` `{phone, code, name}` | publik | verifikasi, buat sesi (cookie) |
| `GET /api/auth/google?next=` / `GET /api/auth/callback` | publik | login Google (PKCE) |
| `GET /api/auth/me`, `POST /api/auth/logout` | publik | sesi saat ini / keluar |
| `GET /api/properties?type=&deal=&city=&q=&pmin=&pmax=&featured=1` | publik | listing tayang |
| `GET /api/properties?scope=owner&status=`, `POST`, `PATCH/DELETE /api/properties/:id` | owner | kelola listing (tayang wajib ada lat/lng) |
| `POST /api/titip` (multipart `data` + `photos` ≥3) | publik | pengajuan titip, foto ke bucket privat `titip` |
| `GET /api/titip?scope=owner`, `PATCH /api/titip/:id`, `POST /api/titip/:id/jadikan-listing` | owner | tinjau pengajuan |
| `GET /api/pantau` | pembeli login | properti miliknya (format desain) |
| `GET /api/pantau?scope=owner`, `POST`, `PATCH/DELETE /api/pantau/:id` | owner | progres pembeli |
| `GET /api/wilayah/provinsi`, `GET /api/wilayah/kota?provinsi=31` | publik | API wilayah terbuka (emsifa), di-cache 1 hari |
| `POST /api/upload` (multipart `photos`) | owner | foto listing ke bucket publik `listing` |

Pembeli melihat "Pantau properti" miliknya bila owner mengisi nomor WA / email pembeli di dashboard; data tertaut otomatis saat pembeli login.

## Lokasi & kota
- Formulir titip dan formulir listing di dashboard memakai daftar provinsi + kab/kota dari API wilayah terbuka.
- Filter kota di daftar listing berisi kota yang benar-benar punya listing tayang.

## Struktur
- `design/Main.dc.html`: sumber desain dari Amel. `npm run convert-design` mengonversinya ke `components/DesignComponent.jsx` lalu `scripts/integrate-backend.mjs` memasang titik sambung backend (props `listings`, `owned`, `sessionUser`, `onSubmitTitip`, dst.). Bila desain baru membuat titik sambung hilang, skrip berhenti dengan pesan error.
- `components/VinmelApp.jsx`: pembungkus klien (sesi, pantau, kirim titip)
- `components/owner/*`: dashboard owner (tampilan sementara sampai desain CMS dari Amel siap)
- `lib/`: akses data (`listings`, `titip`, `pantau`, `auth`, `wilayah`), klien Supabase
- `supabase/`: migrasi skema + RLS + storage, seed, config CLI
- `data/dummy/`: data dummy (diambil dari desain). `npm run data:export` membuat ulang JSON dan `supabase/seed.sql`
