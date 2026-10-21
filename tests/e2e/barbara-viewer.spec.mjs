import { test, expect } from '@playwright/test';

test('Barbara shipped GLB loads, expressions and review views work on desktop and mobile', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = page.waitForResponse('**/models/barbara/barbara-rigged.glb');
  await page.goto('/barbara.html');
  expect((await response).status()).toBe(200);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('#viewport canvas')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Barbara', exact: true })).toBeVisible();
  for (const [label, name] of [['Smile', 'smile'], ['Frown', 'frown'], ['Blink', 'blink'], ['Mouth open', 'mouthOpen']]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page.locator('#viewport')).toHaveAttribute('data-expression', name);
  }
  await page.getByRole('button', { name: 'Reset view' }).click();
  await expect(page.locator('#viewport')).toHaveAttribute('data-expression', 'neutral');
  await page.screenshot({ path: 'docs/barbara/browser-portrait.png' });
  await page.getByRole('button', { name: 'Full figure', exact: true }).click();
  await expect(page.locator('#viewport')).toHaveAttribute('data-frame', 'full');
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.locator('#viewport')).toHaveAttribute('data-angle', 'profile');
  await page.getByRole('button', { name: 'Auto rotate' }).click();
  await expect(page.getByRole('button', { name: 'Auto rotate' })).toHaveAttribute('aria-pressed', 'true');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Reset view' }).click();
  await expect(page.getByRole('button', { name: 'Mouth open' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/barbara/browser-mobile.png' });
  expect(errors).toEqual([]);
});

test('Barbara model failure is recoverable with the real asset', async ({ page }) => {
  let requests = 0;
  await page.route('**/models/barbara/barbara-rigged.glb', route => {
    requests += 1;
    return requests === 1 ? route.fulfill({ status: 404, body: 'Not found' }) : route.continue();
  });
  await page.goto('/barbara.html');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'error');
  await expect(page.getByRole('button', { name: 'Smile', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Reload model' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'ready');
  expect(requests).toBe(2);
});
