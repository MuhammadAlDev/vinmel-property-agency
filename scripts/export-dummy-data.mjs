// Ambil data dummy (listing + contoh "Pantau properti") dari desain Amel
// lalu simpan sebagai JSON di data/dummy/. Dipakai backend (mode demo) dan seed Supabase.
// Usage: node scripts/export-dummy-data.mjs
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../components/DesignComponent.jsx', import.meta.url), 'utf8');

function grabArray(name) {
  const start = src.indexOf(`var ${name} = `);
  if (start < 0) throw new Error('tidak ketemu: ' + name);
  const open = src.indexOf('[', start);
  let depth = 0, i = open, str = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (str) { if (c === '\\') { i++; continue; } if (c === str) str = null; continue; }
    if (c === '"' || c === "'" || c === '`') { str = c; continue; }
    if (c === '[' || c === '{') depth++;
    if (c === ']' || c === '}') { depth--; if (depth === 0) break; }
  }
  return vm.runInNewContext('(' + src.slice(open, i + 1) + ')');
}
function grabObject(name) {
  const start = src.indexOf(`var ${name} = `);
  const open = src.indexOf('{', start);
  const end = src.indexOf('};', open);
  return vm.runInNewContext('(' + src.slice(open, end + 1) + ')');
}

const listings = grabArray('data').map((d) => ({ ...d, featured: d.id <= 8 }));
const PIMG = grabObject('PIMG');
const owned = grabArray('OWNED').map((o) => ({
  ...o,
  steps: o.steps.map((s) => ({ ...s, photos: s.photos.map(([k, label, date]) => ({ src: PIMG[k], label, date })) })),
}));

fs.writeFileSync(new URL('../data/dummy/listings.json', import.meta.url), JSON.stringify(listings, null, 2) + '\n');
fs.writeFileSync(new URL('../data/dummy/pantau.json', import.meta.url), JSON.stringify(owned, null, 2) + '\n');
console.log('listing:', listings.length, '| pantau:', owned.length);
