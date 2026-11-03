// Mengisi database dengan data contoh dari desain (16 properti, 2 properti "Pantau", akun demo).
// Jalankan: npx prisma db seed
import 'dotenv/config';
import fs from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../lib/generated/prisma/client.ts';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const seed = JSON.parse(fs.readFileSync(new URL('./seed-data.json', import.meta.url), 'utf8'));

const slugOf = (d) => String(d.title + ' ' + d.location).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const parseRp = (t) => {
  const m = String(t).replace(',', '.').match(/([\d.]+)\s*(M|jt)/);
  return m ? BigInt(Math.round(parseFloat(m[1]) * (m[2] === 'M' ? 1e9 : 1e6))) : null;
};
const intOrNull = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : null; };
const CERT = { SHM: 'SHM', HGB: 'HGB', Strata: 'STRATA', 'Girik/AJB': 'GIRIK_AJB' };
const STATE = { done: 'DONE', current: 'CURRENT', next: 'NEXT' };
const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, Mei: 4, Jun: 5, Jul: 6, Agu: 7, Sep: 8, Okt: 9, Nov: 10, Des: 11 };
const parseDate = (t) => {
  const m = String(t).match(/^(\d{1,2}) (\w{3}) (\d{4})$/);
  return m && m[2] in MONTHS ? new Date(Date.UTC(+m[3], MONTHS[m[2]], +m[1])) : null;
};

async function main() {
  // Kosongkan dulu supaya seed bisa dijalankan berulang kali
  await prisma.$executeRawUnsafe(
    'TRUNCATE chat_messages, chat_sessions, leads, construction_photos, construction_steps, legal_steps, ownerships, notaries, ' +
    'submission_stage_logs, titip_submissions, property_photos, properties, users RESTART IDENTITY CASCADE'
  );

  const agent = await prisma.user.create({ data: { name: 'Agen Vinmel', email: 'agen@vinmelagency.com', role: 'AGENT' } });
  await prisma.user.create({ data: { name: 'Admin Vinmel', email: 'admin@vinmelagency.com', role: 'ADMIN' } });
  const buyer = await prisma.user.create({ data: { name: 'Pembeli Demo', email: 'pembeli@contoh.com', role: 'BUYER' } });

  const idMap = {};
  for (const d of seed.properties) {
    const x = d.ext;
    const p = await prisma.property.create({
      data: {
        slug: slugOf(d),
        title: d.title,
        type: d.type.toUpperCase(),
        deal: d.deal === 'Dijual' ? 'DIJUAL' : 'DISEWA',
        isFeatured: d.id <= 8,
        location: d.location,
        city: d.city,
        lat: d.lat,
        lng: d.lng,
        price: BigInt(d.priceNum),
        wasPrice: x.was ? parseRp(x.was) : null,
        priceUnit: d.unit || '',
        landArea: d.ltNum || null,
        buildingArea: d.lbNum || null,
        bedrooms: d.ktNum || null,
        bathrooms: intOrNull(d.km),
        bedroomsLabel: d.kt,
        bathroomsLabel: d.km,
        floors: x.floors || null,
        unitType: x.unitType || null,
        outsideBathrooms: x.kmOut ?? null,
        facing: x.facing || null,
        roadside: typeof x.road === 'boolean' ? x.road : null,
        description: d.desc,
        highlights: d.fasilitas,
        certificate: CERT[d.cert] ?? null,
        paymentMethod: x.pay ? x.pay.toUpperCase() : null,
        buildStatus: x.build ? x.build.toUpperCase() : null,
        renovated: !!x.reno,
        iplMode: x.ipl ? x.ipl[0].toUpperCase() : null,
        iplAmount: x.ipl && x.ipl[1] ? x.ipl[1] : null,
        iplFreeYears: x.ipl && x.ipl[2] ? +x.ipl[2] : null,
        spaces: x.avail,
        security: x.sec,
        facilities: x.fac,
        distanceToll: x.near[0], distanceCity: x.near[1], distanceHealth: x.near[2], distanceAirport: x.near[3],
        walkability: x.walk,
        legalVerification: x.lv === 'verified' ? 'VERIFIED' : 'PROSES',
        pbbStatus: x.pbb,
        imbStatus: x.imb,
        isNewProject: !!x.isNew,
        developerNote: x.dev || null,
        agentId: agent.id,
        // id lebih besar = listing lebih baru (sesuai urutan "Terbaru" di desain)
        createdAt: new Date(Date.UTC(2026, 9, 1) + d.id * 86400000),
        photos: { create: d.photos.map((url, i) => ({ url, sortOrder: i, alt: `Foto ${d.title} (${i + 1})` })) },
      },
    });
    idMap[d.title] = p.id;
  }

  const notaryData = seed.owned[0].notary;
  const notary = await prisma.notary.create({ data: { name: notaryData.name, address: notaryData.address, phone: notaryData.phone, hours: notaryData.hours } });

  for (const o of seed.owned) {
    await prisma.ownership.create({
      data: {
        userId: buyer.id,
        propertyId: idMap[o.title] ?? null,
        notaryId: notary.id,
        title: o.title,
        unitCode: o.unit,
        location: o.location,
        coverUrl: o.cover,
        progress: o.progress,
        statusText: o.statusText,
        purchasedAt: parseDate(o.purchased),
        handoverEstimate: o.handover,
        constructionSteps: {
          create: o.steps.map((s, i) => ({
            sortOrder: i, title: s.title, dateLabel: s.date, state: STATE[s.state], percent: s.pct ?? null, note: s.note,
            photos: { create: s.photos.map(([key, caption, date], j) => ({ url: seed.progressPhotos[key], caption, takenAt: parseDate(date), sortOrder: j })) },
          })),
        },
        legalSteps: {
          create: o.legal.map((l, i) => ({
            sortOrder: i, title: l.title, dateLabel: l.date, state: STATE[l.state], percent: l.pct ?? null, note: l.note, documentRef: l.doc || null,
          })),
        },
      },
    });
  }

  const counts = {
    users: await prisma.user.count(),
    properties: await prisma.property.count(),
    photos: await prisma.propertyPhoto.count(),
    ownerships: await prisma.ownership.count(),
    constructionSteps: await prisma.constructionStep.count(),
    legalSteps: await prisma.legalStep.count(),
  };
  console.log('Seed selesai:', counts);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
