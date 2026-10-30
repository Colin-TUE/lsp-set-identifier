import { expect, test, type Page } from '@playwright/test';

const PRODUCT = '2000414'; // five versions across three BrickLink variants

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

const ORIG = '2000414-4/orig';
const UPDATED = '2000414-4/Oct 17, 2026';

/** Start with two different versions already in the workshop (as if saved from an earlier visit). */
async function withWorkshop(
  page: Page,
  mixed: string[] = [],
  boxes: Record<string, number> = { [ORIG]: 1, [UPDATED]: 1 },
) {
  await page.addInitScript(
    ([ws, mx]) => {
      localStorage.setItem('lsp-workshop', ws);
      localStorage.setItem('lsp-mixed', mx);
    },
    [JSON.stringify(boxes), JSON.stringify(mixed)],
  );
  await page.goto('/');
}

test.describe('print', () => {
  test('Print opens the print dialog once and keeps ticks', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __prints: number };
      w.__prints = 0;
      window.print = () => void w.__prints++;
    });
    await withWorkshop(page);
    await page.locator('[data-tab="separate"]').first().click();
    await page.locator('[data-chk]').first().check();
    await page.locator('#print').click();
    expect(await page.evaluate(() => (window as unknown as { __prints: number }).__prints)).toBe(1);
    await expect(page.locator('[data-chk]').first()).toBeChecked();
  });
});

test.describe('picker dialog', () => {
  const dialog = (page: Page) => page.locator('#pickerDlg');

  test('opens, adds and removes boxes, and closes with Done', async ({ page }) => {
    await page.locator('#openPicker').click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).getByText('0 boxes in workshop')).toBeVisible();

    await dialog(page).locator(`[data-add="${ORIG}"]`).click();
    await expect(dialog(page)).toBeVisible(); // still open after the re-render
    await dialog(page).locator(`[data-add="${ORIG}"]`).click();
    await expect(dialog(page).getByText('2 boxes in workshop')).toBeVisible();
    await dialog(page).locator(`[data-dec="${ORIG}"]`).click();
    await expect(dialog(page).getByText('1 box in workshop')).toBeVisible();
    await dialog(page).locator(`[data-dec="${ORIG}"]`).click();
    await expect(dialog(page).getByText('0 boxes in workshop')).toBeVisible();

    await dialog(page).locator(`[data-add="${ORIG}"]`).click();
    await page.locator('#closePicker').click();
    await expect(dialog(page)).toBeHidden();
    await expect(page.locator('.ui-badge', { hasText: '1 box' })).toBeVisible();
  });

  test('closes with Escape and stays closed after the next re-render', async ({ page }) => {
    await page.locator('#openPicker').click();
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    await page.locator('#setFilter').selectOption(PRODUCT); // triggers a re-render
    await expect(dialog(page)).toBeHidden();
  });

  test('closes when clicking the backdrop but not the content', async ({ page }) => {
    await page.locator('#openPicker').click();
    await dialog(page)
      .locator('.ui-dialog__body')
      .click({ position: { x: 5, y: 5 } });
    await expect(dialog(page)).toBeVisible();
    const box = (await dialog(page).boundingBox())!;
    await page.mouse.click(box.x - 10, box.y - 10);
    await expect(dialog(page)).toBeHidden();
  });

  test('workshop panel steppers change the count and remove the row at zero', async ({ page }) => {
    await withWorkshop(page);
    const panel = page.locator('.ui-layout__aside');
    await panel.locator(`[data-add="${ORIG}"]`).click();
    await expect(page.locator('.ui-badge', { hasText: '3 boxes' })).toBeVisible();
    await panel.locator(`[data-dec="${ORIG}"]`).click();
    await panel.locator(`[data-dec="${ORIG}"]`).click();
    await expect(panel.locator(`[data-add="${ORIG}"]`)).toHaveCount(0);
    await expect(page.locator('.ui-badge', { hasText: '1 box' })).toBeVisible();
  });
});

test.describe('sorting', () => {
  test('shows an empty state without boxes and a hint with a single version', async ({ page }) => {
    await page.locator('[data-tab="separate"]').first().click();
    await expect(page.getByText('Add the boxes used in your workshop first.')).toBeVisible();
    await page.locator('[data-tab="identify"]').first().click();
    await expect(page.getByRole('heading', { name: 'Identify a box' })).toBeVisible();
  });

  test('same version only: nothing to sort', async ({ page }) => {
    await page.addInitScript((ws) => localStorage.setItem('lsp-workshop', ws), JSON.stringify({ [ORIG]: 2 }));
    await page.goto('/');
    await page.locator('[data-tab="separate"]').first().click();
    await expect(page.getByText('All boxes are the same version')).toBeVisible();
  });

  test('"Skip sorting" moves a version into a mixed pile and "Sort out" brings it back', async ({ page }) => {
    await withWorkshop(page);
    await page.locator('[data-tab="separate"]').first().click();
    await expect(page.getByText('Kept mixed')).toHaveCount(0);

    await page.locator(`[data-mix="${UPDATED}"]`).first().click();
    await expect(page.getByRole('heading', { name: /Kept mixed \(1 boxes\)/ })).toBeVisible();

    await page.locator(`[data-mix="${UPDATED}"]`).first().click();
    await expect(page.getByText('Kept mixed')).toHaveCount(0);
  });

  test('everything kept mixed leaves nothing to sort', async ({ page }) => {
    await withWorkshop(page, [ORIG, UPDATED]);
    await page.locator('[data-tab="separate"]').first().click();
    await expect(page.getByText('Everything is kept mixed')).toBeVisible();
    await page.locator(`[data-mix="${ORIG}"]`).first().click();
    await expect(page.getByText('Everything is kept mixed')).toHaveCount(0);
  });

  test('with three sets (one with several copies) every kept-mixed version can be sorted out again', async ({
    page,
  }) => {
    const A = '2000414-4/orig'; // 1 box
    const B = '2000430-2/orig'; // 3 boxes
    const C = '2000431-1/orig'; // 1 box
    await withWorkshop(page, [], { [A]: 1, [B]: 3, [C]: 1 });
    await page.locator('[data-tab="separate"]').first().click();
    const toggle = (k: string) => page.locator(`[data-mix="${k}"]`);
    const sortOutButtons = () => page.getByRole('button', { name: 'Sort out' });

    // Skip sorting on all three, one after the other: each one moves to the mixed pile and keeps a "Sort out" button.
    await toggle(A).first().click();
    await expect(page.getByRole('heading', { name: 'Kept mixed (1 boxes)' })).toBeVisible();
    await toggle(B).first().click();
    await expect(page.getByRole('heading', { name: 'Kept mixed (4 boxes)' })).toBeVisible();
    await expect(sortOutButtons()).toHaveCount(2);
    await toggle(C).first().click();
    await expect(page.getByText('Everything is kept mixed')).toBeVisible();
    await expect(sortOutButtons()).toHaveCount(3);

    // Sort one out: the other two stay in the mixed pile, both with a working "Sort out" button.
    await toggle(B).first().click();
    await expect(page.getByRole('heading', { name: 'Kept mixed (2 boxes)' })).toBeVisible();
    await expect(sortOutButtons()).toHaveCount(2);
    await expect(toggle(A)).toHaveText('Sort out');
    await expect(toggle(C)).toHaveText('Sort out');

    // Sort out a second one: the last one stays in the mixed pile and can still be sorted out.
    await toggle(A).first().click();
    await expect(page.getByRole('heading', { name: 'Kept mixed (1 boxes)' })).toBeVisible();
    await expect(sortOutButtons()).toHaveCount(1);
    await expect(toggle(C)).toHaveText('Sort out');

    // Sorting out the last one leaves no mixed pile and every version has "Skip sorting" again.
    await toggle(C).first().click();
    await expect(page.getByText('Kept mixed')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Skip sorting' })).toHaveCount(3);
  });

  test('a multi-copy version kept mixed shows its box count in the mixed pile', async ({ page }) => {
    const A = '2000414-4/orig';
    const B = '2000430-2/orig';
    await withWorkshop(page, [B], { [A]: 1, [B]: 3 });
    await page.locator('[data-tab="separate"]').first().click();
    await expect(page.getByRole('heading', { name: 'Kept mixed (3 boxes)' })).toBeVisible();
    await expect(page.locator('.ui-list-row', { hasText: '3 ×' })).toBeVisible();
  });

  test('the progress counter follows the ticks', async ({ page }) => {
    await withWorkshop(page);
    await page.locator('[data-tab="separate"]').first().click();
    await expect(page.getByText(/^0 of \d+ parts sorted$/)).toBeVisible();
    await page.locator('[data-chk]').first().check();
    await expect(page.getByText(/^1 of \d+ parts sorted$/)).toBeVisible();
  });
});

test.describe('identify details', () => {
  test('"Not sure, skip" hides that question, then no more can be asked', async ({ page }) => {
    await page.locator('#setFilter').selectOption(PRODUCT);
    const skip = page.locator('[data-ans="skip"]');
    for (let i = 0; i < 20 && (await skip.count()); i++) await skip.click();
    await expect(page.getByText('No more questions can tell the remaining versions apart')).toBeVisible();
    await expect(page.locator('#resetAns')).toBeVisible();
    await page.locator('#resetAns').click();
    await expect(page.locator('[data-ans="skip"]')).toBeVisible();
  });

  test('parts that no version has together show a notice and can be removed', async ({ page }) => {
    await page.locator('#setFilter').selectOption(PRODUCT);
    const options = await page.locator('#parts option').evaluateAll((os) => os.map((o) => o.getAttribute('value')!));
    // Trans-Neon Green is only in the original, Trans-Light Blue only in the 2026 update.
    const pair = options.filter((o) => /^3957b \| Trans-(Neon Green|Light Blue) \|/.test(o));
    expect(pair).toHaveLength(2);
    for (const value of pair) {
      await page.locator('#partIn').fill(value);
      await page.locator('#addObs').click();
    }
    await expect(page.getByText('No version contains all these parts')).toBeVisible();
    await page.locator('[data-rm]').first().click();
    await expect(page.getByText('No version contains all these parts')).toHaveCount(0);
    await expect(page.locator('[data-rm]')).toHaveCount(1);
  });

  test('a looked-up part with a quantity ranks the versions and shows scores', async ({ page }) => {
    await page.locator('#setFilter').selectOption(PRODUCT);
    const options = await page.locator('#parts option').evaluateAll((os) => os.map((o) => o.getAttribute('value')!));
    await page.locator('#partIn').fill(options.find((o) => o.startsWith('3957b | Black |'))!);
    await page.locator('#qtyIn').fill('1');
    await page.locator('#addObs').click();
    await expect(page.locator('[data-rm]')).toHaveCount(1);
    await page.locator('summary', { hasText: 'Possible versions' }).click();
    await expect(page.locator('.ui-list-row', { hasText: /score -?\d/ }).first()).toBeVisible();
  });

  test('the "Add to workshop" button on the details list adds without resetting', async ({ page }) => {
    await page.locator('#setFilter').selectOption(PRODUCT);
    await page.locator('details', { hasText: 'Possible versions' }).first().locator('summary').first().click();
    await page.locator(`[data-add="${ORIG}"]`).first().click();
    await expect(page.locator('.ui-badge', { hasText: '1 box' })).toBeVisible();
    await expect(page.locator('#setFilter')).toHaveValue(PRODUCT);
  });
});
