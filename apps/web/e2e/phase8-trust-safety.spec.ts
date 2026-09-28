import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';

const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:4000/api/v1';
const API_LOG_PATH = process.env.E2E_API_LOG_PATH ?? '/tmp/api-server.log';
const DB_URL =
  process.env.DATABASE_URL ??
  'postgresql://buisnez:buisnez@localhost:5544/buisnez';
const ADMIN_EMAIL = 'admin@buisnez.pk';
const ADMIN_PASSWORD = 'Password123!';

/**
 * Phase 8 trust/safety & anti-spam Playwright coverage: automated moderation scoring, verified-reviewer
 * badges, the appeal path, and the self-review hard block. Self-seeded/self-cleaned fixtures only — never
 * touches seeded demo data, same discipline as admin.spec.ts/business-owner.spec.ts (see
 * docs/PROGRESS.md's shared-DB-contamination note).
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

function seedPublishedBusiness(
  namePrefix: string,
  ownerId?: string,
): TestBusiness {
  const suffix = randomUUID().slice(0, 8);
  const slug = `e2e-p8-${namePrefix}-${suffix}`;
  const name = `E2E Phase 8 ${namePrefix} ${suffix}`;
  const sample = psql(
    `SELECT "categoryId", "provinceId", "cityId", "areaId" FROM "Business" LIMIT 1;`,
  );
  const [categoryId, provinceId, cityId, areaId] = sample.split('|');
  const id = psql(
    `INSERT INTO "Business" (id, name, slug, description, "categoryId", "provinceId", "cityId", "areaId",
       "addressLine", location, phone, status, "isVerified", "ownerId", "updatedAt")
     VALUES (gen_random_uuid(), '${name}', '${slug}', 'Seeded by phase8-trust-safety.spec.ts.',
       '${categoryId}', '${provinceId}', '${cityId}', '${areaId}',
       '123 Test Street', ST_SetSRID(ST_MakePoint(74.3587, 31.5204), 4326)::geography,
       '+923001234567', 'PUBLISHED', true, ${ownerId ? `'${ownerId}'` : 'NULL'}, now())
     RETURNING id;`,
  );
  return { id, slug };
}

function cleanupBusiness(businessId: string): void {
  psql(`DELETE FROM "Business" WHERE id = '${businessId}';`);
}

function getUserId(email: string): string {
  return psql(`SELECT id FROM "User" WHERE email = '${email}';`);
}

function uniqueEmail(label: string): string {
  return `e2e-p8-${label}-${randomUUID().slice(0, 8)}@example.test`;
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
      if (match) return match[1];
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

test.describe.configure({ mode: 'serial' });

test.describe('Phase 8: trust, safety & anti-spam', () => {
  test.setTimeout(90_000);

  let genuineBusiness: TestBusiness;
  let spamBusiness: TestBusiness;
  let ownedBusiness: TestBusiness;
  const reviewerEmail = uniqueEmail('reviewer');
  const reviewerPassword = 'CorrectHorse123!';
  const ownerEmail = uniqueEmail('owner');
  const ownerPassword = 'CorrectHorse123!';
  let heldReviewId = '';

  test.beforeAll(() => {
    genuineBusiness = seedPublishedBusiness('genuine');
    spamBusiness = seedPublishedBusiness('spam');
  });

  test.afterAll(() => {
    cleanupBusiness(genuineBusiness.id);
    cleanupBusiness(spamBusiness.id);
    if (ownedBusiness) cleanupBusiness(ownedBusiness.id);
  });

  test('genuine content auto-approves; obvious spam auto-holds as PENDING with a reason, and can be appealed', async ({
    page,
    browser,
  }) => {
    await registerAndVerify(page, {
      name: 'Reviewer Tester',
      email: reviewerEmail,
      password: reviewerPassword,
    });

    // Genuine review — should publish immediately (no scoring rule triggered).
    await page.goto(`/business/${genuineBusiness.slug}`);
    await expect(
      page.getByRole('heading', { name: /write a review/i }),
    ).toBeVisible({
      timeout: 10_000,
    });
    await page
      .locator('[role="radiogroup"]')
      .first()
      .getByRole('radio', { name: '4 stars' })
      .click();
    await page
      .getByLabel(/your review/i)
      .fill(
        'A perfectly ordinary, genuine review of this place — friendly staff, would come back.',
      );
    await page.getByRole('button', { name: /post review/i }).click();
    await expect(
      page.getByText('A perfectly ordinary, genuine review', { exact: false }),
    ).toBeVisible({ timeout: 10_000 });

    // Spam review (contains a link) on a different business — should auto-hold as PENDING.
    await page.goto(`/business/${spamBusiness.slug}`);
    await expect(
      page.getByRole('heading', { name: /write a review/i }),
    ).toBeVisible({
      timeout: 10_000,
    });
    await page
      .locator('[role="radiogroup"]')
      .first()
      .getByRole('radio', { name: '5 stars' })
      .click();
    await page
      .getByLabel(/your review/i)
      .fill(
        'Amazing place! Visit http://totally-not-spam.example for a discount.',
      );
    await page.getByRole('button', { name: /post review/i }).click();

    // Held content is invisible to the public (no PENDING/REMOVED review ever shown there) — checked
    // from a separate, unauthenticated context since the author's own edit form always shows their latest
    // (unpublished) draft.
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto(`/business/${spamBusiness.slug}`);
    await expect(publicPage.getByText(/totally-not-spam/i)).not.toBeVisible();
    await publicContext.close();

    // ...but shows up on the author's own account page with its reason and an appeal path.
    await page.goto('/account/reviews');
    await expect(page.getByText(/pending review/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/spam/i).first()).toBeVisible();

    heldReviewId = await psql(
      `SELECT id FROM "Review" WHERE "businessId" = '${spamBusiness.id}' AND status = 'PENDING';`,
    );
    expect(heldReviewId).not.toBe('');

    await page.getByRole('button', { name: /appeal this decision/i }).click();
    await page.getByRole('button', { name: /submit appeal/i }).click();
    await expect(page.getByText(/appeal has been submitted/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test('self-review is a hard block: an owner cannot review their own business', async ({
    page,
  }) => {
    await registerAndVerify(page, {
      name: 'Owner Tester',
      email: ownerEmail,
      password: ownerPassword,
    });
    const ownerId = getUserId(ownerEmail);
    ownedBusiness = seedPublishedBusiness('owned', ownerId);

    const response = await page.request.put(
      `${API_BASE}/businesses/${ownedBusiness.id}/review`,
      {
        headers: { 'x-requested-with': 'buisnez-web' },
        data: { rating: 5, body: 'My own business is the best, obviously.' },
      },
    );
    expect(response.status()).toBe(403);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('SELF_REVIEW_NOT_ALLOWED');
  });

  test('a MODERATOR sees the appeal in the reports queue and restoring it makes the review visible again', async ({
    browser,
  }) => {
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    await adminPage.goto('/admin/reports');
    await expect(
      adminPage.getByText('APPEAL', { exact: false }).first(),
    ).toBeVisible({
      timeout: 15_000,
    });
    await adminPage
      .getByRole('button', { name: /restore content/i })
      .first()
      .click();
    await adminPage
      .getByRole('button', { name: /restore content/i })
      .last()
      .click();
    await expect
      .poll(
        () => psql(`SELECT status FROM "Review" WHERE id = '${heldReviewId}';`),
        { timeout: 10_000 },
      )
      .toBe('PUBLISHED');

    await adminContext.close();

    // Now publicly visible again.
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto(`/business/${spamBusiness.slug}`);
    await expect(publicPage.getByText(/totally-not-spam/i)).toBeVisible({
      timeout: 10_000,
    });
    await publicContext.close();
  });
});
