import { expect, test } from 'vitest';
import { sets } from '../src/data/sets.generated';
import { versionOverrides, extraVersions, mergeDates } from '../src/data/versions';
import { resolveAll } from '../src/logic/versions';
import { compare, identify, nextQuestion, separate } from '../src/logic/analysis';
import { itemKey } from '../src/data/types';

const all = resolveAll(sets, versionOverrides, extraVersions, mergeDates);
const get = (k: string) => all.find((v) => v.key === k)!;

test('versions resolve swaps', () => {
  const o = get('2000414-4/orig'), b = get('2000414-4/Oct 17, 2026');
  expect(o.parts.some((p) => p.partId === '3957b' && p.colorId === 16)).toBe(true);
  expect(b.parts.some((p) => p.partId === '3957b' && p.colorId === 16)).toBe(false);
  expect(b.parts.some((p) => p.partId === '3957b' && p.colorId === 15)).toBe(true);
  expect(o.parts.reduce((a, p) => a + p.qty, 0)).toBe(b.parts.reduce((a, p) => a + p.qty, 0));
});
test('identify ranks by observed part', () => {
  const r = identify([get('2000414-4/orig'), get('2000414-4/Oct 17, 2026')], [{ key: '3957b:15' }]);
  expect(r[0].version.id).toBe('Oct 17, 2026');
});
test('question splits candidates', () => {
  const q = nextQuestion([get('2000414-4/orig'), get('2000414-4/Oct 17, 2026')])!;
  expect(q.a.length).toBe(1);
  expect(q.b.length).toBe(1);
  expect([q.a[0], q.b[0]].sort()).toEqual(['3957b:15', '3957b:16']);
});
test('2000430-2 versions differ', () => {
  const vs = ['orig', 'Jul 1, 2023 + Jul 2, 2023', '2026'].map((i) => get(`2000430-2/${i}`));
  expect(compare(vs.slice(0, 2)).unique.length).toBeGreaterThan(0);
  const p = separate(vs.slice(0, 2));
  expect(Object.keys(p.piles).length).toBe(2);
});
