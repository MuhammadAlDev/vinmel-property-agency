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
// Tambahan untuk desain Amel 2026-11-06 (penjual, review titip, profil owner, data pasar):
//   pemilik       : data pemilik akun penjual dari backend (tanpa `name` = belum lengkap); undefined = localStorage
//   onPemilik(rec): simpan data pemilik ke backend (ganti localStorage `pemilik`)
//   onUpload(file, kind, index): unggah foto profil owner (kind 'owner') / testimoni (kind 'testimoni', index baris) ke storage
//   market        : { HP, YL, hp0, yl0 } data pasar per kota dari tabel market_area_stats
// Revisi 2 (2026-11-06): cms.extraSteps / stepState / handover dari props.cms (disimpan VinmelApp ke /api/pantau/:id/progres),
//   onUtjProof({ propId, name, phone, invNo, proof }) : Promise<{ inv }> kirim bukti transfer UTJ ke bucket privat
// Owner TIDAK dideteksi dari daftar email/nomor di browser: hanya dari user.role === 'owner' yang dikirim server.
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
  ['hook login + peran dari server',
    'var doLogin = function (u) {\n',
    "var doLogin = function (u) {\n      if (u.role === 'seller') u.role = 'penjual'; else if (u.role === 'buyer') u.role = 'pembeli';\n      if (self.props.onLogin) self.props.onLogin(u);\n"],
  ['kontak owner dari akun yang login',
    "contact: u.via === 'google' ? (u.email || 'miracle.studio.ina@gmail.com') : '0831-8231-1993' };",
    "contact: u.via === 'google' ? (u.email || '') : (u.phone || '') };"],
  ['verifikasi OTP membawa peran',
    "post('/auth/otp/verify', { phone: '62' + normPhone(a.phone).slice(1), code: a.code, name: u.name })",
    "post('/auth/otp/verify', { phone: '62' + normPhone(a.phone).slice(1), code: a.code, name: u.name, role: u.role })"],
  ['data pemilik saat login dari backend',
    "var pmSaved = self.load('pemilik', null);",
    "var pmSaved = u.pemilik !== undefined ? u.pemilik : self.props.pemilik !== undefined ? self.props.pemilik : self.load('pemilik', null);"],
  ['data pemilik dari props',
    'var pmStored = s.pmStored || null;',
    'var pmStored = this.props.pemilik !== undefined ? this.props.pemilik : (s.pmStored || null);'],
  ['simpan data pemilik ke backend',
    "self.store('pemilik', rec);",
    "if (self.props.onPemilik) self.props.onPemilik(rec); else self.store('pemilik', rec);"],
  ['foto profil owner ke storage',
    "try { put('photo', URL.createObjectURL(f)); } catch (x) {}",
    "if (self.props.onUpload) { self.props.onUpload(f, 'owner'); return; } try { put('photo', URL.createObjectURL(f)); } catch (x) {}"],
  ['foto testimoni ke storage',
    "var u = ''; try { u = URL.createObjectURL(f); } catch (x2) {} if (u) setTesti(i, 'photo', u);",
    "if (self.props.onUpload) { self.props.onUpload(f, 'testimoni', i); return; } var u = ''; try { u = URL.createObjectURL(f); } catch (x2) {} if (u) setTesti(i, 'photo', u);"],
  ['testimoni persona ditandai contoh',
    'NX.TESTI0 = TESTI0;',
    'TESTI0.forEach(function (x) { x.sample = true; });\n    NX.TESTI0 = TESTI0;'],
  ['label Contoh selama ada testimoni contoh',
    'isSample: !AB.name || !testiCm.length ||',
    'isSample: testiCm.some(function (x) { return x.sample; }) || !AB.name || !testiCm.length ||'],
  ['data pasar (kenaikan harga) dari tabel',
    '      var HP = {\n',
    '      var MK = self.props.market || null;\n      var HP = (MK && MK.HP && Object.keys(MK.HP).length ? MK.HP : null) || {\n'],
  ['data pasar (yield) dari tabel',
    '      var YL = {\n',
    '      var YL = (MK && MK.YL && Object.keys(MK.YL).length ? MK.YL : null) || {\n'],
  ['data pasar nasional (kenaikan) dari tabel',
    'var hp = HP[dd.city] || [',
    'var hp = HP[dd.city] || (MK && MK.hp0) || ['],
  ['data pasar nasional (yield) dari tabel',
    'var yl = YL[dd.city] || [',
    'var yl = YL[dd.city] || (MK && MK.yl0) || ['],
  ['detail review pengajuan backend tidak ditimpa formulir lokal',
    'TPI.forEach(function (it) {\n      if (it.real) {',
    'TPI.forEach(function (it) {\n      if (it.db) return;\n      if (it.real) {'],
  ['aksi review pengajuan backend lewat onCms',
    'if (it.real) { cmSet(patch); setTp({ stage: stage }); } else {',
    'if (it.real && !it.db) { cmSet(patch); setTp({ stage: stage }); } else {'],
  ['catatan owner untuk penjual dari backend',
    "tpRevisionNotes: ((s.cms || {}).tpMsg || {})[tp.ref] ? [((s.cms || {}).tpMsg || {})[tp.ref]] : [",
    "tpRevisionNotes: ((this.props.cms || s.cms || {}).tpMsg || {})[tp.ref] ? [((this.props.cms || s.cms || {}).tpMsg || {})[tp.ref]] : this.props.live ? ['Owner belum menulis catatan. Tanyakan rinciannya lewat WhatsApp.'] : ["],
  ['status titipan backend di halaman status',
    "status: function () { self.setState({ showOd: false, showTitip: true }); },",
    "status: function () { if (it.db) setTp({ submitted: true, stage: it.stage, ref: it.ref, title: it.title, city: it.city || '', address: it.address || '', price: it.priceDots || '', deal: it.deal || 'Dijual', step: 1 }); self.setState({ showOd: false, showTitip: true }); },"],
  ['progres pembeli (tahap tambahan, status tahap, serah terima) dari props.cms',
    'var CMX = s.cms || {}, BUYER0 = {',
    'var CMX = this.props.cms || s.cms || {}, BUYER0 = this.props.live ? {} : {'],
  ['kirim bukti UTJ ke backend',
    "          var inv = String(bkF.invNo || '').trim() || 'UTJ-' + String(Date.now()).slice(-6);\n",
    "          if (self.props.onUtjProof) {\n" +
    "            if (bkF.busy) return;\n" +
    "            var bkMerge = function (p) { self.setState({ bkF: Object.assign({}, self.state.bkF || {}, p) }); };\n" +
    "            bkMerge({ busy: true, err: '' });\n" +
    "            self.props.onUtjProof({ propId: bkD2.id, name: String(bkF.name).trim(), phone: normPhone(bkF.phone), invNo: String(bkF.invNo || '').trim(), proof: bkF.proof })\n" +
    "              .then(function (r) { bkMerge({ busy: false, done: true, inv: (r && r.inv) || '', err: '' }); }, function (e) { bkMerge({ busy: false, err: (e && e.message) || 'Bukti belum terkirim. Coba lagi.' }); });\n" +
    "            return;\n" +
    "          }\n" +
    "          var inv = String(bkF.invNo || '').trim() || 'UTJ-' + String(Date.now()).slice(-6);\n"],
  ['kotak angka kepercayaan kosong disembunyikan (placeholder [ANGKA] tidak dihitung terisi)',
    "var st = NX.ab.stats.filter(function (x) { return String(x.v || '').trim() || String(x.l || '').trim(); }).slice(0, 4);",
    "var st = NX.ab.stats.filter(function (x) { var v0 = String(x.v || '').trim(); return (v0 && v0 !== '[ANGKA]') || String(x.l || '').trim(); }).slice(0, 4);"],
  ['sembunyikan simulasi status di mode live (nilai)',
    'tpDemoNext: function () {',
    'tpDemoHide: !!this.props.live, tpDemoNext: function () {'],
  ['sembunyikan simulasi status di mode live (buka)',
    '<div style={{ border: "1.5px dashed #C9D1C6", borderRadius: "18px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>{" "}<span style={{ fontSize: "12px", fontWeight: "800", color: "#4A5751", letterSpacing: ".06em" }}>{v.L?.m108}</span>',
    '{v.tpDemoHide ? null : (<div style={{ border: "1.5px dashed #C9D1C6", borderRadius: "18px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>{" "}<span style={{ fontSize: "12px", fontWeight: "800", color: "#4A5751", letterSpacing: ".06em" }}>{v.L?.m108}</span>'],
  ['sembunyikan simulasi status di mode live (tutup)',
    '{v.tpDemoLabel}</button>{" "}</div>',
    '{v.tpDemoLabel}</button>{" "}</div>)}'],
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

const broken = [];
for (const [name, from, to] of patches) {
  if (src.includes(to) && (to.includes(from) || !src.includes(from))) continue; // sudah terpasang
  const n = src.split(from).length - 1;
  if (n !== 1) { broken.push(`"${name}" ditemukan ${n}x`); continue; }
  src = src.replace(from, () => to);
}
// Owner hanya boleh ditentukan server (sejak Revisi 2 desain sendiri memakai u.role === 'owner'). Tolak bila daftar kontak owner muncul lagi.
if (/OWNER_IDS|miracle\.studio\.ina@gmail\.com'\]/.test(src)) broken.push('daftar kontak owner (OWNER_IDS) muncul lagi di desain; hapus, owner dicek di server');
if (broken.length) throw new Error('[integrate] titik sambung harus ada tepat 1x. Periksa desain baru:\n  ' + broken.join('\n  '));

// Opsi kota di formulir titip: ganti <option> statis dengan daftar kab/kota dari API wilayah.
const OPT_RE = /(<option value=\{""\}>\{(?:"Pilih kota"|v\.L\?\.m44)\}<\/option>)((?:<option value=\{"[^"]*"\}>\{"[^"]*"\}<\/option>)+)(<\/select>)/;
if (!src.includes('v.tpCityGroups')) {
  if (!OPT_RE.test(src)) throw new Error('[integrate] select kota formulir titip tidak ditemukan.');
  src = src.replace(OPT_RE, (_, first, __, close) =>
    first + '{((v.tpCityGroups) || []).map((g, gi) => (<optgroup key={gi} label={g.label}>{(g.opts || []).map((c) => (<option key={c} value={c}>{c}</option>))}</optgroup>))}' + close);
}

fs.writeFileSync(file, src);
console.log('integrate ok');
