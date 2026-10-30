import type { ResolvedVersion, SetInventory } from '../src/data/types';
import { describe, expect, test } from 'vitest';
import { sets } from '../src/data/sets.generated';
import { versionOverrides, extraVersions, mergeDates } from '../src/data/versions';
import { defaultDefs, resolveAll, resolveVersion } from '../src/logic/versions';
import { changeFrom, compare, distinguish, identify, nextQuestion, questionId, separate } from '../src/logic/analysis';

const all = resolveAll(sets, versionOverrides, extraVersions, mergeDates);
const get = (k: string) => all.find((v) => v.key === k)!;

test('versions resolve swaps', () => {
  const o = get('2000414-4/orig'),
    b = get('2000414-4/Oct 17, 2026');
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
  const v23 = get('2000430-2/Jul 1, 2023 + Jul 2, 2023'),
    v26 = get('2000430-2/2026');
  expect(v26.pending).toBe(true);
  expect(v26.parts.reduce((a, p) => a + p.qty, 0)).toBe(v23.parts.reduce((a, p) => a + p.qty, 0));
  expect(v26.parts.some((p) => p.partId === '3003' && p.colorId === 156 && p.qty === 20)).toBe(true);
  expect(v26.parts.some((p) => p.partId === '3003' && p.colorId === 42)).toBe(false);
  expect(v26.extras.some((e) => e.partId === '39262' && e.qty === 4)).toBe(true);
});

test('pending 2026 version of 2000431-1 applies swaps, removals, quantity changes and additions', () => {
  const o = get('2000431-1/orig'),
    v = get('2000431-1/2026');
  expect(v.pending).toBe(true);
  expect(v.parts.some((p) => p.partId === '3666')).toBe(false);
  expect(v.parts.find((p) => p.partId === '2780')!.qty).toBe(100);
  expect(v.parts.find((p) => p.partId === '3706')!.qty).toBe(10);
  expect(v.parts.find((p) => p.partId === '32034' && p.colorId === 86)!.qty).toBe(100);
  expect(v.parts.some((p) => p.partId === '49743c01')).toBe(true);
  expect(v.parts.some((p) => p.partId === '57029c01')).toBe(false);
  expect(o.parts.some((p) => p.partId === '3666')).toBe(true);
});

test('nextQuestion: nothing to ask for fewer than 2 candidates or identical ones', () => {
  expect(nextQuestion([get('2000414-4/orig')])).toBeNull();
  const o = get('2000414-4/orig');
  expect(nextQuestion([o, { ...o, key: 'copy' }])).toBeNull();
});
test('nextQuestion: skipped questions are not asked again', () => {
  const vs = [get('2000414-4/orig'), get('2000414-4/Oct 17, 2026')];
  const q = nextQuestion(vs)!;
  expect(nextQuestion(vs, new Set([questionId(q), questionId({ ...q, aSet: q.bSet })]))).toBeNull();
});
test('identify scores quantity matches and mismatches, and missing parts', () => {
  const o = get('2000414-4/orig');
  const p = o.parts[0];
  const key = `${p.partId}:${p.colorId}`;
  const [exact] = identify([o], [{ key, qty: p.qty }]);
  const [wrong] = identify([o], [{ key, qty: p.qty + 1 }]);
  const [gone] = identify([o], [{ key: 'nope:0' }]);
  expect(exact.score).toBe(3);
  expect(wrong.qtyMismatch).toEqual([key]);
  expect(wrong.score).toBe(1.5);
  expect(gone.missing).toEqual(['nope:0']);
  expect(gone.score).toBe(-3);
});

test('distinguish: only-here parts and parts every other version has', () => {
  const o = get('2000414-4/orig'),
    b = get('2000414-4/Oct 17, 2026');
  const d = distinguish(b, [o]);
  expect(d.onlyHere.map((p) => p.partId)).toEqual(['3957b']);
  expect(d.lacks.map((p) => `${p.partId}:${p.colorId}`)).toEqual(['3957b:16']);
  expect(distinguish(b, [])).toEqual({ onlyHere: [], lacks: [] });
});
test('distinguish: falls back to "absent from some other" when nothing is unique', () => {
  const [a, b, c] = ['p', 'q', 'r'].map((id, i) => ({
    ...get('2000414-4/orig'),
    key: id,
    parts: [
      { ...get('2000414-4/orig').parts[0], partId: 'common' },
      ...(i === 0 ? [{ ...get('2000414-4/orig').parts[0], partId: 'x' }] : []),
      ...(i === 1 ? [{ ...get('2000414-4/orig').parts[0], partId: 'y' }] : []),
    ],
  }));
  // a has x (absent from b and c, so unique) -> primary path
  expect(distinguish(a, [b, c]).onlyHere.map((p) => p.partId)).toEqual(['x']);
  // c has nothing unique and lacks nothing every other has in common -> fallback path
  const d = distinguish(c, [a, b]);
  expect(d.onlyHere).toEqual([]);
  expect(d.lacks.map((p) => p.partId).sort()).toEqual(['x', 'y']);
});
test('changeFrom lists new and replaced parts', () => {
  const o = get('2000414-4/orig'),
    b = get('2000414-4/Oct 17, 2026');
  const d = changeFrom(b, o);
  expect(d.onlyHere.map((p) => p.colorId)).toEqual([15]);
  expect(d.lacks.map((p) => p.colorId)).toEqual([16]);
});

describe('branch edge cases', () => {
  const base = get('2000414-4/orig');
  const mk = (key: string, ids: string[]): ResolvedVersion => ({
    ...base,
    key,
    parts: ids.map((id) => ({ ...base.parts[0], partId: id })),
  });
  test('nextQuestion with three versions: lone-side question, no complement group, best-score tie-break', () => {
    const vs = [mk('a', ['c', 'x']), mk('b', ['c', 'y']), mk('d', ['c', 'y'])];
    const q = nextQuestion(vs)!;
    expect(q.aSet.length + q.bSet.length).toBe(3);
    const vs2 = [mk('a', ['c', 'x']), mk('b', ['c']), mk('d', ['c'])];
    const q2 = nextQuestion(vs2)!;
    expect(q2.aSet).toEqual(['a']);
    expect(q2.b).toEqual([]);
  });
  test('nextQuestion returns null when every signature is skipped', () => {
    const vs = [mk('a', ['c', 'x']), mk('b', ['c'])];
    expect(nextQuestion(vs, new Set(['a', 'b']))).toBeNull();
  });
  test('compare ignores items that only occur as extras', () => {
    const withExtra: ResolvedVersion = {
      ...base,
      extras: [{ ...base.parts[0], partId: 'only-extra', kind: 'extra' }],
    };
    expect(compare([withExtra]).all.map((r) => r.item.partId)).not.toContain('only-extra');
  });
});

describe('version resolution edge cases', () => {
  const set: SetInventory = {
    setNo: 's-1',
    name: 'S',
    items: [{ type: 'P', partId: 'p', colorId: 1, colorName: 'Red', name: 'P', qty: 2, kind: 'regular', matchId: 0 }],
  } as SetInventory;
  test('set without change log yields only the original', () => {
    expect(defaultDefs(set).map((d) => d.id)).toEqual(['orig']);
  });
  test('overrides replace derived versions', () => {
    const o = [{ id: 'x', name: 'X', alternates: [] }];
    expect(defaultDefs(set, { 's-1': o })).toBe(o);
  });
  test('undated alternates produce an "other" version', () => {
    const s = { ...set, items: [...set.items, { ...set.items[0], kind: 'alternate', matchId: 9 }] } as SetInventory;
    expect(defaultDefs(s).map((d) => d.id)).toEqual(['orig', 'other']);
  });
  test('missing swap source, removal and quantity targets throw', () => {
    const miss = { partId: 'zz', colorId: 1 };
    const d = { id: 'v', name: 'V', alternates: [] };
    expect(() => resolveVersion(set, { ...d, swaps: [{ from: miss, to: { ...miss, colorName: 'x' } }] })).toThrow(
      /swap source/,
    );
    expect(() => resolveVersion(set, { ...d, removes: [miss] })).toThrow(/not found/);
    expect(() => resolveVersion(set, { ...d, setQty: [{ ...miss, qty: 1 }] })).toThrow(/not found/);
  });
});
