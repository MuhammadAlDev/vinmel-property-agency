# Vinmel Property Agency

Website Vinmel Agency dengan Next.js + Tailwind CSS. Tampilan dan perilakunya mengikuti desain di artifact Claude (`design/Main.dc.html`) secara 1:1.

## Halaman (dalam satu aplikasi)
- Beranda: hero, pencarian, listing pilihan, cara kerja, CTA titip properti, footer
- Semua listing + filter (kota, harga, luas, sertifikat, dekat saya/GPS)
- Detail properti (galeri, spesifikasi, fasilitas, legalitas, tombol WhatsApp). Bisa dibuka langsung lewat link `/#properti-<slug>`
- Bandingkan properti (beserta rekomendasi otomatis)
- Simulasi KPR
- Titip properti (formulir 5 langkah)
- Pantau properti saya (timeline pembangunan dan legalitas)
- Chatbot "Cimel"

## Menjalankan
```bash
npm install
npm run dev
```
Buka http://localhost:3000.

## Konfigurasi
Salin `.env.example` menjadi `.env`, lalu isi:
- `DATABASE_URL`: koneksi PostgreSQL (lihat bagian Database)
- `NEXT_PUBLIC_WA_NUMBER`: nomor WhatsApp agen (contoh `6281234567890`)
- `NEXT_PUBLIC_SITE_URL`: URL website, dipakai untuk link properti di pesan WhatsApp

## Database (PostgreSQL + Prisma)

### 1. Pasang PostgreSQL di macOS
Pilih salah satu:
- **Postgres.app** (paling mudah): unduh dari https://postgresapp.com, pindahkan ke Applications, buka, lalu klik **Initialize**. Server berjalan di `localhost:5432` dengan user = nama user Mac Anda, tanpa password.
- **Homebrew**:
  ```bash
  brew install postgresql@17
  brew services start postgresql@17
  ```

### 2. Buat database `vinmel`
```bash
createdb vinmel
```
(Dengan Postgres.app, tambahkan dulu `/Applications/Postgres.app/Contents/Versions/latest/bin` ke PATH, atau jalankan dari menu **Open psql**.)

### 3. Isi `DATABASE_URL` di `.env`
```
DATABASE_URL="postgresql://NAMA_USER_MAC@localhost:5432/vinmel"
```
Cek nama user Mac dengan perintah `whoami`.

### 4. Buat tabel dan isi data contoh
```bash
npm install
npm run db:migrate
npm run db:seed
```
Untuk melihat dan mengedit data lewat browser:
```bash
npm run db:studio
```

### Tabel
| Tabel | Isi |
|---|---|
| `users` | Akun pembeli, pemilik, agen, admin |
| `properties` | Listing properti (harga, ukuran, spesifikasi, fasilitas, legalitas, lokasi) |
| `property_photos` | Foto tiap listing |
| `titip_submissions` | Pengajuan titip properti (formulir 5 langkah) beserta tahapnya |
| `submission_stage_logs` | Riwayat perubahan tahap pengajuan (review, revisi, survei, approval, tayang) |
| `ownerships` | Properti milik pembeli yang dipantau ("Pantau properti saya") |
| `construction_steps`, `construction_photos` | Timeline pembangunan dan foto progresnya |
| `legal_steps` | Tahap legalitas (sertifikat, PBG, PPJB, SHM, AJB, balik nama, PBB) |
| `notaries` | Data notaris/PPAT |
| `leads` | Calon pembeli/penyewa dari WhatsApp, chatbot, KPR, dll. |
| `chat_sessions`, `chat_messages` | Riwayat chat dengan asisten Cimel |

Skema lengkap ada di `prisma/schema.prisma`, migrasi SQL di `prisma/migrations/`, dan data contoh di `prisma/seed-data.json` (diambil dari desain).

> Catatan: tampilan website saat ini masih memakai data contoh di dalam komponen. Menghubungkan halaman ke database adalah tahap berikutnya.

## Struktur
- `components/DesignComponent.jsx`: komponen hasil konversi otomatis dari desain (jangan diedit manual kalau masih ingin sinkron dengan desain)
- `public/design.css`: CSS dari desain, disajikan apa adanya
- `public/assets/`: foto dan ikon
- `design/Main.dc.html`: sumber desain dari artifact
- `scripts/convert-design.mjs`: konverter desain → React. Jalankan `npm run convert-design` setelah memperbarui `design/Main.dc.html`
- Tailwind dipasang tanpa preflight (reset CSS) agar tampilan desain tidak berubah. Utility class Tailwind tetap bisa dipakai untuk komponen baru.
