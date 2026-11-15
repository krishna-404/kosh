import { expect, test } from './fixtures';

test('the root address lands on the overview when signed in', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL('**/overview');
  await expect(page.getByRole('button', { name: /your menu/i })).toBeVisible();
});

test('an address that does not exist goes home instead of a blank page', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForURL('**/overview');
  await page.goto('/no-such-page');
  await page.waitForURL('**/overview');
});
