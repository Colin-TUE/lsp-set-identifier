import { describe, expect, test } from 'vitest';
import { sets } from '../src/data/sets.generated';
import { extraVersions, mergeDates, versionOverrides } from '../src/data/versions';
import type { Item, ResolvedVersion } from '../src/data/types';
import { resolveAll } from '../src/logic/versions';
import {
  candidatesFor,
  hasProgress,
  listProducts,
  productName,
  productNo,
  resetIdentify,
  type IdentifyState,
} from '../src/logic/flow';

const item = (partId: string): Item => ({
  type: 'P',
  partId,
  colorId: 1,
  colorName: 'Red',
  name: partId,
  qty: 1,
  kind: 'regular',
  matchId: 0,
});
const ver = (setNo: string, id: string, parts: string[]): ResolvedVersion => ({
  key: `${setNo}/${id}`,
  setNo,
  setName: setNo,
  id,
  name: id,
  pending: false,
  parts: parts.map(item),
  extras: [],
});
const st = (o: Partial<IdentifyState> = {}): IdentifyState => ({
  obs: [],
  setFilter: '',
  answers: [],
  skipped: new Set(),
  ...o,
});

describe('product number and name', () => {
  test('productNo strips only the trailing variant suffix', () => {
    expect(productNo('2000414-4')).toBe('2000414');
    expect(productNo('2000414')).toBe('2000414');
    expect(productNo('20-004-14-2')).toBe('20-004-14');
  });
  test('productName strips trailing variant notes only', () => {
    expect(productName('Foo (214 Pieces Version)')).toBe('Foo');
    expect(productName('Foo {2013 Version}')).toBe('Foo');
    expect(productName('Foo')).toBe('Foo');
    expect(productName('Foo (a) Bar')).toBe('Foo (a) Bar');
  });
  test('listProducts dedupes variants, skips sets without inventory and sorts', () => {
    const r = listProducts([
      { setNo: '2-2', name: 'B (x)', noInventory: false },
      { setNo: '1-1', name: 'A {y}', noInventory: false },
      { setNo: '1-2', name: 'A (z)', noInventory: false },
      { setNo: '3-1', name: 'C', noInventory: true },
    ]);
    expect(r).toEqual([
      ['1', 'A'],
      ['2', 'B'],
    ]);
  });
  test('real data: one entry per product number, none without inventory', () => {
    const r = listProducts(sets);
    expect(new Set(r.map(([n]) => n)).size).toBe(r.length);
    for (const s of sets.filter((x) => x.noInventory)) expect(r.map(([n]) => n)).not.toContain(productNo(s.setNo));
  });
});

describe('candidatesFor', () => {
  const a1 = ver('1-1', 'o', ['x', 'y']);
  const a2 = ver('1-2', 'o', ['x', 'z']);
  const b1 = ver('2-1', 'o', ['x']);
  const all = [a1, a2, b1];
  test('no filter keeps everything', () => expect(candidatesFor(all, st())).toEqual(all));
  test('product filter matches every variant of the product number', () => {
    expect(candidatesFor(all, st({ setFilter: '1' }))).toEqual([a1, a2]);
  });
  test('product filter is not a prefix match', () => {
    expect(candidatesFor([ver('11-1', 'o', ['x'])], st({ setFilter: '1' }))).toEqual([]);
  });
  test('answers narrow candidates', () => {
    expect(candidatesFor(all, st({ answers: [{ qid: 'q', keep: [a1.key, b1.key] }] }))).toEqual([a1, b1]);
  });
  test('observed parts rule out versions lacking them', () => {
    expect(candidatesFor(all, st({ obs: [{ key: 'y:1' }] }))).toEqual([a1]);
    expect(candidatesFor(all, st({ obs: [{ key: 'x:1' }, { key: 'z:1' }] }))).toEqual([a2]);
  });
  test('observed parts are ignored when they would rule out everything', () => {
    expect(candidatesFor(all, st({ obs: [{ key: 'nope:1' }] }))).toEqual(all);
  });
});

describe('resetIdentify / hasProgress', () => {
  const dirty = () =>
    st({
      obs: [{ key: 'x:1' }],
      setFilter: '1',
      answers: [{ qid: 'q', keep: [] }],
      skipped: new Set(['s']),
    });
  test('Start over keeps parts and product filter', () => {
    const s = dirty();
    resetIdentify(s, true);
    expect(s.obs).toHaveLength(1);
    expect(s.setFilter).toBe('1');
    expect(s.answers).toEqual([]);
    expect(s.skipped.size).toBe(0);
  });
  test('Next box clears parts and product filter too', () => {
    const s = dirty();
    resetIdentify(s);
    expect(s.obs).toEqual([]);
    expect(s.setFilter).toBe('');
    expect(s.answers).toEqual([]);
    expect(s.skipped.size).toBe(0);
  });
  test('hasProgress counts answers and skips, not parts', () => {
    expect(hasProgress(st({ obs: [{ key: 'x:1' }] }))).toBe(false);
    expect(hasProgress(st({ answers: [{ qid: 'q', keep: [] }] }))).toBe(true);
    expect(hasProgress(st({ skipped: new Set(['s']) }))).toBe(true);
  });
});

describe('pending versions', () => {
  const resolved = resolveAll(sets, versionOverrides, extraVersions, mergeDates);
  test('pending extra versions have short names and explain origin in the note', () => {
    const defs = Object.values(extraVersions)
      .flat()
      .filter((d) => d.pending);
    expect(defs.length).toBeGreaterThan(0);
    for (const d of defs) {
      expect(d.name).not.toMatch(/pending|change request/i);
      expect(d.note).toMatch(/pending BrickLink approval/);
    }
    expect(resolved.filter((v) => v.pending).length).toBe(defs.length);
  });
});
