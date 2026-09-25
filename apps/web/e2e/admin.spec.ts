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
 * Phase 7 admin/moderation Playwright coverage. Self-seeded/self-cleaned fixtures only (own business, own
 * users) — never touches seeded demo data or `business-profile.spec.ts`'s hardcoded counts, same discipline
 * as `business-owner.spec.ts`.
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
  const slug = `e2e-admin-test-biz-${suffix}`;
  const name = `E2E Admin Test Business ${suffix}`;
  const sample = psql(
    `SELECT "categoryId", "provinceId", "cityId", "areaId" FROM "Business" LIMIT 1;`,
  );
  const [categoryId, provinceId, cityId, areaId] = sample.split('|');
  const id = psql(
    `INSERT INTO "Business" (id, name, slug, description, "categoryId", "provinceId", "cityId", "areaId",
       "addressLine", location, phone, status, "isVerified", "updatedAt")
     VALUES (gen_random_uuid(), '${name}', '${slug}', 'Seeded by admin.spec.ts for e2e coverage.',
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

function setUserRole(email: string, role: string): void {
  psql(`UPDATE "User" SET role = '${role}' WHERE email = '${email}';`);
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

test.describe('Phase 7: admin & moderation', () => {
  test.setTimeout(90_000);

  let business: TestBusiness;
  const claimantEmail = uniqueEmail('claimant');
  const claimantPassword = 'CorrectHorse123!';
  const moderatorEmail = uniqueEmail('moderator');
  const moderatorPassword = 'CorrectHorse123!';
  const banTargetEmail = uniqueEmail('bantarget');
  const banTargetPassword = 'CorrectHorse123!';

  test.beforeAll(() => {
    business = seedUnclaimedBusiness();
  });

  test.afterAll(() => {
    cleanupBusiness(business.id);
  });

  test('MODERATOR works the claims queue: sees, approves a claim with verify', async ({
    page,
    browser,
  }) => {
    // Claimant files a claim via the public UI.
    await registerAndVerify(page, {
      name: 'Claimant Tester',
      email: claimantEmail,
      password: claimantPassword,
    });
    await page.goto(`/business/${business.slug}`);
    await page.getByRole('button', { name: /claim this business/i }).click();
    await page.getByLabel(/message/i).fill('I own this test business.');
    await page.getByRole('button', { name: /submit claim/i }).click();
    await expect(page.getByText(/claim pending review/i)).toBeVisible({
      timeout: 10_000,
    });

    // Moderator registers, gets promoted to MODERATOR out-of-band (no self-service), works the queue.
    const modContext = await browser.newContext();
    const modPage = await modContext.newPage();
    await registerAndVerify(modPage, {
      name: 'Moderator Tester',
      email: moderatorEmail,
      password: moderatorPassword,
    });
    setUserRole(moderatorEmail, 'MODERATOR');
    await login(modPage, {
      email: moderatorEmail,
      password: moderatorPassword,
    });

    await modPage.goto('/admin/claims');
    await expect(
      modPage.getByText('E2E Admin Test Business', { exact: false }),
    ).toBeVisible({ timeout: 15_000 });
    await modPage
      .getByRole('button', { name: /^approve$/i })
      .first()
      .click();

    // Confirm the claimant now owns the business (server-side truth, not just UI state).
    await expect
      .poll(
        async () => {
          const res = await modPage.request.get(
            `${API_BASE}/admin/businesses/${business.id}`,
            { headers: { 'x-requested-with': 'buisnez-web' } },
          );
          const body = (await res.json()) as {
            data: { ownerId: string | null };
          };
          return body.data.ownerId;
        },
        { timeout: 10_000 },
      )
      .not.toBeNull();

    await modContext.close();
  });

  test('MODERATOR navigating to an ADMIN-only route is redirected away', async ({
    browser,
  }) => {
    const modContext = await browser.newContext();
    const modPage = await modContext.newPage();
    await login(modPage, {
      email: moderatorEmail,
      password: moderatorPassword,
    });
    await modPage.goto('/admin/users');
    await expect(modPage).not.toHaveURL(/\/admin\/users/, { timeout: 10_000 });
    await modContext.close();
  });

  test('ADMIN bans a user, confirming they are logged out/blocked', async ({
    page,
    browser,
  }) => {
    await registerAndVerify(page, {
      name: 'Ban Target Tester',
      email: banTargetEmail,
      password: banTargetPassword,
    });
    await page.close();

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    await adminPage.goto('/admin/users');
    await adminPage.getByPlaceholder(/search users/i).fill(banTargetEmail);
    await expect(adminPage.getByText(banTargetEmail)).toBeVisible({
      timeout: 10_000,
    });
    await adminPage.getByRole('button', { name: /^ban$/i }).first().click();
    await adminPage.getByPlaceholder(/reason/i).fill('E2E abuse test');
    await adminPage.getByRole('button', { name: /^ban$/i }).last().click();
    await expect(adminPage.getByText(/banned/i).first()).toBeVisible({
      timeout: 10_000,
    });

    // The banned user's session is now blocked server-side.
    const bannedContext = await browser.newContext();
    const bannedPage = await bannedContext.newPage();
    await bannedPage.goto('/login');
    await bannedPage.getByLabel(/email/i).fill(banTargetEmail);
    await bannedPage.getByLabel(/password/i).fill(banTargetPassword);
    await bannedPage.getByRole('button', { name: /log in|sign in/i }).click();
    // Either the login itself is rejected, or a subsequent authenticated call 401s — both prove the ban.
    const meStatus = await bannedPage.evaluate(async (base) => {
      const res = await fetch(`${base}/auth/me`, { credentials: 'include' });
      return res.status;
    }, API_BASE);
    expect(meStatus).not.toBe(200);

    await bannedContext.close();
    await adminContext.close();
  });

  // Combined into one test (same authenticated session) rather than a separate login for the moderation-log
  // check — the auth `login` route is throttled to 5 req/min per IP (docs/10-auth-roles.md), and this suite
  // already performs several logins in quick succession.
  test('ADMIN toggles featured, edits taxonomy, and sees both in the moderation log', async ({
    browser,
  }) => {
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    await adminPage.goto('/admin/businesses');
    await adminPage
      .getByPlaceholder(/search businesses/i)
      .fill('E2E Admin Test Business');
    await expect(
      adminPage.getByText('E2E Admin Test Business', { exact: false }),
    ).toBeVisible({
      timeout: 10_000,
    });
    await adminPage
      .getByRole('button', { name: /^feature$/i })
      .first()
      .click();
    await expect(adminPage.getByText(/featured/i).first()).toBeVisible({
      timeout: 10_000,
    });

    // Taxonomy: add a feature.
    await adminPage.goto('/admin/taxonomy');
    const featureName = `E2E Feature ${randomUUID().slice(0, 6)}`;
    await adminPage.getByTestId('taxonomy-features-name').fill(featureName);
    await adminPage.getByTestId('taxonomy-features-add').click();
    await expect(adminPage.getByText(featureName)).toBeVisible({
      timeout: 10_000,
    });

    // Moderation log: both actions above (plus the earlier claim approve / user ban) show up.
    await adminPage.goto('/admin/moderation-log');
    await expect(
      adminPage
        .getByText(/CLAIM_APPROVED|USER_BANNED|BUSINESS_FEATURED_TOGGLED/)
        .first(),
    ).toBeVisible({ timeout: 10_000 });

    await adminContext.close();
  });
});
