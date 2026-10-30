import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { parseInventory } from '../scripts/parse';

const inv = parseInventory(readFileSync('fixtures/2000414-4.html', 'latin1'), '2000414-4', 'x');
const by = (k: string) => inv.items.filter((i) => i.kind === k);

test('sections', () => {
  expect(by('regular').length).toBe(117);
  expect(by('regular').reduce((a, i) => a + i.qty, 0)).toBe(234);
  expect(by('extra').length).toBe(3);
  expect(by('counterpart').length).toBe(4);
  expect(by('alternate').length).toBe(1);
});
test('colors and match ids', () => {
  const neon = by('regular').find((i) => i.partId === '3957b' && i.colorId === 16)!;
  const blue = by('alternate')[0];
  expect(neon.colorName).toBe('Trans-Neon Green');
  expect(blue.colorId).toBe(15);
  expect(blue.matchId).toBeGreaterThan(0);
  expect(neon.matchId).toBe(blue.matchId);
  const dbg = by('regular').find((i) => i.colorName === 'Dark Bluish Gray')!;
  expect(dbg.name).not.toMatch(/^Dark/);
});

import { parseChangelog } from '../scripts/parse';
test('changelog groups by date', () => {
  const g = parseChangelog(readFileSync('fixtures/2000430-2.changelog.html', 'latin1'));
  expect(g).toEqual([
    { date: 'Jul 1, 2023', matchIds: [1] },
    { date: 'Jul 2, 2023', matchIds: [2, 3] },
  ]);
});
