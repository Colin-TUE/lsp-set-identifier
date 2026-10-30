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

test('pending 2026 version of 2000430-2 is built from the change request', () => {
  const v23 = get('2000430-2/Jul 1, 2023 + Jul 2, 2023'), v26 = get('2000430-2/2026');
  expect(v26.pending).toBe(true);
  expect(v26.parts.reduce((a, p) => a + p.qty, 0)).toBe(v23.parts.reduce((a, p) => a + p.qty, 0));
  expect(v26.parts.some((p) => p.partId === '3003' && p.colorId === 156 && p.qty === 20)).toBe(true);
  expect(v26.parts.some((p) => p.partId === '3003' && p.colorId === 42)).toBe(false);
  expect(v26.extras.some((e) => e.partId === '39262' && e.qty === 4)).toBe(true);
});

test('pending 2026 version of 2000431-1 applies swaps, removals, quantity changes and additions', () => {
  const o = get('2000431-1/orig'), v = get('2000431-1/2026');
  expect(v.pending).toBe(true);
  expect(v.parts.some((p) => p.partId === '3666')).toBe(false);
  expect(v.parts.find((p) => p.partId === '2780')!.qty).toBe(100);
  expect(v.parts.find((p) => p.partId === '3706')!.qty).toBe(10);
  expect(v.parts.find((p) => p.partId === '32034' && p.colorId === 86)!.qty).toBe(100);
  expect(v.parts.some((p) => p.partId === '49743c01')).toBe(true);
  expect(v.parts.some((p) => p.partId === '57029c01')).toBe(false);
  expect(o.parts.some((p) => p.partId === '3666')).toBe(true);
});
