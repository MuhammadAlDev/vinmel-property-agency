import 'server-only';
// Data provinsi & kabupaten/kota dari API terbuka "API Wilayah Indonesia" (emsifa, statis, tanpa API key).
// https://github.com/emsifa/api-wilayah-indonesia — bisa diganti lewat env WILAYAH_API_BASE.
const BASE = (process.env.WILAYAH_API_BASE || 'https://www.emsifa.com/api-wilayah-indonesia/api').replace(/\/+$/, '');
const DAY = 60 * 60 * 24;

const title = (t) => String(t).toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\bDki\b/, 'DKI').replace(/\bDi\b/, 'DI');
// "KOTA ADM. JAKARTA SELATAN" -> "Jakarta Selatan", "KOTA BOGOR" -> "Bogor", "KABUPATEN BOGOR" -> "Kab. Bogor".
// Nama kota tanpa awalan "Kota" agar cocok dengan data listing & pencarian teks di desain.
export function cityName(raw, provinceId) {
  let n = String(raw).replace(/\s+/g, ' ').trim();
  n = n.replace(/^(KOTA|KABUPATEN) (ADM\.? |ADMINISTRASI )/, '$1 ');
  if (/^KABUPATEN /.test(n)) return 'Kab. ' + title(n.replace(/^KABUPATEN /, ''));
  return title(n.replace(/^KOTA /, ''));
}

async function get(path) {
  const r = await fetch(BASE + path, { next: { revalidate: DAY } });
  if (!r.ok) throw new Error('wilayah ' + path + ' ' + r.status);
  return r.json();
}

export async function getProvinces() {
  const list = await get('/provinces.json');
  return list.map((p) => ({ id: p.id, name: title(p.name) }));
}

export async function getCities(provinceId) {
  if (!/^\d{2}$/.test(String(provinceId))) return [];
  const list = await get(`/regencies/${provinceId}.json`);
  return list.map((c) => ({ id: c.id, provinceId: c.province_id, name: cityName(c.name, c.province_id) }));
}

// Semua kab/kota dikelompokkan per provinsi. Null bila API tidak bisa dihubungi.
export async function getCityGroups() {
  try {
    const provs = await getProvinces();
    const groups = await Promise.all(provs.map(async (p) => ({ label: p.name, id: p.id, opts: (await getCities(p.id)).map((c) => c.name) })));
    return groups;
  } catch {
    return null;
  }
}
