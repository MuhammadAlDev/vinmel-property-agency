# Vinmel Property Agency

Website Vinmel Agency dengan Next.js 16 + Tailwind CSS + **Supabase** (database, Auth, Storage). Tampilan publik mengikuti desain di artifact Claude (`design/Main.dc.html`).

## Halaman
- `/` website publik: beranda, listing + filter, detail, bandingkan, KPR, **titip properti** (terkirim ke backend), **pantau properti saya** (data pembeli yang login), login OTP WhatsApp / Google, favorit, jadwal survei, peta OpenStreetMap
- `/#owner` (atau `/owner`, dialihkan ke sini) **CMS owner** dari desain Amel: ringkasan, listing (judul, harga, harga coret, status Tayang/Booked/Terjual/Draft, link video & tur 360°), pengajuan titip, jadwal survei, UTJ & pembayaran, pembeli & progres (update + foto), konten & kontak. Login owner lewat WhatsApp OTP / Google; peran owner ditentukan `owner_allowlist`.
- **Halaman pembeli** (Pantau properti saya): progres + kabar terbaru dari CMS, pembayaran, dokumen, legalitas. Akun: status jadwal survei dari owner, properti titipan saya.
- `/owner/lanjutan` alat lanjutan owner (dashboard lama): tambah listing lengkap + foto + koordinat, jadikan pengajuan titip draft listing, tahap pembangunan & legalitas pembeli, hapus listing
- Chatbot "Cimel" dan "Rekomendasi AI" masih versi lokal dari desain (ditunda, belum memakai LLM)

## Mode kerja
| Kondisi | Perilaku |
| --- | --- |
| Env Supabase kosong (mode demo) | Data dari `data/dummy/*.json`. CMS di situs = pratinjau desain (localStorage + data contoh). Alat lanjutan `/owner/lanjutan` hanya bisa dibuka saat `npm run dev` (memori server, hilang saat restart). |
| Mode demo + `VINMEL_DEMO_AS=owner` atau `buyer` (hanya `npm run dev`) | Menyimulasikan sesi owner/pembeli supaya alur CMS → API → halaman pembeli bisa dicoba tanpa Supabase (data di memori server). Tidak berlaku di production. |
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
2. Jalankan migrasi berurutan lalu seed. Cara CLI (project Vinmel: `vpizftkeoemvkzllcbik`):
   `npx supabase login` → `npx supabase link --project-ref vpizftkeoemvkzllcbik` → `npx supabase db push` → jalankan isi `supabase/seed.sql` di SQL editor (atau `npx supabase db push --include-seed`).
   Cara SQL editor: tempel berurutan `20261104120000_init.sql`, `20261105120000_cms_owner_pembeli.sql`, `20261105130000_superadmin_penjual.sql`, `20261106120000_penjual_review_profil.sql`, lalu `seed.sql`. Migrasi setelah init hanya menambah; rollback ada di akhir file.
   Migrasi 2026-11-06: `seller_profiles` (data pemilik penjual), `titip_reviews` + `titip_checklist` (review & approval, tahap 6 = Ditolak, approval ditolak database bila checklist belum lengkap), `market_area_stats` (data pasar per kota, perbarui tiap kuartal lewat SQL editor), bucket publik `konten` (foto profil owner & testimoni).
3. Buat akun awal (superadmin owner, pembeli testing, penjual testing). Password hanya lewat env, jangan ditulis ke file:
   `OWNER_PASSWORD='<password>' npm run db:accounts`
   Email default: superadmin owner `alfiyandzulfikri@gmail.com`, pembeli testing `alfiyandzulfikri+test1@gmail.com`, penjual testing `alfiyandzulfikri+test2@gmail.com` (bisa diganti lewat `OWNER_EMAIL`, `TEST_BUYER_EMAIL`, `TEST_SELLER_EMAIL`).
   Skrip aman diulang (akun yang sudah ada diperbarui). Owner otomatis masuk `owner_allowlist`, jadi login Google/WA dengan email/nomor yang sama juga menjadi owner. Pembeli testing ditautkan ke contoh pembelian pertama di seed, penjual testing mendapat 1 contoh pengajuan titip. Password akun testing diacak dan dicetak sekali bila `TEST_BUYER_PASSWORD` / `TEST_SELLER_PASSWORD` kosong.
   Peran: `owner` (CMS; `is_superadmin` = owner utama, hanya bisa diubah lewat service role), `buyer`, `seller` (otomatis bila akun mengajukan titip, mengisi data pemilik, atau login/daftar sebagai penjual). Owner selalu dicek di server dari tabel `profiles` (diisi lewat `owner_allowlist`); browser tidak punya daftar email/nomor owner. Profil owner di situs hanya bisa diubah superadmin. Login email + password: `POST /api/auth/password` (juga ada di form /owner/lanjutan).
4. **Google OAuth**: buat OAuth Client (Web) di Google Cloud Console, redirect URI `https://<project>.supabase.co/auth/v1/callback`, lalu isi Client ID/Secret di Supabase > Authentication > Providers > Google. Tambahkan `https://<domain>/api/auth/callback` ke Authentication > URL Configuration > Redirect URLs.
5. **OTP WhatsApp**: Supabase > Authentication > Providers > Phone, pilih Twilio (atau Twilio Verify) dengan nomor pengirim WhatsApp yang sudah disetujui. Server memanggil `signInWithOtp({ channel: 'whatsapp' })`.

Untuk lokal dengan Supabase CLI: `npx supabase start` (memakai `supabase/config.toml`, kredensial dari env).

## API (route handler Next.js, `app/api`)
| Endpoint | Akses | Keterangan |
| --- | --- | --- |
| `POST /api/auth/password` `{email,password}` | publik | login email + password (owner/akun testing) |
| `POST /api/auth/register` `{phone,code,name,email,city,status}` | publik | daftar akun penjual (OTP WA diverifikasi Supabase) |
| `GET/PUT /api/penjual/profil` | user login | data pemilik akun penjual |
| `POST /api/titip/:id/review` `{stage,action,note}` | owner | aksi review + riwayat (revisi/tolak wajib catatan ≥10 huruf, setujui wajib checklist lengkap) |
| `PUT /api/titip/:id/checklist` `{checks}` | owner | checklist verifikasi titip |
| `POST /api/cms/foto` (multipart `photo`, `kind`) | owner (`kind=owner`: superadmin) | foto profil owner / testimoni ke bucket `konten` |
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
| `GET /api/cms` | owner | semua data CMS dalam bentuk state desain (konten, listing, titip, survei, UTJ, pembeli, update) |
| `PATCH /api/cms/listing/:id` `{title, price, was, status, video, tour}` | owner | edit listing dari CMS desain |
| `GET /api/cms/konten`, `PUT /api/cms/konten` `{about, stats, testi}` | publik / owner | Tentang Vinmel, angka kepercayaan, testimoni |
| `POST /api/survei`, `GET /api/survei` | publik / user login | jadwal survei dari situs (uid, nomor WA, catatan); daftar milik user |
| `PATCH /api/survei/:uid` `{status: baru\|ok\|selesai\|batal}` | owner | konfirmasi survei |
| `POST /api/utj` `{propId}` | user login | permintaan invoice UTJ (rumah & apartemen dijual) |
| `PATCH /api/utj/:inv` `{status: baru\|invoice\|bukti\|ok\|batal}` | owner | alur UTJ; `ok` → listing Booked |
| `POST /api/pantau/:id/updates` (multipart `step, pct, note, photos`), `DELETE /api/pantau/:id/updates/:uid` | owner | update progres + foto ke bucket privat `progres` (pembeli melihat lewat signed URL) |
| `GET /api/auth/whatsapp?role=owner&next=` | publik | kembali ke halaman dengan `?masuk=wa` untuk membuka form OTP |

Pembeli melihat "Pantau properti" miliknya bila owner mengisi nomor WA / email pembeli di dashboard; data tertaut otomatis saat pembeli login.

## Lokasi & kota
- Formulir titip dan formulir listing di dashboard memakai daftar provinsi + kab/kota dari API wilayah terbuka.
- Filter kota di daftar listing berisi kota yang benar-benar punya listing tayang.

## Struktur
- `design/Main.dc.html`: sumber desain dari Amel. `npm run convert-design` mengonversinya ke `components/DesignComponent.jsx` lalu `scripts/integrate-backend.mjs` memasang titik sambung backend (props `listings`, `owned`, `sessionUser`, `onSubmitTitip`, dst.). Bila desain baru membuat titik sambung hilang, skrip berhenti dengan pesan error.
- `components/VinmelApp.jsx`: pembungkus klien (sesi, data CMS sesuai peran, menyimpan setiap aksi CMS ke API)
- `components/owner/*`: alat lanjutan owner (`/owner/lanjutan`)
- `lib/`: akses data (`listings`, `titip`, `pantau`, `cms`, `auth`, `wilayah`), klien Supabase
- `supabase/`: migrasi skema + RLS + storage, seed, config CLI
- `data/dummy/`: data dummy (diambil dari desain). `npm run data:export` membuat ulang JSON dan `supabase/seed.sql`
