// Format angka ke label yang dipakai desain (contoh "Rp 1,85 M", "Rp 1,6 jt", "120 m²").
const dots = (v) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const dec = (v, n) => String(+v.toFixed(n)).replace('.', ',');

export function priceLabel(num) {
  const v = Number(num) || 0;
  if (v >= 1e9) return 'Rp ' + dec(v / 1e9, 2) + ' M';
  if (v >= 1e6) return 'Rp ' + dec(v / 1e6, 1) + ' jt';
  return 'Rp ' + dots(v);
}
export const m2Label = (num) => (Number(num) > 0 ? dec(Number(num), 1) + ' m²' : '—');
export const countLabel = (num) => (Number(num) > 0 ? String(num) : '—');
export const slugOf = (d) => String(d.title + ' ' + d.location).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function normPhone62(p) {
  let d = String(p || '').replace(/[^0-9]/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  return /^628\d{7,12}$/.test(d) ? d : '';
}
