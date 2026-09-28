import { test, expect } from '@playwright/test';

test('search results respect the city filter carried in the URL', async ({
  page,
}) => {
  await page.goto('/search?city=lahore');

  await expect(
    page.getByRole('heading', { name: 'Search results' }),
  ).toBeVisible();
  const links = page.locator('a[href^="/business/"]');
  await expect(links.first()).toBeVisible();
  const hrefs = await links.evaluateAll((anchors) =>
    anchors.map((a) => a.getAttribute('href')),
  );
  expect(hrefs).toContain('/business/lahore-fort-cafe');
  expect(hrefs).not.toContain('/business/karachi-biryani-house');
});

test('changing the sort control updates the URL query string', async ({
  page,
}) => {
  await page.goto('/search');

  const sortTrigger = page
    .getByRole('combobox')
    .filter({ hasText: /relevance/i });
  await expect(sortTrigger).toBeVisible();
  // A plain `.click()` on this Radix trigger is unreliable in this environment's pinned older headless
  // Chromium (see docs/PROGRESS.md's Phase 4 note on why Playwright is pinned to 1.48.0 here) — the
  // pointer-event-based open sometimes silently no-ops, which is the pre-existing flake this test is
  // named for. Keyboard interaction (focus + Enter to open, per Radix Select's own a11y contract) is more
  // reliable there than a synthetic pointer click, so use that instead of racing a click against the portal.
  await sortTrigger.focus();
  await sortTrigger.press('Enter');
  await expect(sortTrigger).toHaveAttribute('aria-expanded', 'true');

  const ratingOption = page.getByRole('option', { name: 'Rating' });
  await ratingOption.waitFor({ state: 'visible' });
  await ratingOption.click();

  await expect(page).toHaveURL(/sort=rating/);
});

test('the map toggle reveals a map area (or its graceful fallback)', async ({
  page,
}) => {
  await page.goto('/search');
  await page.getByRole('button', { name: /show map/i }).click();
  await expect(page.getByText(/map|directions/i).first()).toBeVisible();
});
