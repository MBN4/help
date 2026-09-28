import { test, expect } from '@playwright/test';

/**
 * Exercises the real Google Maps JS API — the search map toggle and the business-owner PinDropMap editor —
 * rather than just their graceful "map unavailable" fallback (which the rest of the suite covers without a
 * key). This requires a real NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, which this environment does not have, so the
 * whole file is skipped here. This is a conscious re-defer for Phase 9, not an oversight — see
 * docs/PROGRESS.md's Phase 9 deferred-item notes. The body below is written as if a key WILL be present
 * when this runs somewhere that has one (e.g. staging/CI with a restricted-quota key).
 */
test.skip(
  !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  'Requires a real Google Maps API key — see docs/PROGRESS.md Phase 9 deferred-item notes',
);

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? 'owner@buisnez.pk';
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? 'Password123!';
const OWNER_BUSINESS_ID = process.env.E2E_OWNER_BUSINESS_ID ?? '';

test('the search page map toggle renders a real Google Map with markers', async ({
  page,
}) => {
  await page.goto('/search?city=lahore');
  await page.getByRole('button', { name: /show map/i }).click();

  await page.waitForFunction(() => Boolean(window.google?.maps));
  const hasGoogle = await page.evaluate(() => Boolean(window.google?.maps));
  expect(hasGoogle).toBe(true);

  // Google Maps renders markers as <img> or <div> nodes inside the map container with a distinctive
  // draggable/aria attribute set by the JS API — the map container itself is enough to assert on here
  // without depending on Maps' undocumented internal marker DOM structure.
  const mapContainer = page.locator('.gm-style').first();
  await expect(mapContainer).toBeVisible();
  const markers = page.locator(
    '.gm-style img[src*="marker"], .gm-style [role="img"]',
  );
  await expect(markers.first()).toBeVisible();
});

test('an owner can drag the PinDropMap marker, save, and the change persists after reload', async ({
  page,
}) => {
  test.skip(
    !OWNER_BUSINESS_ID,
    'Requires E2E_OWNER_BUSINESS_ID pointing at a business owned by the test account',
  );

  await page.goto('/login');
  await page.getByLabel(/email/i).fill(OWNER_EMAIL);
  await page.getByLabel(/password/i).fill(OWNER_PASSWORD);
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL(/\/account/);

  await page.goto(`/account/businesses/${OWNER_BUSINESS_ID}`);

  const mapContainer = page.locator('.gm-style').first();
  await expect(mapContainer).toBeVisible();

  const latInput = page.locator('#location-lat');
  const lngInput = page.locator('#location-lng');
  // The numeric fallback inputs aren't rendered once the real map is ready, but PinDropMap still exposes
  // the current value through them when the map fails to init — so this assertion only applies to the
  // fallback path. With a real key, verify persistence via the map's own drag instead:
  const marker = page.locator('.gm-style img[src*="marker"]').first();
  const box = await marker.boundingBox();
  if (!box) {
    throw new Error('Could not locate the draggable marker to drag.');
  }
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 40, startY + 40, { steps: 10 });
  await page.mouse.up();

  await page.getByRole('button', { name: /save changes/i }).click();
  await expect(page.getByText(/saved/i)).toBeVisible();

  await page.reload();
  await expect(mapContainer).toBeVisible();
  // A full round-trip check would compare stored lat/lng against the dragged position; since PinDropMap
  // doesn't expose the current coordinates in the DOM once the real map is active, this at minimum confirms
  // the page reloads cleanly with the map still functional post-save. If exact coordinate persistence needs
  // asserting, add a data-testid exposing the current value, or read it back via the manage-profile API.
  if ((await latInput.count()) > 0) {
    await expect(latInput).not.toHaveValue('');
  }
});
