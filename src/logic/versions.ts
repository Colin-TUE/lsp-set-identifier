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
  let parts: Item[] = set.items
    .filter((i) => i.kind === 'regular' && !(i.matchId > 0 && swappedIds.has(i.matchId)))
    .concat(swapped.map((i) => ({ ...i, kind: 'regular' as const })));
  for (const sw of def.swaps ?? []) {
    const hit = parts.find((p) => p.partId === sw.from.partId && p.colorId === sw.from.colorId);
    if (!hit) throw new Error(`${set.setNo}/${def.id}: swap source ${sw.from.partId}:${sw.from.colorId} not found`);
    parts = parts.map((p) => (p === hit ? { ...p, type: sw.to.type ?? p.type, partId: sw.to.partId, colorId: sw.to.colorId, colorName: sw.to.colorName, name: sw.to.name ?? p.name } : p));
  }
  const find = (partId: string, colorId: number) => {
    const hit = parts.find((p) => p.partId === partId && p.colorId === colorId);
    if (!hit) throw new Error(`${set.setNo}/${def.id}: part ${partId}:${colorId} not found`);
    return hit;
  };
  for (const r of def.removes ?? []) { const hit = find(r.partId, r.colorId); parts = parts.filter((p) => p !== hit); }
  for (const q of def.setQty ?? []) { const hit = find(q.partId, q.colorId); parts = parts.map((p) => (p === hit ? { ...p, qty: q.qty } : p)); }
  parts = parts.concat((def.addParts ?? []).map((a) => ({ ...a, kind: 'regular' as const, matchId: 0 })));
  const extras: Item[] = set.items.filter((i) => i.kind === 'extra')
    .concat((def.addExtras ?? []).map((e) => ({ ...e, type: 'P', kind: 'extra' as const, matchId: 0 })));
  return {
    key: `${set.setNo}/${def.id}`, setNo: set.setNo, setName: set.name, id: def.id, name: def.name,
    pending: !!def.pending, parts, extras,
  };
}

export function resolveAll(
  sets: SetInventory[], overrides: Record<string, VersionDef[]>, extra: Record<string, VersionDef[]>,
  merge: Record<string, string[][]> = {},
): ResolvedVersion[] {
  return sets.filter((s) => !s.noInventory).flatMap((s) => defaultDefs(s, overrides, extra, merge).map((d) => resolveVersion(s, d)));
}
