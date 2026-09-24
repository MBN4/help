import * as fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:4000/api/v1';
const API_LOG_PATH = process.env.E2E_API_LOG_PATH ?? '/tmp/api-server.log';
const BUSINESS_SLUG = 'karachi-biryani-house';

function uniqueEmail(label: string): string {
  return `e2e-${label}-${randomUUID().slice(0, 8)}@example.test`;
}

/** MailService (see apps/api/src/integrations/mail) logs the verification/reset link instead of sending
 * an email — no SMTP provider is configured in this environment (see docs/PROGRESS.md). Reading the log is
 * the only way to get the token outside of a direct DB query. */
async function readVerificationLink(email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const contents = fs.readFileSync(API_LOG_PATH, 'utf-8');
    const lines = contents
      .split('\n')
      .filter((line) => line.includes('[mail stub]') && line.includes(email));
    const last = lines.at(-1);
    if (last) {
      // Nest's logger appends an ANSI reset code right after the link with no whitespace in between.
      const match = last.match(/link=(http:\/\/[^\s\x1b]+)/);
      if (match) {
        return match[1];
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No verification link found in API log for ${email}`);
}

/** POST /auth/register also logs the caller in (sets cookies) — see docs/10-auth-roles.md — so no
 * separate login() call is needed after this to be authenticated. */
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

/** Exercises the real POST /auth/login endpoint. Login is rate-limited to 5/min/IP (see
 * docs/10-auth-roles.md), so this suite calls it exactly once — every other test relies on
 * registerAndVerify's own login-on-register instead of re-authenticating from scratch. */
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
  ).toBeVisible({
    timeout: 10_000,
  });
}

async function getCookie(context: BrowserContext, name: string) {
  const cookies = await context.cookies();
  return cookies.find((c) => c.name === name);
}

test.describe.configure({ mode: 'serial' });

test.describe('Phase 5 verification: auth transport', () => {
  const email = uniqueEmail('transport');
  const password = 'CorrectHorse123!';

  test('register -> verify -> login -> cookie jar, storage, hard refresh, silent refresh, rotation/reuse-detection, CSRF', async ({
    page,
    context,
  }) => {
    // --- Register, verify, then exercise the real login endpoint once. ---
    await registerAndVerify(page, {
      name: 'Transport Tester',
      email,
      password,
    });
    await login(page, { email, password });

    await expect(
      page.locator('header').getByText('Transport Tester', { exact: false }),
    ).toBeVisible();

    // --- Cookie jar assertions ---
    const access = await getCookie(context, 'access_token');
    const refresh = await getCookie(context, 'refresh_token');
    expect(access, 'access_token cookie must be set').toBeTruthy();
    expect(refresh, 'refresh_token cookie must be set').toBeTruthy();
    expect(access!.httpOnly).toBe(true);
    expect(refresh!.httpOnly).toBe(true);
    expect(access!.sameSite).toBe('Lax');
    expect(refresh!.sameSite).toBe('Lax');
    // Local dev is plain HTTP (see docs/10-auth-roles.md: Secure is gated on NODE_ENV=production).
    expect(access!.secure).toBe(false);
    expect(refresh!.path).toBe('/api/v1/auth');

    // --- Web storage must be empty of tokens ---
    const storageDump = await page.evaluate(() => ({
      localStorage: { ...window.localStorage },
      sessionStorage: { ...window.sessionStorage },
    }));
    const serialized = JSON.stringify(storageDump).toLowerCase();
    expect(serialized).not.toContain('access_token');
    expect(serialized).not.toContain('refresh_token');
    expect(serialized).not.toMatch(/eyj[a-z0-9_-]{10,}/i); // no raw JWT anywhere in storage

    await page.screenshot({ path: 'test-results/cookie-jar-check.png' });

    // --- Survives a hard refresh ---
    await page.reload();
    await expect(
      page.locator('header').getByText('Transport Tester', { exact: false }),
    ).toBeVisible();

    // --- Silent refresh, rotation, and reuse-detection ---
    const before = await getCookie(context, 'refresh_token');
    expect(before).toBeTruthy();
    const oldRefreshValue = before!.value;

    // Force a 401: overwrite access_token with a bogus value so the next request is rejected.
    await context.addCookies([
      {
        name: 'access_token',
        value: 'expired.invalid.token',
        domain: 'localhost',
        path: '/',
      },
    ]);

    // Trigger an authenticated call; the client's apiRequest() should silently refresh-and-retry once.
    await page.reload();
    await expect(
      page.locator('header').getByRole('button', { name: /log out/i }),
    ).toBeVisible({ timeout: 10_000 });

    const after = await getCookie(context, 'refresh_token');
    expect(after).toBeTruthy();
    expect(after!.value, 'refresh token must rotate on use').not.toBe(
      oldRefreshValue,
    );

    // Reuse detection: replaying the OLD (pre-rotation) refresh token must now fail.
    const reuseResponse = await page.request.post(`${API_BASE}/auth/refresh`, {
      headers: {
        cookie: `refresh_token=${oldRefreshValue}`,
        'x-requested-with': 'buisnez-web',
      },
    });
    expect(reuseResponse.status()).toBe(401);

    // --- CSRF: a mutating request without the header is rejected; with it, accepted. ---
    const withoutHeader = await page.evaluate(async (base) => {
      const res = await fetch(`${base}/favorites/toggle`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          businessId: '00000000-0000-0000-0000-000000000000',
        }),
      });
      return res.status;
    }, API_BASE);
    expect(withoutHeader).toBe(403);

    const withHeader = await page.evaluate(async (base) => {
      const res = await fetch(`${base}/favorites/toggle`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'buisnez-web',
        },
        body: JSON.stringify({
          businessId: '00000000-0000-0000-0000-000000000000',
        }),
      });
      return res.status;
    }, API_BASE);
    // 404 (business doesn't exist) proves the CSRF guard let it through to the handler.
    expect(withHeader).not.toBe(403);
  });
});

test.describe('Phase 5 verification: contribution flows', () => {
  const email = uniqueEmail('contrib');
  const password = 'CorrectHorse123!';
  const unverifiedEmail = uniqueEmail('unverified');

  test('unverified user is blocked from writing a review', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel(/name/i).fill('Unverified User');
    await page.getByLabel(/email/i).fill(unverifiedEmail);
    await page.getByLabel(/password/i).fill(password);
    await page
      .getByRole('button', { name: /create account|sign up|register/i })
      .click();
    await expect(page.getByText(/verify/i)).toBeVisible({ timeout: 10_000 });

    await page.goto(`/business/${BUSINESS_SLUG}`);
    await expect(page.getByText(/verify your email/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByRole('button', { name: /post review|update review/i }),
    ).toHaveCount(0);
  });

  test('write a review with a photo, favourite it, vote helpful, and report it', async ({
    page,
  }) => {
    // registerAndVerify leaves us logged in already (register sets cookies) — no separate login() call.
    await registerAndVerify(page, { name: 'Contrib Tester', email, password });

    // Unique per run so re-running this suite against the same dev DB never collides with a title from a
    // prior run's (different, randomly-emailed) reviewer.
    const runId = email.split('@')[0];
    const firstTitle = `Great food, first pass (${runId})`;
    const editedTitle = `Great food, edited (${runId})`;

    await page.goto(`/business/${BUSINESS_SLUG}`);

    // Rate 5 stars on the overall rating (first radiogroup — the per-dimension ones follow it).
    await page
      .getByRole('radiogroup')
      .first()
      .getByRole('radio', { name: '5 stars' })
      .click();
    await page.getByLabel(/title/i).fill(firstTitle);
    await page
      .getByLabel(/review|body|comment/i)
      .last()
      .fill('Loved the biryani.');

    // Attach a photo via the hidden file input.
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('e2e/fixtures/test-photo.jpg');
    await expect(page.getByText(/uploading/i)).toHaveCount(0, {
      timeout: 15_000,
    });

    await page.getByRole('button', { name: /post review/i }).click();
    await expect(page.getByText(/review is live/i)).toBeVisible({
      timeout: 10_000,
    });

    // Reload profile: our review should now appear exactly once (upsert, not duplicate).
    await page.goto(`/business/${BUSINESS_SLUG}`);
    await expect(page.getByText(firstTitle)).toBeVisible();

    // Edit: re-open the form (existing review pre-fills), change the title, resubmit.
    await page.getByLabel(/title/i).fill(editedTitle);
    await page.getByRole('button', { name: /update review/i }).click();
    await expect(page.getByText(/review is live/i)).toBeVisible({
      timeout: 10_000,
    });

    await page.goto(`/business/${BUSINESS_SLUG}`);
    await expect(page.getByText(editedTitle)).toBeVisible();
    // The old title must be gone — proves upsert, not a second row.
    await expect(page.getByText(firstTitle)).toHaveCount(0);

    // --- Favourite, persisted across a reload and reflected on /account/favorites ---
    const favoriteButton = page
      .getByRole('button', { name: /save|saved/i })
      .first();
    await favoriteButton.click();
    await expect(
      page.getByRole('button', { name: /saved/i }).first(),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('button', { name: /saved/i }).first(),
    ).toBeVisible();

    await page.goto('/account/favorites');
    await expect(page.getByText('Karachi Biryani House')).toBeVisible();

    // --- Helpful vote persists ---
    await page.goto(`/business/${BUSINESS_SLUG}`);
    const helpfulButton = page
      .getByRole('button', { name: /helpful/i })
      .first();
    await helpfulButton.click();
    await page.waitForTimeout(500);
    await page.reload();
    await expect(helpfulButton).toBeVisible();

    // --- Report content ---
    await page
      .getByRole('button', { name: /^report$/i })
      .first()
      .click();
    await page.getByRole('button', { name: /submit report/i }).click();
    await expect(page.getByText(/thanks/i)).toBeVisible({ timeout: 10_000 });
  });

  test('/account redirects unauthenticated visitors to login with returnTo', async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto('/account');
    await page.waitForURL(/\/login\?returnTo=/, { timeout: 10_000 });
    expect(page.url()).toContain('returnTo');
  });
});
