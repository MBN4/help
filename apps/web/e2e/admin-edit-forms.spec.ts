import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';

const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:4000/api/v1';
const DB_URL =
  process.env.DATABASE_URL ??
  'postgresql://buisnez:buisnez@localhost:5544/buisnez';
const ADMIN_EMAIL = 'admin@buisnez.pk';
const ADMIN_PASSWORD = 'Password123!';

/**
 * Phase 9 hardening: Playwright coverage for the three admin panel features that were time-boxed out of
 * Phase 7 (see PROGRESS.md's deviation log) and are now built — the business edit form, user role-change,
 * and the taxonomy areas section. Self-seeded/self-cleaned fixtures only (own business, own city/area),
 * same discipline as admin.spec.ts/business-owner.spec.ts — never touches shared seeded demo data, and
 * every test is independent (no ordering assumptions), unlike admin.spec.ts's serial suite.
 */
function psql(sql: string): string {
  const output = execFileSync(
    'psql',
    [DB_URL, '-t', '-A', '-F', '|', '-c', sql],
    { encoding: 'utf-8' },
  );
  return (output.split('\n')[0] ?? '').trim();
}

interface TestBusiness {
  id: string;
  slug: string;
}

function seedBusiness(): TestBusiness {
  const suffix = randomUUID().slice(0, 8);
  const slug = `e2e-edit-form-biz-${suffix}`;
  const name = `E2E Edit Form Business ${suffix}`;
  const sample = psql(
    `SELECT "categoryId", "provinceId", "cityId", "areaId" FROM "Business" LIMIT 1;`,
  );
  const [categoryId, provinceId, cityId, areaId] = sample.split('|');
  const id = psql(
    `INSERT INTO "Business" (id, name, slug, description, "categoryId", "provinceId", "cityId", "areaId",
       "addressLine", location, phone, status, "isVerified", "updatedAt")
     VALUES (gen_random_uuid(), '${name}', '${slug}', 'Seeded by admin-edit-forms.spec.ts for e2e coverage.',
       '${categoryId}', '${provinceId}', '${cityId}', '${areaId}',
       '123 Test Street', ST_SetSRID(ST_MakePoint(74.3587, 31.5204), 4326)::geography,
       '+923001234567', 'PUBLISHED', true, now())
     RETURNING id;`,
  );
  return { id, slug };
}

function cleanupBusiness(businessId: string): void {
  psql(`DELETE FROM "Business" WHERE id = '${businessId}';`);
}

interface TestCity {
  id: string;
  slug: string;
  name: string;
}

function seedCity(): TestCity {
  const suffix = randomUUID().slice(0, 8);
  const slug = `e2e-edit-form-city-${suffix}`;
  const name = `E2E Edit Form City ${suffix}`;
  const provinceId = psql(`SELECT id FROM "Province" LIMIT 1;`);
  const id = psql(
    `INSERT INTO "City" (id, "provinceId", name, slug, "createdAt")
     VALUES (gen_random_uuid(), '${provinceId}', '${name}', '${slug}', now())
     RETURNING id;`,
  );
  return { id, slug, name };
}

function cleanupCity(cityId: string): void {
  psql(`DELETE FROM "Area" WHERE "cityId" = '${cityId}';`);
  psql(`DELETE FROM "City" WHERE id = '${cityId}';`);
}

function uniqueEmail(label: string): string {
  return `e2e-${label}-${randomUUID().slice(0, 8)}@example.test`;
}

function createUser(email: string, name: string): void {
  // Password hash for 'CorrectHorse123!' (argon2) — shared fixed value used only for e2e throwaway users,
  // consistent with the "create your own fixture, never touch seed data" discipline elsewhere in this file.
  psql(
    `INSERT INTO "User" (id, email, name, "passwordHash", role, "emailVerifiedAt", "createdAt", "updatedAt")
     VALUES (gen_random_uuid(), '${email}', '${name}',
       '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQ$MK8HL1+g3PxDwvPJVQZzHnZXlPT9EBs2NJpKQnCJnmY',
       'CUSTOMER', now(), now(), now());`,
  );
}

function cleanupUser(email: string): void {
  psql(`DELETE FROM "User" WHERE email = '${email}';`);
}

async function login(
  page: Page,
  { email, password }: { email: string; password: string },
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /log in|sign in/i }).click();
  await expect(
    page.locator('header').getByRole('button', { name: /log out/i }),
  ).toBeVisible({ timeout: 10_000 });
}

test.describe('Phase 9: admin edit forms', () => {
  test.setTimeout(60_000);

  test('ADMIN edits a business via the detail-page form and sees the change persist', async ({
    page,
  }) => {
    const business = seedBusiness();
    try {
      await login(page, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
      await page.goto(`/admin/businesses/${business.id}`);

      const newName = `E2E Edited Business ${randomUUID().slice(0, 6)}`;
      const nameInput = page.getByLabel(/^name$/i).first();
      await nameInput.fill('');
      await nameInput.fill(newName);
      await page.getByRole('button', { name: /save changes/i }).click();

      await expect(page.getByText(/saved/i).first()).toBeVisible({
        timeout: 10_000,
      });

      // Server-side truth check, not just UI state.
      await expect
        .poll(
          async () => {
            const res = await page.request.get(
              `${API_BASE}/admin/businesses/${business.id}`,
              { headers: { 'x-requested-with': 'buisnez-web' } },
            );
            const body = (await res.json()) as { data: { name: string } };
            return body.data.name;
          },
          { timeout: 10_000 },
        )
        .toBe(newName);
    } finally {
      cleanupBusiness(business.id);
    }
  });

  test('ADMIN changes a user role from the user detail page', async ({
    page,
  }) => {
    const email = uniqueEmail('roletarget');
    createUser(email, 'Role Target Tester');
    try {
      await login(page, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
      await page.goto('/admin/users');
      await page.getByPlaceholder(/search users/i).fill(email);
      await expect(page.getByText(email)).toBeVisible({ timeout: 10_000 });
      await page
        .getByRole('link', { name: /view detail/i })
        .first()
        .click();
      await expect(page).toHaveURL(/\/admin\/users\/[0-9a-f-]+/, {
        timeout: 10_000,
      });

      await page.getByRole('combobox').first().click();
      await page.getByRole('option', { name: 'MODERATOR' }).click();
      await expect(page.getByText(/saved/i).first()).toBeVisible({
        timeout: 10_000,
      });

      const roleInDb = psql(
        `SELECT role FROM "User" WHERE email = '${email}';`,
      );
      expect(roleInDb).toBe('MODERATOR');
    } finally {
      cleanupUser(email);
    }
  });

  test('ADMIN manages areas for a city in the taxonomy panel', async ({
    page,
  }) => {
    const city = seedCity();
    try {
      await login(page, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
      await page.goto('/admin/taxonomy');

      await page
        .getByTestId('taxonomy-areas-city-select')
        .selectOption({ label: city.name });

      const areaName = `E2E Area ${randomUUID().slice(0, 6)}`;
      await page.getByTestId('taxonomy-areas-name').fill(areaName);
      await page.getByTestId('taxonomy-areas-add').click();
      await expect(page.getByText(areaName)).toBeVisible({ timeout: 10_000 });

      // Edit: rename it.
      const areaRow = page.getByText(areaName).locator('..');
      await areaRow.getByRole('button', { name: /^edit$/i }).click();
      const renamedName = `${areaName} Renamed`;
      const editInput = page.getByTestId('taxonomy-areas-edit-input');
      await editInput.fill(renamedName);
      await page.getByTestId('taxonomy-areas-edit-save').click();
      await expect(page.getByText(renamedName)).toBeVisible({
        timeout: 10_000,
      });

      // Delete it.
      const renamedRow = page.getByText(renamedName).locator('..');
      await renamedRow.getByRole('button', { name: /^delete$/i }).click();
      await expect(page.getByText(renamedName)).not.toBeVisible({
        timeout: 10_000,
      });
    } finally {
      cleanupCity(city.id);
    }
  });
});
