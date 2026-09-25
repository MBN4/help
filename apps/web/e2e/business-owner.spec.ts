import * as fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  request as playwrightRequest,
  type Page,
} from '@playwright/test';

const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:4000/api/v1';
const API_LOG_PATH = process.env.E2E_API_LOG_PATH ?? '/tmp/api-server.log';
const DB_URL =
  process.env.DATABASE_URL ??
  'postgresql://buisnez:buisnez@localhost:5544/buisnez';
const ADMIN_EMAIL = 'admin@buisnez.pk';
const ADMIN_PASSWORD = 'Password123!';

/**
 * This suite seeds/cleans its OWN test business (via direct SQL against the dev Postgres instance,
 * mirroring how `packages/database/prisma/seed.ts` provisions demo data) rather than reusing
 * `karachi-biryani-house` or any other seeded demo business — every seeded business already has an
 * `ownerId` set, so none of them are eligible for the claim flow this suite exercises. There is no
 * admin-moderation UI yet (Phase 7), so claim approval goes through the real `PATCH /claims/:id/approve`
 * API directly, exactly as the task spec calls for.
 */
/**
 * Runs a single SQL statement via the `psql` CLI and returns its first output line, trimmed. `-t -A`
 * (tuples-only, unaligned) still prints a trailing command-completion tag (e.g. `INSERT 0 1`) after a
 * `RETURNING` row on some psql builds, so only the first line — the actual query result — is kept.
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

function seedUnclaimedBusiness(): TestBusiness {
  const suffix = randomUUID().slice(0, 8);
  const slug = `e2e-owner-test-biz-${suffix}`;
  const name = `E2E Owner Test Business ${suffix}`;

  const sample = psql(
    `SELECT "categoryId", "provinceId", "cityId", "areaId" FROM "Business" LIMIT 1;`,
  );
  const [categoryId, provinceId, cityId, areaId] = sample.split('|');

  const id = psql(
    `INSERT INTO "Business" (id, name, slug, description, "categoryId", "provinceId", "cityId", "areaId",
       "addressLine", location, phone, status, "isVerified", "updatedAt")
     VALUES (gen_random_uuid(), '${name}', '${slug}', 'Seeded by business-owner.spec.ts for e2e coverage.',
       '${categoryId}', '${provinceId}', '${cityId}', '${areaId}',
       '123 Test Street', ST_SetSRID(ST_MakePoint(74.3587, 31.5204), 4326)::geography,
       '+923001234567', 'PUBLISHED', true, now())
     RETURNING id;`,
  );

  return { id, slug };
}

function cleanupBusiness(businessId: string): void {
  // Cascades: reviews/claims/services/photos/features/hours reference businessId with ON DELETE CASCADE
  // in the schema (mirrors how owned resources are cleaned up elsewhere) — deleting the Business row is
  // enough.
  psql(`DELETE FROM "Business" WHERE id = '${businessId}';`);
}

function uniqueEmail(label: string): string {
  return `e2e-${label}-${randomUUID().slice(0, 8)}@example.test`;
}

async function readVerificationLink(email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const contents = fs.readFileSync(API_LOG_PATH, 'utf-8');
    const lines = contents
      .split('\n')
      .filter((line) => line.includes('[mail stub]') && line.includes(email));
    const last = lines.at(-1);
    if (last) {
      const match = last.match(/link=(http:\/\/[^\s\x1b]+)/);
      if (match) {
        return match[1];
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No verification link found in API log for ${email}`);
}

async function registerAndVerify(
  page: Page,
  { name, email, password }: { name: string; email: string; password: string },
): Promise<void> {
  await page.goto('/register');
  await page.getByLabel(/name/i).fill(name);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page
    .getByRole('button', { name: /create account|sign up|register/i })
    .click();
  await expect(page.getByText(/verify/i)).toBeVisible({ timeout: 10_000 });

  const link = await readVerificationLink(email);
  const url = new URL(link);
  await page.goto(`${url.pathname}${url.search}`);
  await expect(page.getByText(/verified/i)).toBeVisible({ timeout: 10_000 });
}

/** Reads the caller's own pending/approved claim for a business via the browser's own cookie jar. */
async function fetchMyClaim(
  page: Page,
  businessId: string,
): Promise<{ id: string; status: string } | null> {
  return page.evaluate(
    async ({ base, businessId: id }) => {
      const res = await fetch(`${base}/claims/mine?businessId=${id}`, {
        credentials: 'include',
        headers: { 'x-requested-with': 'buisnez-web' },
      });
      const text = await res.text();
      let body: { data?: { data: unknown }; error?: unknown };
      try {
        body = JSON.parse(text) as typeof body;
      } catch {
        throw new Error(`Non-JSON response (status ${res.status}): ${text}`);
      }
      if (!body.data) {
        throw new Error(
          `Unexpected claim response (status ${res.status}): ${text}`,
        );
      }
      return body.data.data as { id: string; status: string } | null;
    },
    { base: API_BASE, businessId },
  );
}

test.describe.configure({ mode: 'serial' });

test.describe('Phase 6: business owner experience', () => {
  test.setTimeout(90_000);

  let business: TestBusiness;

  test.beforeAll(() => {
    business = seedUnclaimedBusiness();
  });

  test.afterAll(() => {
    cleanupBusiness(business.id);
  });

  const ownerEmail = uniqueEmail('owner');
  const ownerPassword = 'CorrectHorse123!';
  const reviewerEmail = uniqueEmail('reviewer');
  const reviewerPassword = 'CorrectHorse123!';
  const otherEmail = uniqueEmail('other');
  const otherPassword = 'CorrectHorse123!';

  let claimId: string;

  test('claim flow: submit a claim as a logged-in user, then admin approves it via the API', async ({
    page,
  }) => {
    await registerAndVerify(page, {
      name: 'Owner Tester',
      email: ownerEmail,
      password: ownerPassword,
    });

    await page.goto(`/business/${business.slug}`);
    await expect(
      page.getByRole('button', { name: /claim this business/i }),
    ).toBeVisible();

    await page.getByRole('button', { name: /claim this business/i }).click();
    await page
      .getByLabel(/message/i)
      .fill('I am the owner of this test business.');
    await page.getByRole('button', { name: /submit claim/i }).click();

    await expect(page.getByText(/claim pending review/i)).toBeVisible({
      timeout: 10_000,
    });

    const claim = await fetchMyClaim(page, business.id);
    expect(claim).toBeTruthy();
    expect(claim!.status).toBe('PENDING');
    claimId = claim!.id;

    // Admin-moderation UI doesn't exist yet (Phase 7) — approve via the real API directly, as an
    // independently-authenticated admin session (not the owner's browser cookies).
    const adminContext = await playwrightRequest.newContext();
    const loginRes = await adminContext.post(`${API_BASE}/auth/login`, {
      headers: { 'x-requested-with': 'buisnez-web' },
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(loginRes.ok()).toBe(true);

    const approveRes = await adminContext.patch(
      `${API_BASE}/claims/${claimId}/approve`,
      { headers: { 'x-requested-with': 'buisnez-web' } },
    );
    expect(approveRes.ok()).toBe(true);
    await adminContext.dispose();
  });

  test('owner dashboard lists the newly-claimed business', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(ownerEmail);
    await page.getByLabel(/password/i).fill(ownerPassword);
    await page.getByRole('button', { name: /log in|sign in/i }).click();
    await expect(
      page.locator('header').getByRole('button', { name: /log out/i }),
    ).toBeVisible({ timeout: 10_000 });

    await page.goto('/account/businesses');
    await expect(page.getByText(/E2E Owner Test Business/i)).toBeVisible({
      timeout: 10_000,
    });

    // Claim CTA must now be gone from the public profile (business is claimed).
    await page.goto(`/business/${business.slug}`);
    await expect(
      page.getByRole('button', { name: /claim this business/i }),
    ).toHaveCount(0);
  });

  test('owner edits info, hours, features, services, and manual lat/lng — all persist after reload', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(ownerEmail);
    await page.getByLabel(/password/i).fill(ownerPassword);
    await page.getByRole('button', { name: /log in|sign in/i }).click();
    await expect(
      page.locator('header').getByRole('button', { name: /log out/i }),
    ).toBeVisible({ timeout: 10_000 });

    await page.goto(`/account/businesses/${business.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'E2E Owner Test Business',
    );

    // --- Core info ---
    const newDescription = `Updated description ${randomUUID().slice(0, 6)}`;
    const descriptionBox = page.getByLabel(/description/i).first();
    await descriptionBox.fill(newDescription);
    await page
      .locator('form')
      .filter({ has: descriptionBox })
      .getByRole('button', { name: /save changes/i })
      .click();
    await expect(page.getByText(/^saved\.$/i).first()).toBeVisible({
      timeout: 10_000,
    });

    // --- Hours: mark Monday closed ---
    const mondayRow = page
      .getByText('Monday', { exact: true })
      .locator('xpath=..');
    await mondayRow.getByRole('checkbox').click();
    await page
      .getByRole('heading', { name: /^hours$/i })
      .locator('xpath=following-sibling::form[1]')
      .getByRole('button', { name: /save changes/i })
      .click();
    await expect(page.getByText(/^saved\.$/i).nth(1)).toBeVisible({
      timeout: 10_000,
    });

    // --- Features: toggle the first available feature checkbox ---
    const featuresSection = page
      .getByRole('heading', { name: /^features$/i })
      .locator('xpath=following-sibling::form[1]');
    const firstFeatureCheckbox = featuresSection.getByRole('checkbox').first();
    await firstFeatureCheckbox.click();
    await featuresSection
      .getByRole('button', { name: /save changes/i })
      .click();
    await expect(page.getByText(/^saved\.$/i).nth(2)).toBeVisible({
      timeout: 10_000,
    });

    // --- Services: add one ---
    const serviceName = `Test Service ${randomUUID().slice(0, 6)}`;
    await page.getByLabel(/^name$/i).fill(serviceName);
    await page.locator('#service-price').fill('500');
    await page.getByRole('button', { name: /add service/i }).click();
    await expect(page.getByText(serviceName)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Rs 500')).toBeVisible();

    // --- Location: manual lat/lng fallback (no Google Maps key configured in this environment) ---
    const latInput = page.getByLabel(/latitude/i);
    const lngInput = page.getByLabel(/longitude/i);
    await expect(latInput).toBeVisible();
    await latInput.fill('33.6844');
    await lngInput.fill('73.0479');
    await page
      .getByRole('heading', { name: /^location$/i })
      .locator('xpath=following-sibling::div[1]')
      .getByRole('button', { name: /save changes/i })
      .click();
    await expect(page.getByText(/^saved\.$/i).last()).toBeVisible({
      timeout: 10_000,
    });

    // --- Reload and verify persistence ---
    await page.reload();
    await expect(page.getByLabel(/description/i).first()).toHaveValue(
      newDescription,
    );
    const mondayRowAfterReload = page
      .getByText('Monday', { exact: true })
      .locator('xpath=..');
    await expect(mondayRowAfterReload.getByRole('checkbox')).toBeChecked();
    await expect(page.getByText(serviceName)).toBeVisible();
    await expect(page.getByText('Rs 500')).toBeVisible();
    await expect(page.getByLabel(/latitude/i)).toHaveValue('33.6844');
    await expect(page.getByLabel(/longitude/i)).toHaveValue('73.0479');
  });

  test('reviewer posts a review, then the owner replies to it', async ({
    page,
    browser,
  }) => {
    await registerAndVerify(page, {
      name: 'Reviewer Tester',
      email: reviewerEmail,
      password: reviewerPassword,
    });
    await page.goto(`/business/${business.slug}`);
    await page
      .getByRole('radiogroup')
      .first()
      .getByRole('radio', { name: '5 stars' })
      .click();
    await page.getByLabel(/title/i).fill('Great test business');
    await page
      .getByLabel(/review|body|comment/i)
      .last()
      .fill('This is an e2e test review.');
    await page.getByRole('button', { name: /post review/i }).click();
    await expect(page.getByText(/review is live/i)).toBeVisible({
      timeout: 10_000,
    });

    // Owner replies in a separate browser context (own session).
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto('/login');
    await ownerPage.getByLabel(/email/i).fill(ownerEmail);
    await ownerPage.getByLabel(/password/i).fill(ownerPassword);
    await ownerPage.getByRole('button', { name: /log in|sign in/i }).click();
    await expect(
      ownerPage.locator('header').getByRole('button', { name: /log out/i }),
    ).toBeVisible({ timeout: 10_000 });

    await ownerPage.goto(`/account/businesses/${business.id}`);
    await ownerPage
      .getByPlaceholder(/reply/i)
      .fill('Thanks for the kind words!');
    await ownerPage.getByRole('button', { name: /post reply/i }).click();
    await expect(ownerPage.getByText('Thanks for the kind words!')).toBeVisible(
      {
        timeout: 10_000,
      },
    );
    await ownerContext.close();

    // Reply now renders publicly for every visitor, read-only.
    await page.goto(`/business/${business.slug}`);
    await expect(page.getByText(/response from the owner/i)).toBeVisible();
    await expect(page.getByText('Thanks for the kind words!')).toBeVisible();
  });

  test('authorization: a non-owner sees no edit UI and a direct API call from their session gets 403', async ({
    page,
  }) => {
    await registerAndVerify(page, {
      name: 'Other Tester',
      email: otherEmail,
      password: otherPassword,
    });

    await page.goto(`/account/businesses/${business.id}`);
    // Guard renders an error message rather than the editor form for a non-owner.
    await expect(
      page.getByRole('button', { name: /save changes/i }),
    ).toHaveCount(0);

    const status = await page.evaluate(
      async ({ base, id }) => {
        const res = await fetch(`${base}/businesses/${id}/manage`, {
          credentials: 'include',
          headers: { 'x-requested-with': 'buisnez-web' },
        });
        return res.status;
      },
      { base: API_BASE, id: business.id },
    );
    expect(status).toBe(403);
  });
});
