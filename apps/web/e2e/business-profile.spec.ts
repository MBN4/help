import { test, expect } from '@playwright/test';

test('business profile renders header, directions link, hours, and LocalBusiness JSON-LD', async ({
  page,
}) => {
  await page.goto('/business/karachi-biryani-house');

  await expect(
    page.getByRole('heading', { name: 'Karachi Biryani House' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /get directions/i }),
  ).toHaveAttribute('href', /google\.com\/maps\/dir/);

  const jsonLdBlocks = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  const types = jsonLdBlocks.map(
    (block) => (JSON.parse(block) as { '@type': string })['@type'],
  );
  expect(types).toContain('LocalBusiness');
  expect(types).toContain('BreadcrumbList');
});

test('unknown business slug renders a 404', async ({ page }) => {
  const response = await page.goto('/business/does-not-exist');
  expect(response?.status()).toBe(404);
});
