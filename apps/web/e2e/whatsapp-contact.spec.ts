import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { test, expect } from '@playwright/test';

const DB_URL =
  process.env.DATABASE_URL ??
  'postgresql://buisnez:buisnez@localhost:5544/buisnez';
const OWNER_EMAIL = 'owner@buisnez.pk';
const OWNER_PASSWORD = 'Password123!';
const SCREENSHOT_DIR = path.join(__dirname, '../../../docs/screenshots');

function psql(sql: string): string {
  const output = execFileSync(
    'psql',
    [DB_URL, '-t', '-A', '-F', '|', '-c', sql],
    { encoding: 'utf-8' },
  );
  return (output.split('\n')[0] ?? '').trim();
}

interface Fixture {
  id: string;
  slug: string;
  name: string;
}

/** Clones location/category columns from an existing business so the page renders fully; own slug per run. */
function seedBusiness(
  label: string,
  phone: string | null,
  whatsapp: string | null,
  ownerEmail?: string,
): Fixture {
  const suffix = randomUUID().slice(0, 8);
  const slug = `e2e-wa-${label}-${suffix}`;
  const name = `E2E Contact Test ${label} ${suffix}`;
  const [categoryId, provinceId, cityId, areaId] = psql(
    `SELECT "categoryId", "provinceId", "cityId", "areaId" FROM "Business" LIMIT 1;`,
  ).split('|');
  const sqlOrNull = (value: string | null): string =>
    value ? `'${value}'` : 'NULL';
  const ownerSql = ownerEmail
    ? `(SELECT id FROM "User" WHERE email = '${ownerEmail}')`
    : 'NULL';
  const id = psql(
    `INSERT INTO "Business" (id, name, slug, description, "categoryId", "provinceId", "cityId", "areaId",
       "addressLine", location, phone, whatsapp, "ownerId", status, "isVerified", "updatedAt")
     VALUES (gen_random_uuid(), '${name}', '${slug}', 'Seeded by whatsapp-contact.spec.ts.',
       '${categoryId}', '${provinceId}', '${cityId}', '${areaId}',
       '1 Test Street', ST_SetSRID(ST_MakePoint(74.3587, 31.5204), 4326)::geography,
       ${sqlOrNull(phone)}, ${sqlOrNull(whatsapp)}, ${ownerSql}, 'PUBLISHED', true, now())
     RETURNING id;`,
  );
  return { id, slug, name };
}

test.describe('WhatsApp contact', () => {
  let withWhatsapp: Fixture;
  let phoneOnly: Fixture;
  let neither: Fixture;
  let ownerBusiness: Fixture;

  test.beforeAll(() => {
    withWhatsapp = seedBusiness('with', '+923211111111', '+923001234567');
    phoneOnly = seedBusiness('phone', '+923007654321', null);
    neither = seedBusiness('none', null, null);
    ownerBusiness = seedBusiness('owner', '+923211111111', null, OWNER_EMAIL);
  });

  test.afterAll(() => {
    for (const business of [withWhatsapp, phoneOnly, neither, ownerBusiness]) {
      psql(`DELETE FROM "Business" WHERE id = '${business.id}';`);
    }
  });

  test('uses the dedicated WhatsApp number with the prefilled message', async ({
    page,
  }) => {
    await page.goto(`/business/${withWhatsapp.slug}`);
    const button = page
      .getByRole('link', { name: 'WhatsApp', exact: true })
      .first();
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute('target', '_blank');
    const href = (await button.getAttribute('href')) ?? '';
    const url = new URL(href);
    expect(`${url.origin}${url.pathname}`).toBe('https://wa.me/923001234567');
    expect(url.searchParams.get('text')).toBe(
      'Hi, I found you on Buisnez and wanted to ask about...',
    );
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'whatsapp-dedicated-number.png'),
      clip: { x: 0, y: 0, width: 1280, height: 720 },
    });
  });

  test('falls back to the phone number when no WhatsApp number is set', async ({
    page,
  }) => {
    await page.goto(`/business/${phoneOnly.slug}`);
    const button = page
      .getByRole('link', { name: 'WhatsApp', exact: true })
      .first();
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute(
      'href',
      /^https:\/\/wa\.me\/92\d{10}\?text=/,
    );
    await expect(button).toHaveAttribute(
      'href',
      /^https:\/\/wa\.me\/923007654321\?/,
    );
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'whatsapp-phone-fallback.png'),
      clip: { x: 0, y: 0, width: 1280, height: 720 },
    });
  });

  test('shows no WhatsApp button when there is no number at all', async ({
    page,
  }) => {
    await page.goto(`/business/${neither.slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      neither.name,
    );
    await expect(
      page.getByRole('link', { name: 'WhatsApp', exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'whatsapp-no-number.png'),
      clip: { x: 0, y: 0, width: 1280, height: 720 },
    });
  });

  test('owner can set and clear the WhatsApp number', async ({ page }) => {
    // The owner dashboard compiles cold on first visit under `next dev`.
    test.setTimeout(90_000);
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(OWNER_EMAIL);
    await page.getByLabel(/password/i).fill(OWNER_PASSWORD);
    await page.getByRole('button', { name: /log in|sign in/i }).click();
    await expect(
      page.locator('header').getByRole('button', { name: /log out/i }),
    ).toBeVisible({ timeout: 10_000 });

    await page.goto(`/account/businesses/${ownerBusiness.id}`);
    const field = page.getByLabel('WhatsApp');
    await field.fill('0300 1234567');
    const form = page.locator('form').filter({ has: field });
    await form.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByText(/^saved\.$/i).first()).toBeVisible({
      timeout: 10_000,
    });
    expect(
      psql(`SELECT whatsapp FROM "Business" WHERE id = '${ownerBusiness.id}';`),
    ).toBe('+923001234567');
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'whatsapp-owner-edit.png'),
      fullPage: true,
    });

    await page.reload();
    await expect(page.getByLabel('WhatsApp')).toHaveValue('+923001234567');

    await page.getByLabel('WhatsApp').fill('');
    await page
      .locator('form')
      .filter({ has: page.getByLabel('WhatsApp') })
      .getByRole('button', { name: /save changes/i })
      .click();
    await expect(page.getByText(/^saved\.$/i).first()).toBeVisible({
      timeout: 10_000,
    });
    expect(
      psql(
        `SELECT coalesce(whatsapp, 'NULL') FROM "Business" WHERE id = '${ownerBusiness.id}';`,
      ),
    ).toBe('NULL');
  });
});
