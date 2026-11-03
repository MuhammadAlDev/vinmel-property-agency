import './globals.css';

export const metadata = {
  title: 'Vinmel Agency — Agen Properti',
  description: 'Vinmel Property Agency: cari rumah, kos, apartemen, dan tanah dengan cara digital yang cerdas.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        {/* CSS desain disajikan apa adanya (tanpa diproses build) agar hasilnya identik dengan artifact. */}
        <link rel="stylesheet" href="/design.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
