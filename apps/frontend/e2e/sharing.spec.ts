import type { Browser, Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * The sharing story, with two real sign-ins:
 *
 *   an owner shares one account → the other person sees that account and
 *   nothing else, at the level given → the owner removes them → they are told
 *   once, by name, and see nothing.
 *
 * Each person is a fresh sign-in, so the test owns everything it looks at.
 */

const API = process.env.VITE_API_URL ?? 'http://localhost:3001';

/** Call the API as whoever is signed in on `page` — used for set-up only. */
const api = <T,>(page: Page, path: string, input: unknown = {}): Promise<T> =>
  page.evaluate(
    async ([url, body]) => {
      const response = await fetch(url as string, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-csrf-token': 'orpc', authorization: 'Bearer token' },
        body: JSON.stringify({ json: body }),
      });
      const parsed = await response.json();
      if (!response.ok) throw new Error(`${url}: ${JSON.stringify(parsed).slice(0, 300)}`);
      return parsed.json;
    },
    [`${API}/api/user-app/${path}`, input] as const,
  );

/** A brand-new person, signed in. Sign-ups are rate limited, so this waits its turn. */
async function newPerson(browser: Browser) {
  for (let attempt = 0; ; attempt++) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto('/auth/login');
    await page.getByRole('button', { name: /continue with google/i }).click();
    try {
      await page.waitForURL('**/overview', { timeout: 10_000 });
      const { me } = await api<{ me: { name: string; email: string } }>(page, 'portfolio/directory');
      return { context, page, ...me };
    } catch (error) {
      await context.close();
      if (attempt >= 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, 4_000));
    }
  }
}

test('an owner shares one account; the other person sees only that, until they are removed', async ({
  browser,
  viewport,
}) => {
  test.skip((viewport?.width ?? 1280) < 900, 'This walks the desktop layout; both people get their own 1280px window.');
  test.setTimeout(120_000);

  const owner = await newPerson(browser);
  const guest = await newPerson(browser);
  const guestFirstName = guest.name.split(' ')[0] as string;

  // The owner's two accounts; only one will be shared.
  const holder = await api<{ id: string }>(owner.page, 'portfolio/createPerson', {
    displayName: 'Asha Rao',
    kind: 'login',
    isMe: true,
  });
  for (const [broker, label] of [
    ['zerodha', 'Asha · Zerodha'],
    ['groww', 'Asha · Groww'],
  ] as const)
    await api(owner.page, 'portfolio/createAccount', { personId: holder.id, broker, label });

  // ── The owner shares one account, checking what the other person will get ──
  await owner.page.goto('/accounts');
  await owner.page.getByRole('button', { name: 'Share Asha · Zerodha' }).click();
  const dialog = owner.page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Share Asha · Zerodha' })).toBeVisible();
  await dialog.getByRole('textbox').first().fill(guest.email);
  await dialog.getByText('Can edit', { exact: true }).click();
  await dialog.getByRole('button', { name: /^Next: check/ }).click();
  await expect(dialog.getByText('Check before you send')).toBeVisible();
  await expect(dialog.getByText('Asha · Groww')).toBeVisible(); // named under "They won't see"
  await dialog.getByRole('button', { name: /^Send invite/ }).click();
  await expect(owner.page.getByText(new RegExp(`${guestFirstName}.* can (now )?edit|can edit`, 'i')).first()).toBeVisible();

  // ── The other person sees that account, at that level, and nothing else ──
  await guest.page.goto('/shared');
  await expect(guest.page.getByRole('heading', { level: 1, name: 'Shared with me' })).toBeVisible();
  await expect(guest.page.getByText('Asha · Zerodha').first()).toBeVisible();
  await expect(guest.page.getByText('Can edit').first()).toBeVisible();
  await expect(guest.page.getByText('Asha · Groww')).toHaveCount(0);
  const seen = await api<{ accounts: { label: string; myLevel: string }[] }>(guest.page, 'portfolio/directory');
  expect(seen.accounts.map((a) => [a.label, a.myLevel])).toEqual([['Asha · Zerodha', 'edit']]);

  // They cannot share it on: an Edit level has no sharing, and the page offers none.
  await guest.page.goto('/accounts');
  await expect(guest.page.getByText('Asha · Zerodha').first()).toBeVisible();
  await expect(guest.page.getByRole('button', { name: 'Share Asha · Zerodha' })).toHaveCount(0);

  // ── The owner removes them ──
  await owner.page.goto('/access');
  await expect(owner.page.getByText(guest.name).first()).toBeVisible();
  const grants = await api<{ direct: { grantId: string; email: string }[] }>(owner.page, 'access/list', {
    accountId: (await api<{ accounts: { id: string; label: string }[] }>(owner.page, 'portfolio/directory')).accounts.find(
      (a) => a.label === 'Asha · Zerodha',
    )?.id,
  });
  const theirs = grants.direct.find((g) => g.email === guest.email);
  expect(theirs).toBeTruthy();
  await api(owner.page, 'access/revoke', { grantId: theirs?.grantId });

  // ── The other person is told once, by name, and sees nothing ──
  await guest.page.goto('/overview');
  const notice = guest.page.getByText('Asha · Zerodha is no longer shared with you');
  await expect(notice).toBeVisible();
  await guest.page.getByRole('button', { name: /dismiss|got it|close/i }).first().click();
  await expect(notice).toHaveCount(0);
  await guest.page.reload();
  await expect(guest.page.getByRole('button', { name: /your menu/i })).toBeVisible();
  await expect(notice).toHaveCount(0);
  expect((await api<{ accounts: unknown[] }>(guest.page, 'portfolio/directory')).accounts).toEqual([]);

  await owner.context.close();
  await guest.context.close();
});
