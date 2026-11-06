// Buat supabase/seed.sql dari data dummy (data/dummy/*.json).
// Usage: node scripts/generate-seed.mjs
import fs from 'node:fs';

const read = (f) => JSON.parse(fs.readFileSync(new URL('../data/dummy/' + f, import.meta.url), 'utf8'));
const listings = read('listings.json');
const pantau = read('pantau.json');

const q = (v) => (v == null ? 'null' : "'" + String(v).replace(/'/g, "''") + "'");
const arr = (a) => 'array[' + (a || []).map(q).join(', ') + ']::text[]';
const js = (o) => q(JSON.stringify(o ?? {})) + '::jsonb';
const slugOf = (d) => String(d.title + ' ' + d.location).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

let out = `-- AUTO-GENERATED oleh scripts/generate-seed.mjs dari data/dummy/*.json. Data dummy untuk pengembangan.
-- Jalankan setelah migrasi: supabase db reset (lokal) atau tempel di SQL editor.

`;
out += 'insert into public.properties (id, slug, status, featured, type, deal, title, location, city, price_num, price_label, unit, lt_num, lb_num, kt_num, lt_label, lb_label, kt_label, km_label, cert, lat, lng, photos, description, fasilitas, ext) values\n';
out += listings.map((d) => '  (' + [
  d.id, q(slugOf(d)), q('tayang'), d.featured ? 'true' : 'false', q(d.type), q(d.deal), q(d.title), q(d.location), q(d.city),
  d.priceNum, q(d.price), q(d.unit || ''), d.ltNum || 0, d.lbNum || 0, d.ktNum || 0, q(d.lt), q(d.lb), q(d.kt), q(d.km), q(d.cert),
  d.lat, d.lng, arr(d.photos), arr(d.desc), arr(d.fasilitas), js(d.ext),
].join(', ') + ')').join(',\n') + ';\n';
out += "select setval(pg_get_serial_sequence('public.properties', 'id'), (select max(id) from public.properties));\n\n";

out += '-- Contoh pembelian untuk fitur "Pantau properti". Isi buyer_phone (format 628xx) agar tertaut ke akun pembeli.\n';
pantau.forEach((o, i) => {
  const pid = `00000000-0000-4000-8000-00000000000${i + 1}`;
  out += `insert into public.purchases (id, buyer_phone, title, unit, location, cover, progress, status_text, purchased_on, handover, notary) values (${[
    q(pid), 'null', q(o.title), q(o.unit), q(o.location), q(o.cover), o.progress, q(o.statusText), q(o.purchased), q(o.handover), js(o.notary),
  ].join(', ')});\n`;
  const rows = [];
  o.steps.forEach((s, j) => rows.push([q(pid), q('build'), j, q(s.title), q(s.date), q(s.state), s.pct ?? 'null', q(s.note), q(''), js(s.photos)]));
  o.legal.forEach((s, j) => rows.push([q(pid), q('legal'), j, q(s.title), q(s.date), q(s.state), s.pct ?? 'null', q(s.note), q(s.doc || ''), js([])]));
  out += 'insert into public.purchase_steps (purchase_id, kind, position, title, date_text, state, pct, note, doc, photos) values\n' +
    rows.map((r) => '  (' + r.join(', ') + ')').join(',\n') + ';\n';
});

out += `
-- Akun owner: tambahkan email Google / nomor WA pengelola agar otomatis jadi owner saat pertama login.
-- insert into public.owner_allowlist (email, note) values ('email-owner@contoh.com', 'Owner Vinmel');
-- insert into public.owner_allowlist (phone, note) values ('62xxxxxxxxxx', 'Owner Vinmel');
`;
fs.mkdirSync(new URL('../supabase/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../supabase/seed.sql', import.meta.url), out);
console.log('seed.sql:', out.length, 'byte');
