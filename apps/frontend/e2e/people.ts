import type { Browser, Page } from '@playwright/test';

/**
 * Helpers for tests that need their own people: each test signs fresh
 * people in, so it owns everything it looks at and can run beside others.
 */

const API = process.env.VITE_API_URL ?? 'http://localhost:3001';

/** Call the API as whoever is signed in on `page` — for set-up, never for what a test is checking. */
export const api = <T,>(page: Page, path: string, input: unknown = {}): Promise<T> =>
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

/** A brand-new person, signed in, in their own 1280px window. */
export async function newPerson(browser: Browser) {
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
