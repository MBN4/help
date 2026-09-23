import { test, expect } from '@playwright/test';

test('city hub page shows the city name and category links', async ({
  page,
}) => {
  await page.goto('/lahore');

  await expect(
    page.getByRole('heading', { name: 'Lahore', exact: true }),
  ).toBeVisible();
  await expect(page.locator('a[href^="/lahore/"]').first()).toBeVisible();
});

test('city + category page renders results and BreadcrumbList/ItemList JSON-LD', async ({
  page,
}) => {
  await page.goto('/lahore/restaurants');

  await expect(
    page.getByRole('heading', { name: /restaurants in lahore/i }),
  ).toBeVisible();

  const jsonLdBlocks = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  const types = jsonLdBlocks.map(
    (block) => (JSON.parse(block) as { '@type': string })['@type'],
  );
  expect(types).toContain('BreadcrumbList');
  expect(types).toContain('ItemList');
});
