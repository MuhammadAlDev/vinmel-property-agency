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
// Tambahan untuk desain Amel 2026-11-05 (CMS owner & halaman pembeli):
//   live          : true = data dari backend (contoh/dummy di CMS disembunyikan, link /owner/lanjutan aktif)
//   cms           : state `cms` dari backend (about/stats/testi, svSt, utj, updates, progress, listing override sesi ini)
//   onCms(patch)  : dipanggil sebagai ganti simpan ke localStorage; VinmelApp yang menyimpan ke Supabase
//   surveys       : daftar jadwal survei (pembeli: miliknya; owner: semua)
//   onSurvey(rec) : jadwal survei baru dari situs
//   onUtjRequest(d): tombol "Minta invoice UTJ"
//   titipItems    : pengajuan titip dari backend (owner: semua; penitip: miliknya)
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
  // ===== CMS owner & halaman pembeli (desain 2026-11-05) =====
  ['login WA owner dari /api/auth/whatsapp (?masuk=wa)',
    "    try { if (window.location.hash === '#owner') this.setState({ showCms: true });",
    "    try { if (/[?&]masuk=wa(&|$)/.test(window.location.search)) { this.setState({ auth: { step: 'wa' } }); window.history.replaceState(null, '', window.location.pathname + window.location.hash); } } catch (e) {}\n    try { if (window.location.hash === '#owner') this.setState({ showCms: true });"],
  ['override listing dari props.cms',
    'var CMSL = (s.cms || {}).listing || {};',
    'var CMSL = (this.props.cms || s.cms || {}).listing || {};'],
  ['status/video/tour listing dari backend',
    "if (!o) return Object.assign({}, d, { status: 'tayang', video: '', tour: '' });",
    "if (!o) return Object.assign({}, d, { status: d.status || 'tayang', video: d.video || '', tour: d.tour || '' });"],
  ['status/video/tour override di atas data backend',
    "status: o.status || 'tayang', video: o.video || '', tour: o.tour || '' });",
    "status: o.status || d.status || 'tayang', video: o.video !== undefined ? o.video : (d.video || ''), tour: o.tour !== undefined ? o.tour : (d.tour || '') });"],
  ['state cms dari backend + simpan lewat onCms',
    "    var CM = s.cms || {};\n    var cmSet = function (patch) { var n",
    "    var CM = this.props.cms || s.cms || {};\n    var cmSet = function (patch) { if (self.props.onCms) { self.props.onCms(patch); return; } var n"],
  ['daftar survei akun dari backend',
    '    var surveys = s.surveys || [];',
    '    var surveys = this.props.surveys || s.surveys || [];'],
  ['kirim survei ke backend',
    "      self.setState({ surveys: list, sv: Object.assign({}, sv, { done: true, rec: rec }) });\n      self.store('survei', list);",
    "      self.setState({ surveys: list, sv: Object.assign({}, sv, { done: true, rec: rec }) });\n      self.store('survei', list);\n      if (self.props.onSurvey) self.props.onSurvey(Object.assign({}, rec, { date: sv.date, slot: sv.slot }));"],
  ['survei CMS dari backend',
    'var SVI = (s.surveys || []).map(',
    'var SVI = (this.props.surveys || s.surveys || []).map('],
  ['tanpa contoh survei di mode live',
    ".concat([\n      { uid: 'demo-sv-1'",
    ".concat(this.props.live ? [] : [\n      { uid: 'demo-sv-1'"],
  ['permintaan UTJ ke backend',
    "if (!isU) return;\n          var list = (self.state.cms && self.state.cms.utj || []).slice();",
    "if (!isU) return;\n          if (self.props.onUtjRequest) { self.props.onUtjRequest(bkD2); return; }\n          var list = (self.state.cms && self.state.cms.utj || []).slice();"],
  ['tanpa contoh UTJ di mode live',
    'var UTI = (CM.utj || []).concat([',
    'var UTI = (CM.utj || []).concat(this.props.live ? [] : ['],
  ['pengajuan titip dari backend',
    'var TPI = (tp.submitted ? [',
    'var TPI = (this.props.titipItems ? this.props.titipItems : tp.submitted ? ['],
  ['tanpa contoh titip di mode live',
    ": []).concat([\n      { ref: 'VMA-TP-118204'",
    ": []).concat(this.props.live ? [] : [\n      { ref: 'VMA-TP-118204'"],
  ['tahap titip backend lewat tpSt',
    'var setStage = function (it, n) { if (it.real) setTp({ stage: n });',
    'var setStage = function (it, n) { if (it.real && !it.db) setTp({ stage: n });'],
  ['owner dari sesi backend',
    '    var owner = s.owner || null;',
    "    var SU = this.props.sessionUser;\n    var owner = SU !== undefined ? (SU && SU.role === 'owner' ? { name: SU.name || 'Owner Vinmel', via: SU.via, contact: SU.via === 'google' ? (SU.email || '') : (SU.phone || '') } : null) : (s.owner || null);"],
  ['tolak login owner bila akun lain sedang masuk',
    "      if (api) { window.location.href = api + '/auth/' + (via === 'google'",
    "      if (api && self.props.sessionUser) { self.toast('Akun yang sedang masuk bukan akun owner. Keluar dulu lewat menu Akun, lalu masuk dengan WhatsApp/Google owner.'); return; }\n      if (api) { window.location.href = api + '/auth/' + (via === 'google'"],
  ['keluar CMS = keluar sesi backend',
    "logout: function () { self.setState({ owner: null }); self.store('owner', null);",
    "logout: function () { if (self.props.live) { if (self.props.onLogout) self.props.onLogout(); self.setState({ user: null, showCms: false }); self.store('user', null); self.toast('Keluar dari CMS owner.'); return; } self.setState({ owner: null }); self.store('owner', null);"],
  ['tambah listing lewat alat lanjutan',
    'addListing: function () { self.setState({ showCms: false, showTitip: true });',
    "addListing: function () { if (self.props.live) { window.location.href = '/owner/lanjutan?tab=listing'; return; } self.setState({ showCms: false, showTitip: true });"],
  ['teks reset listing di mode live',
    "self.toast('Listing dikembalikan ke data awal.');",
    "self.toast(self.props.live ? 'Kembali ke data yang tersimpan.' : 'Listing dikembalikan ke data awal.');"],
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
