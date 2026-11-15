import { expect, test } from './fixtures';
import { api, newPerson } from './people';

/**
 * A statement goes in, is checked before anything is saved, shows up as
 * holdings and a value, raises a question that can be answered — and all of
 * it comes back out with Undo.
 *
 * The account is at a broker Kosh has no reader for, so the files are in
 * Kosh's own layout: made up here, never anyone's real statement.
 */

const TRADES = [
  'date,type,symbol,isin,quantity,price',
  '02-04-2024,buy,INFY,INE009A01021,10,1480.50',
  '17-09-2024,sell,INFY,INE009A01021,4,1905',
  '05-11-2024,buy,TCS,INE467B01029,3,4100',
].join('\n');

const CASH = [
  'date,description,money in,money out,balance,what',
  '2024-04-01,Transfer from my bank,50000,,50000.00,put in',
  '2024-04-03,Paid for shares bought on 2 April,,14805.00,35195.00,for trades',
  '2024-07-15,Something the statement did not explain,,95.00,35100.00,',
].join('\n');

const csv = (name: string, text: string) => ({ name, mimeType: 'text/csv', buffer: Buffer.from(text) });

test('a statement is checked, added, shown, questioned and undone', async ({ browser, viewport }) => {
  test.skip((viewport?.width ?? 1280) < 900, 'This walks the desktop layout in its own 1280px window.');
  test.setTimeout(120_000);

  const { context, page } = await newPerson(browser);
  const holder = await api<{ id: string }>(page, 'portfolio/createPerson', { displayName: 'Asha Rao', kind: 'login', isMe: true });
  const account = await api<{ id: string }>(page, 'portfolio/createAccount', {
    personId: holder.id,
    broker: 'groww',
    label: 'Asha · Groww',
  });

  // ── Nothing is in yet: the statements tab leads with the upload ──
  await page.goto(`/accounts/${account.id}?tab=statements`);
  await expect(page.getByRole('heading', { level: 1, name: 'Asha · Groww' })).toBeVisible();
  const picker = page.locator('input[type="file"]');

  // ── The trades: shown before anything is saved, then added ──
  await picker.setInputFiles(csv('trades.csv', TRADES));
  const check = page.getByRole('dialog');
  await expect(check.getByText(/3 lines are new and will be added/)).toBeVisible();
  await check.getByRole('button', { name: 'Add 3 lines' }).click();
  await expect(page.getByText(/trades\.csv added — 3 lines/)).toBeVisible();

  // The very same file again adds nothing, and says so.
  await picker.setInputFiles(csv('trades.csv', TRADES));
  await expect(page.getByRole('dialog').getByText(/already|Nothing was added/i).first()).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: /cancel|close|done|ok/i }).first().click();

  // ── It is now holdings, and a value ──
  await page.getByRole('tab', { name: 'Holdings' }).click();
  await expect(page.getByRole('tabpanel').getByText('INFY').first()).toBeVisible();
  await expect(page.getByRole('tabpanel').getByText('TCS').first()).toBeVisible();
  const holdings = await api<{ holdings: { symbol: string; quantity: string }[] }>(page, 'money/holdings', {
    scope: { kind: 'account', id: account.id },
  });
  expect(holdings.holdings.map((h) => [h.symbol, h.quantity]).sort()).toEqual([
    ['INFY', '6'],
    ['TCS', '3'],
  ]);

  // ── The cash table: one line it could not explain becomes a question ──
  await page.getByRole('tab', { name: /Statements and questions/ }).click();
  await picker.setInputFiles(csv('cash.csv', CASH));
  await page.getByRole('dialog').getByRole('button', { name: 'Add 3 lines' }).click();
  await expect(page.getByText('What was this ledger line?')).toBeVisible();
  await expect(page.getByText(/Something the statement did not explain/)).toBeVisible();

  // Answered, it stops being a question.
  await page.getByRole('button', { name: 'Charges or fees' }).click();
  await page.getByRole('button', { name: 'Save answer' }).click();
  await expect(page.getByText('What was this ledger line?')).toHaveCount(0);
  const questions = await api<unknown[]>(page, 'questions/list', { accountId: account.id });
  expect(questions).toEqual([]);

  // ── Undo takes the trades back out; nothing is left held ──
  const uploads = await api<{ batchId: string; fileName: string }[]>(page, 'imports/list', { accountId: account.id });
  const trades = uploads.find((u) => u.fileName === 'trades.csv');
  expect(trades).toBeTruthy();
  const row = page.getByRole('listitem').filter({ hasText: 'trades.csv' }).first();
  await row.getByRole('button', { name: /undo/i }).click();
  await page.getByRole('dialog').getByRole('button', { name: /undo/i }).click();
  await expect
    .poll(async () => (await api<{ holdings: unknown[] }>(page, 'money/holdings', { scope: { kind: 'account', id: account.id } })).holdings.length)
    .toBe(0);
  // The upload is still listed — undone, not deleted.
  await expect(page.getByRole('listitem').filter({ hasText: 'trades.csv' }).first()).toContainText(/undone/i);

  await context.close();
});
