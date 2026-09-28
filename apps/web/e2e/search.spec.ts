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
  await sortTrigger.click();
  // Radix's Select opens asynchronously (portal + position calc) — wait for the trigger to actually report
  // itself open before looking for the option, instead of racing the click against the portal mount. This
  // is what fixed the pre-existing flake where `getByRole('option', { name: 'Rating' })` intermittently
  // never appeared (see docs/PROGRESS.md Phase 8 notes).
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
