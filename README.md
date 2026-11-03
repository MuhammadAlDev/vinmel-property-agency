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
Salin `.env.example` menjadi `.env.local`, lalu isi:
- `NEXT_PUBLIC_WA_NUMBER`: nomor WhatsApp agen (contoh `6281234567890`)
- `NEXT_PUBLIC_SITE_URL`: URL website, dipakai untuk link properti di pesan WhatsApp

## Struktur
- `components/DesignComponent.jsx`: komponen hasil konversi otomatis dari desain (jangan diedit manual kalau masih ingin sinkron dengan desain)
- `public/design.css`: CSS dari desain, disajikan apa adanya
- `public/assets/`: foto dan ikon
- `design/Main.dc.html`: sumber desain dari artifact
- `scripts/convert-design.mjs`: konverter desain → React. Jalankan `npm run convert-design` setelah memperbarui `design/Main.dc.html`
- Tailwind dipasang tanpa preflight (reset CSS) agar tampilan desain tidak berubah. Utility class Tailwind tetap bisa dipakai untuk komponen baru.
