/**
 * One-off CSV importer for real launch-city business listings (Phase 10, task 3).
 *
 * Usage:
 *   pnpm --filter @buisnez/database exec tsx ../../scripts/import-businesses.ts path/to/lahore-businesses.csv
 *
 * Expected CSV columns (header row required):
 *   name, categorySlug, cityName, areaName, addressLine, lat, lng, phone, whatsapp, website,
 *   priceTier (BUDGET|MODERATE|EXPENSIVE|LUXURY, optional), description (optional),
 *   mon_open, mon_close, tue_open, tue_close, wed_open, wed_close, thu_open, thu_close,
 *   fri_open, fri_close, sat_open, sat_close, sun_open, sun_close (HH:MM, blank = closed that day)
 *
 * Businesses are created with status PENDING and isVerified false — an admin publishes them via
 * the existing /admin/businesses moderation surface (same path as any other new listing), so this
 * script never bypasses the moderation model already built in Phases 6-8. Re-running is idempotent
 * per (name, cityId) pair (upsert), so a corrected CSV can be re-imported safely.
 */
import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import {
  BusinessStatus,
  DayOfWeek,
  PriceTier,
  PrismaClient,
} from '@prisma/client';

const prisma = new PrismaClient();

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const DAY_COLUMNS: Array<{ day: DayOfWeek; open: string; close: string }> = [
  { day: DayOfWeek.MONDAY, open: 'mon_open', close: 'mon_close' },
  { day: DayOfWeek.TUESDAY, open: 'tue_open', close: 'tue_close' },
  { day: DayOfWeek.WEDNESDAY, open: 'wed_open', close: 'wed_close' },
  { day: DayOfWeek.THURSDAY, open: 'thu_open', close: 'thu_close' },
  { day: DayOfWeek.FRIDAY, open: 'fri_open', close: 'fri_close' },
  { day: DayOfWeek.SATURDAY, open: 'sat_open', close: 'sat_close' },
  { day: DayOfWeek.SUNDAY, open: 'sun_open', close: 'sun_close' },
];

interface Row {
  name: string;
  categorySlug: string;
  cityName: string;
  areaName?: string;
  addressLine: string;
  lat: string;
  lng: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  priceTier?: string;
  description?: string;
  [key: string]: string | undefined;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: tsx import-businesses.ts <path-to-csv>');
    process.exit(1);
  }

  const rows: Row[] = parse(readFileSync(filePath, 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const city = await prisma.city.findFirst({ where: { name: row.cityName } });
    if (!city) {
      console.error(
        `SKIP "${row.name}": city "${row.cityName}" not found — add it via /admin/taxonomy first.`,
      );
      skipped++;
      continue;
    }

    const category = await prisma.category.findUnique({
      where: { slug: row.categorySlug },
    });
    if (!category) {
      console.error(
        `SKIP "${row.name}": category slug "${row.categorySlug}" not found.`,
      );
      skipped++;
      continue;
    }

    let areaId: string | undefined;
    if (row.areaName) {
      const area = await prisma.area.findFirst({
        where: { name: row.areaName, cityId: city.id },
      });
      if (!area) {
        console.error(
          `SKIP "${row.name}": area "${row.areaName}" not found in ${row.cityName} — add it via /admin/taxonomy first.`,
        );
        skipped++;
        continue;
      }
      areaId = area.id;
    }

    const lat = Number(row.lat);
    const lng = Number(row.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.error(
        `SKIP "${row.name}": invalid lat/lng ("${row.lat}", "${row.lng}").`,
      );
      skipped++;
      continue;
    }

    const slug = slugify(`${row.name}-${row.cityName}`);
    const existing = await prisma.business.findUnique({ where: { slug } });

    const priceTier =
      row.priceTier && row.priceTier in PriceTier
        ? (row.priceTier as PriceTier)
        : undefined;

    const business = await prisma.business.upsert({
      where: { slug },
      create: {
        name: row.name,
        slug,
        description: row.description || null,
        categoryId: category.id,
        provinceId: city.provinceId,
        cityId: city.id,
        areaId,
        addressLine: row.addressLine,
        phone: row.phone || null,
        whatsapp: row.whatsapp || null,
        website: row.website || null,
        priceTier,
        status: BusinessStatus.PENDING,
        isVerified: false,
      },
      update: {
        description: row.description || null,
        categoryId: category.id,
        areaId,
        addressLine: row.addressLine,
        phone: row.phone || null,
        whatsapp: row.whatsapp || null,
        website: row.website || null,
        priceTier,
      },
    });

    await prisma.$executeRaw`
      UPDATE "Business"
      SET "location" = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      WHERE "id" = ${business.id}
    `;

    for (const { day, open, close } of DAY_COLUMNS) {
      const opensAt = row[open] || null;
      const closesAt = row[close] || null;
      await prisma.businessHours.upsert({
        where: {
          businessId_dayOfWeek: { businessId: business.id, dayOfWeek: day },
        },
        create: {
          businessId: business.id,
          dayOfWeek: day,
          opensAt,
          closesAt,
          isClosed: !opensAt,
        },
        update: { opensAt, closesAt, isClosed: !opensAt },
      });
    }

    if (existing) updated++;
    else created++;
  }

  console.log(
    `Done. Created: ${created}, updated: ${updated}, skipped: ${skipped}.`,
  );
  console.log(
    'All imported businesses are PENDING — publish them via /admin/businesses.',
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
