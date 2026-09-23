import { test, expect } from '@playwright/test';

test('homepage renders discovery blocks and popular cities/categories', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Buisnez/);
  await expect(
    page.getByRole('heading', { name: /find trusted businesses near you/i }),
  ).toBeVisible();

  await expect(
    page.getByRole('link', { name: 'Lahore' }).first(),
  ).toBeVisible();
  await expect(page.locator('a[href^="/business/"]').first()).toBeVisible();
});
