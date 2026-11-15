import { expect, test } from './fixtures';

/**
 * The app shell: every destination is reachable, each page names itself,
 * and the colour theme can be switched and is remembered.
 */

const DESTINATIONS = [
  { link: 'Overview', path: '/overview' },
  { link: 'Holdings', path: '/holdings' },
  { link: 'Groups', path: '/groups' },
  { link: /^Accounts/, path: '/accounts', title: 'Accounts and people' },
  { link: 'Shared with me', path: '/shared' },
  { link: 'Who can see what', path: '/access' },
  { link: 'Activity', path: '/activity' },
] as const;

const isPhone = (viewport: { width: number } | null) => (viewport?.width ?? 1280) < 900;

test('every destination opens and names itself', async ({ page, viewport }) => {
  await page.goto('/overview');
  // The shell appears once the session has loaded; nothing below waits by itself.
  await expect(page.getByRole('button', { name: /your menu/i })).toBeVisible();
  const phone = isPhone(viewport);

  for (const destination of DESTINATIONS) {
    const title = 'title' in destination ? destination.title : (destination.link as string);
    const nav = page.getByRole('navigation', { name: 'Main' });
    const link = nav.getByRole('link', { name: destination.link, exact: true });

    if (await link.isVisible()) {
      await link.click();
    } else {
      // On a phone, pages without a tab are reached from the menu.
      await page.getByRole('button', { name: /your menu/i }).click();
      await page.getByRole('menuitem', { name: title }).click();
    }

    await page.waitForURL(`**${destination.path}`);
    await expect(page).toHaveTitle(`${title} · Kosh`);
    if (phone) {
      await expect(page.getByRole('banner')).toContainText(title);
    } else {
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
      await expect(link).toHaveAttribute('aria-current', 'page');
    }
  }
});

test('the colour theme can be switched and is remembered on this device', async ({ page }) => {
  await page.goto('/overview');
  const html = page.locator('html');

  await page.getByRole('button', { name: /your menu/i }).click();
  await page.getByRole('button', { name: 'Dark' }).click();
  await expect(html).toHaveAttribute('data-kosh-scheme', 'dark');

  await page.reload();
  await expect(html).toHaveAttribute('data-kosh-scheme', 'dark');

  await page.getByRole('button', { name: /your menu/i }).click();
  await page.getByRole('button', { name: 'Light' }).click();
  await expect(html).toHaveAttribute('data-kosh-scheme', 'light');
});

test('the component gallery renders every shared component in both themes', async ({
  page,
}, testInfo) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(String(error)));
  page.on('console', (message) => {
    // The test environment carries a placeholder Sentry address; that is not the kit's doing.
    if (message.type() === 'error' && !message.text().includes('Sentry')) problems.push(message.text());
  });

  await page.goto('/kit');
  await expect(page.getByRole('heading', { level: 1, name: 'Component gallery' })).toBeVisible();

  for (const scheme of ['Light', 'Dark'] as const) {
    await page.getByRole('group', { name: 'Colour theme' }).getByRole('button', { name: scheme }).click();
    await expect(page.locator('html')).toHaveAttribute('data-kosh-scheme', scheme.toLowerCase());
    await page.evaluate(() => document.fonts.ready);

    // The three levels always read the same three ways.
    await expect(page.locator('[data-level="view"]').first()).toHaveText('Can view');
    await expect(page.locator('[data-level="edit"]').first()).toHaveText('Can edit');
    await expect(page.locator('[data-level="owner"]').first()).toHaveText('Owner');

    // Kept with the report: the picture of the kit this build produced.
    await testInfo.attach(`kit-${scheme.toLowerCase()}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  }

  // Overlays open, trap focus in a dialog, and close on Escape.
  await page.getByRole('button', { name: 'Open confirm' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('needs an owner');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  expect(problems).toEqual([]);
});
