import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { sets } from '../src/data/sets.generated';
import { extraVersions, mergeDates, versionOverrides } from '../src/data/versions';
import { defaultDefs, effectiveChanges, mergeChanges, resolveAll } from '../src/logic/versions';
import { itemKey } from '../src/data/types';

const withInv = sets.filter((s) => !s.noInventory);
const resolved = resolveAll(sets, versionOverrides, extraVersions, mergeDates);

test('every set listed in sets.txt is in the generated data', () => {
  const lines = readFileSync('scripts/sets.txt', 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  const wanted = lines.map((l) => (l.startsWith('!') ? l.slice(1).split(/\s+/)[0] : new URL(l).searchParams.get('S')!));
  expect(sets.map((s) => s.setNo).sort()).toEqual(wanted.sort());
});

test('every set with an inventory has regular items and at least one version', () => {
  for (const s of withInv) {
    expect(
      s.items.some((i) => i.kind === 'regular'),
      s.setNo,
    ).toBe(true);
    expect(
      resolved.some((v) => v.setNo === s.setNo),
      s.setNo,
    ).toBe(true);
  }
});

test('version keys are unique', () => {
  const keys = resolved.map((v) => v.key);
  expect(new Set(keys).size).toBe(keys.length);
});

test('every alternate Match ID on a page belongs to some version', () => {
  for (const s of withInv) {
    const used = new Set(defaultDefs(s, versionOverrides, extraVersions, mergeDates).flatMap((d) => d.alternates));
    for (const m of new Set(s.items.filter((i) => i.kind === 'alternate').map((i) => i.matchId)))
      expect(used.has(m), `${s.setNo} match ID ${m}`).toBe(true);
  }
});

test('mergeDates only reference dates that exist as versions', () => {
  for (const [setNo, groups] of Object.entries(mergeDates)) {
    const s = sets.find((x) => x.setNo === setNo);
    expect(s, `mergeDates set ${setNo}`).toBeDefined();
    const dates = new Set(effectiveChanges(s!).map((c) => c.date));
    for (const g of groups) for (const d of g) expect(dates.has(d), `${setNo}: ${d}`).toBe(true);
  }
});

test('mergeDates merge at least two dates and none are left unmerged', () => {
  for (const [setNo, groups] of Object.entries(mergeDates)) {
    const s = sets.find((x) => x.setNo === setNo)!;
    for (const g of groups) expect(g.length, `${setNo} group`).toBeGreaterThan(1);
    expect(mergeChanges(effectiveChanges(s), groups).length).toBeLessThan(effectiveChanges(s).length);
  }
});

test('overrides and extra versions reference known sets', () => {
  for (const setNo of [...Object.keys(versionOverrides), ...Object.keys(extraVersions)])
    expect(
      withInv.some((s) => s.setNo === setNo),
      setNo,
    ).toBe(true);
});

test('no two versions of a set have identical contents', () => {
  for (const s of withInv) {
    const sig = resolved
      .filter((v) => v.setNo === s.setNo)
      .map((v) => [
        v.id,
        v.parts
          .map((p) => `${itemKey(p)}x${p.qty}`)
          .sort()
          .join(','),
      ]);
    const seen = new Map<string, string>();
    for (const [id, c] of sig) {
      // The synthetic "all alternates" fallback may equal another version, so only flag real duplicates.
      expect(seen.get(c), `${s.setNo}: ${id} duplicates ${seen.get(c)}`).toBeUndefined();
      seen.set(c, id);
    }
  }
});

test('pending versions differ from the version they build on', () => {
  for (const v of resolved.filter((x) => x.pending)) {
    const others = resolved.filter((x) => x.setNo === v.setNo && x !== v);
    const sig = (r: typeof v) =>
      r.parts
        .map((p) => `${itemKey(p)}x${p.qty}`)
        .sort()
        .join(',');
    expect(
      others.some((o) => sig(o) === sig(v)),
      `${v.key} equals another version`,
    ).toBe(false);
  }
});
