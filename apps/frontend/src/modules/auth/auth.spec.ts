import { expect, test } from '@playwright/test';

test.describe('Signing in', () => {
  test('a signed-out visitor is sent to sign in', async ({ page }) => {
    await page.goto('/overview');
    await page.waitForURL('**/auth/login');
    await expect(page.getByRole('heading', { name: 'Sign in to Kosh' })).toBeVisible();
  });

  test('the sign-in page offers Google', async ({ page }) => {
    await page.goto('/auth/login');
    const google = page.getByRole('button', { name: 'Continue with Google' });
    await expect(google).toBeVisible();
    await expect(google).toBeEnabled();
  });

  test('a failed Google sign-in says so in plain words', async ({ page }) => {
    await page.goto('/auth/login?error=oauth_failed');
    await expect(page.getByRole('alert')).toContainText("Google couldn't sign you in. Try again.");
  });

  test('signing in lands on the overview', async ({ page }) => {
    await page.goto('/auth/login');
    // Shows "Continue with Google" but uses a password login in test mode.
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    await page.waitForURL(/\/overview/);
    await expect(page.getByRole('button', { name: /your menu/i })).toBeVisible();
  });
});
