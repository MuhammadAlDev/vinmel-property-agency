// Menyambungkan komponen hasil konversi desain (components/DesignComponent.jsx) ke backend.
// Dijalankan otomatis oleh `npm run convert-design` setelah konversi, jadi desain baru dari Amel
// cukup ditaruh di design/Main.dc.html lalu dikonversi ulang. Bila desain berubah dan sebuah
// titik sambung tidak ketemu lagi, skrip ini berhenti dengan pesan error (jangan diabaikan).
//
// Props baru DesignComponent (semua opsional; tanpa props, perilaku = desain asli):
//   listings      : data listing dari backend (bentuk sama dengan data dummy desain)
//   cities        : daftar kota untuk filter listing
//   cityGroups    : [{ label: provinsi, opts: [kota...] }] dari API wilayah untuk formulir titip
//   owned         : data "Pantau properti" milik pembeli yang login
//   sessionUser   : user dari sesi backend; null = pasti belum login, undefined = pakai localStorage (mode pratinjau)
//   onLogin(u) / onLogout() : dipanggil setelah login / keluar
//   onSubmitTitip(tp) : Promise<{ ref }> untuk mengirim pengajuan titip ke backend
import fs from 'node:fs';

const file = process.argv[2] || 'components/DesignComponent.jsx';
let src = fs.readFileSync(file, 'utf8');

const patches = [
  ['data listing dari props',
    '    var data = [\n',
    '    var data = (this.props.listings && this.props.listings.length) ? this.props.listings : [\n'],
  ['listing pilihan (featured)',
    'return d.id <= 8 && (s.filter',
    'return (d.featured != null ? d.featured : d.id <= 8) && (s.filter'],
  ['daftar kota filter dari props',
    '    var cities = [',
    '    var cities = (this.props.cities && this.props.cities.length) ? this.props.cities : ['],
  ['data pantau dari props',
    '    var OWNED = [',
    '    var OWNED = (this.props.owned && this.props.owned.length) ? this.props.owned : ['],
  ['foto progres berupa URL',
    'var item = { src: PIMG[ph[0]], alt',
    'var item = { src: PIMG[ph[0]] || ph[0], alt'],
  ['user dari sesi backend',
    '    var user = s.user || null;',
    "    var user = this.props.sessionUser !== undefined ? this.props.sessionUser : (s.user || null);"],
  ['hook logout',
    'NX.logout = function () { ',
    'NX.logout = function () { if (self.props.onLogout) self.props.onLogout(); '],
  ['hook login',
    'var doLogin = function (u) { ',
    'var doLogin = function (u) { if (self.props.onLogin) self.props.onLogin(u); '],
  ['kirim titip ke backend',
    "      var ref = 'VMA-TP-' + String(Date.now()).slice(-6);\n      setTp({ submitted: true, stage: 0, ref: ref, tried: false });",
    "      if (tp.sending) return;\n" +
    "      if (self.props.onSubmitTitip) {\n" +
    "        setTp({ sending: true, tried: false });\n" +
    "        Promise.resolve(self.props.onSubmitTitip(tp)).then(function (r) {\n" +
    "          setTp({ sending: false, submitted: true, stage: 0, ref: (r && r.ref) || '', tried: false });\n" +
    "        }, function (err) {\n" +
    "          setTp({ sending: false });\n" +
    "          self.toast((err && err.message) || 'Pengajuan belum terkirim. Coba lagi.');\n" +
    "        });\n" +
    "        return;\n" +
    "      }\n" +
    "      var ref = 'VMA-TP-' + String(Date.now()).slice(-6);\n      setTp({ submitted: true, stage: 0, ref: ref, tried: false });"],
  ['label tombol kirim titip',
    "tpNextLabel: tp.step < 5 ? 'Lanjut' : 'Kirim untuk direview'",
    "tpNextLabel: tp.step < 5 ? 'Lanjut' : tp.sending ? 'Mengirim…' : 'Kirim untuk direview'"],
  ['komisi open listing', "'Komisi [X]% saat transaksi'", "'Komisi 5–10% saat transaksi'"],
  ['komisi eksklusif', "'Komisi [Y]% saat transaksi'", "'Komisi 5–10% saat transaksi'"],
  ['opsi kota titip (nilai)',
    '      cityOpts: ',
    "      tpCityGroups: (this.props.cityGroups && this.props.cityGroups.length) ? this.props.cityGroups : [{ label: 'Kota', opts: cities }],\n      cityOpts: "],
];

for (const [name, from, to] of patches) {
  if (src.includes(to) && (to.includes(from) || !src.includes(from))) continue; // sudah terpasang
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`[integrate] titik sambung "${name}" ditemukan ${n}x (harus 1). Periksa desain baru.`);
  src = src.replace(from, () => to);
}

// Opsi kota di formulir titip: ganti <option> statis dengan daftar kab/kota dari API wilayah.
const OPT_RE = /(<option value=\{""\}>\{"Pilih kota"\}<\/option>)((?:<option value=\{"[^"]*"\}>\{"[^"]*"\}<\/option>)+)(<\/select>)/;
if (!src.includes('v.tpCityGroups')) {
  if (!OPT_RE.test(src)) throw new Error('[integrate] select kota formulir titip tidak ditemukan.');
  src = src.replace(OPT_RE, (_, first, __, close) =>
    first + '{((v.tpCityGroups) || []).map((g, gi) => (<optgroup key={gi} label={g.label}>{(g.opts || []).map((c) => (<option key={c} value={c}>{c}</option>))}</optgroup>))}' + close);
}

fs.writeFileSync(file, src);
console.log('integrate ok');
