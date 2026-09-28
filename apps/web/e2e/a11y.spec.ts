import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Runs axe against a handful of key public-facing pages. Zero `serious`/`critical` violations are required
 * to pass; `moderate`/`minor` violations are allowed through for now but logged so they show up in CI output
 * (see docs/PROGRESS.md Phase 9 notes for a running list to burn down later).
 */
const SEVERE_IMPACTS = new Set(['serious', 'critical']);

async function runAxeAndAssert(
  page: import('@playwright/test').Page,
  label: string,
): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const severe = results.violations.filter(
    (violation) => violation.impact && SEVERE_IMPACTS.has(violation.impact),
  );
  const minor = results.violations.filter(
    (violation) => !violation.impact || !SEVERE_IMPACTS.has(violation.impact),
  );

  if (minor.length > 0) {
    // eslint-disable-next-line no-console
    console.log(
      `[a11y] ${label}: ${minor.length} moderate/minor violation(s) allowed through:`,
      minor.map((v) => `${v.id} (${v.impact})`).join(', '),
    );
  }

  expect(
    severe,
    `${label}: serious/critical a11y violations:\n${JSON.stringify(severe, null, 2)}`,
  ).toEqual([]);
}

test('homepage has no serious/critical a11y violations', async ({ page }) => {
  await page.goto('/');
  await runAxeAndAssert(page, 'homepage');
});

test('search page has no serious/critical a11y violations', async ({
  page,
}) => {
  await page.goto('/search');
  await runAxeAndAssert(page, 'search');
});

test('a business profile page has no serious/critical a11y violations', async ({
  page,
}) => {
  await page.goto('/search?city=lahore');
  const firstBusinessLink = page.locator('a[href^="/business/"]').first();
  await expect(firstBusinessLink).toBeVisible();
  await firstBusinessLink.click();
  await page.waitForURL(/\/business\//);
  await runAxeAndAssert(page, 'business profile');
});

test('account page has no serious/critical a11y violations', async ({
  page,
}) => {
  // /account requires an authenticated session; unauthenticated visitors are redirected to /login, which is
  // itself a public-facing page worth checking for a11y regressions.
  await page.goto('/account');
  await runAxeAndAssert(page, 'account (or its login redirect)');
});

test('admin login gate has no serious/critical a11y violations', async ({
  page,
}) => {
  // Pre-auth admin routes redirect to /login — checking the stable public-facing gate here rather than any
  // authenticated admin page, which belongs to the admin agent's scope.
  await page.goto('/admin');
  await runAxeAndAssert(page, 'admin (pre-auth)');
});
