import type { Item, ResolvedVersion, SetInventory, VersionDef } from '../data/types';

/**
 * Change-log dates reduced to the dates that actually introduce an alternate:
 * each Match ID counts at its first mention only (later mentions are edits), and only if it is
 * still an alternate on the inventory page (IDs that were later removed are ignored).
 */
export function effectiveChanges(set: SetInventory): { date: string; matchIds: number[] }[] {
  const live = new Set(set.items.filter((i) => i.kind === 'alternate').map((i) => i.matchId));
  const seen = new Set<number>();
  const out: { date: string; matchIds: number[] }[] = [];
  for (const g of set.changes ?? []) {
    const ids = g.matchIds.filter((m) => live.has(m) && !seen.has(m));
    ids.forEach((m) => seen.add(m));
    if (ids.length) out.push({ date: g.date, matchIds: ids });
  }
  return out;
}

/** Collapse change groups whose dates are listed together in a merge group into one group. */
export function mergeChanges(
  changes: { date: string; matchIds: number[] }[],
  groups: string[][],
): { date: string; matchIds: number[] }[] {
  const out: { date: string; matchIds: number[] }[] = [];
  const done = new Set<string>();
  for (const c of changes) {
    if (done.has(c.date)) continue;
    const grp = groups.find((g) => g.includes(c.date));
    if (!grp) { out.push(c); continue; }
    const members = changes.filter((x) => grp.includes(x.date));
    members.forEach((m) => done.add(m.date));
    out.push({ date: members.map((m) => m.date).join(' + '), matchIds: [...new Set(members.flatMap((m) => m.matchIds))].sort((a, b) => a - b) });
  }
  return out;
}

/** Derive versions: original, then one cumulative version per change-log date. */
export function defaultDefs(
  set: SetInventory,
  overrides: Record<string, VersionDef[]> = {},
  extra: Record<string, VersionDef[]> = {},
  merge: Record<string, string[][]> = {},
): VersionDef[] {
  if (overrides[set.setNo]) return overrides[set.setNo];
  const defs: VersionDef[] = [{ id: 'orig', name: 'Original', alternates: [] }];
  const acc = new Set<number>();
  for (const g of mergeChanges(effectiveChanges(set), merge[set.setNo] ?? [])) {
    g.matchIds.forEach((m) => acc.add(m));
    defs.push({ id: g.date, name: `Update ${g.date}`, alternates: [...acc] });
  }
  const all = [...new Set(set.items.filter((i) => i.kind === 'alternate').map((i) => i.matchId))];
  const missing = all.filter((m) => !acc.has(m));
  if (missing.length) defs.push({ id: 'other', name: 'With undated alternates', alternates: [...acc, ...missing] });
  return [...defs, ...(extra[set.setNo] ?? [])];
}

export function resolveVersion(set: SetInventory, def: VersionDef): ResolvedVersion {
  const active = new Set(def.alternates);
  const swapped = set.items.filter((i) => i.kind === 'alternate' && active.has(i.matchId));
  const swappedIds = new Set(swapped.map((i) => i.matchId));
  const parts: Item[] = set.items
    .filter((i) => i.kind === 'regular' && !(i.matchId > 0 && swappedIds.has(i.matchId)))
    .concat(swapped.map((i) => ({ ...i, kind: 'regular' as const })));
  return {
    key: `${set.setNo}/${def.id}`, setNo: set.setNo, setName: set.name, id: def.id, name: def.name,
    pending: !!def.pending, parts, extras: set.items.filter((i) => i.kind === 'extra'),
  };
}

export function resolveAll(
  sets: SetInventory[], overrides: Record<string, VersionDef[]>, extra: Record<string, VersionDef[]>,
  merge: Record<string, string[][]> = {},
): ResolvedVersion[] {
  return sets.filter((s) => !s.noInventory).flatMap((s) => defaultDefs(s, overrides, extra, merge).map((d) => resolveVersion(s, d)));
}
