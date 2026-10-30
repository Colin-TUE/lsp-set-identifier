import { expect, test, type Page } from '@playwright/test';

const PRODUCT = '2000414'; // two versions that differ by one part

const candidates = (page: Page) => page.locator('.ui-badge', { hasText: /\d+ candidates?/ });
const count = async (page: Page) => Number((await candidates(page).textContent())!.match(/\d+/)![0]);

const errors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on('pageerror', (e) => list.push(e.message));
  await page.goto('/');
});

test.afterEach(({ page }) => {
  expect(errors.get(page)).toEqual([]);
});

test('app loads with the identify tab and no workshop', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Identify a box' })).toBeVisible();
  await expect(page.getByText('No boxes yet')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start over' })).toHaveCount(0);
});

test('picking a product number narrows the candidates', async ({ page }) => {
  const before = await count(page);
  await page.locator('#setFilter').selectOption(PRODUCT);
  expect(await count(page)).toBeLessThan(before);
});

test('answering questions identifies one box that can be added to the workshop', async ({ page }) => {
  await page.locator('#setFilter').selectOption(PRODUCT);
  while ((await count(page)) > 1) await page.locator('[data-ans="A"]').first().click();
  await expect(page.getByText('This box is')).toBeVisible();
  await page.getByRole('button', { name: 'Add to workshop' }).click();
  await expect(page.getByText('Ready for the next box')).toBeVisible();
  await expect(page.locator('.ui-badge', { hasText: '1 box' })).toBeVisible();
});

test('Start over keeps product and parts, Next box clears them', async ({ page }) => {
  await page.locator('#setFilter').selectOption(PRODUCT);
  await page.locator('[data-ans]').first().click();
  await page.locator('#partIn').fill(await firstOption(page));
  await page.locator('#addObs').click();
  await expect(page.locator('[data-rm]')).toHaveCount(1);

  await page.locator('#resetAns').click();
  await expect(page.locator('#setFilter')).toHaveValue(PRODUCT);
  await expect(page.locator('[data-rm]')).toHaveCount(1);
  await expect(page.locator('#resetAns')).toHaveCount(0);

  while ((await count(page)) > 1) await page.locator('[data-ans="A"]').first().click();
  await page.locator('#nextBox').click();
  await expect(page.locator('#setFilter')).toHaveValue('');
  await expect(page.locator('[data-rm]')).toHaveCount(0);
});

test('adding an unknown part shows an alert', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', (d) => {
    dialogs.push(d.message());
    void d.dismiss();
  });
  await page.locator('#partIn').fill('not a real part');
  await page.locator('#addObs').click();
  expect(dialogs).toEqual(['Pick a part from the suggestion list.']);
});

test('workshop and ticks survive a reload; sort tab shows piles', async ({ page }) => {
  await page.locator('#openPicker').click();
  // Two different versions of the same product, so there is something to sort.
  await page.locator('dialog [data-add]').nth(0).click();
  await page.locator('dialog [data-add]').nth(1).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.ui-badge', { hasText: '2 boxes' })).toBeVisible();

  await page.reload();
  await expect(page.locator('.ui-badge', { hasText: '2 boxes' })).toBeVisible();

  await page.locator('[data-tab="separate"]').first().click();
  await expect(page.getByRole('heading', { name: 'Sort after workshop' }).first()).toBeVisible();
  const box = page.locator('[data-chk]').first();
  await box.check();
  await page.reload();
  await page.locator('[data-tab="separate"]').first().click();
  await expect(page.locator('[data-chk]').first()).toBeChecked();

  page.once('dialog', (d) => void d.accept());
  await page.locator('#clearChk').click();
  await expect(page.locator('[data-chk]:checked')).toHaveCount(0);
});

async function firstOption(page: Page) {
  return (await page.locator('#parts option').first().getAttribute('value'))!;
}
