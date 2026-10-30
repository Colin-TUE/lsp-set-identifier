import { itemKey, type Item, type ResolvedVersion } from '../data/types';

const qtyMap = (v: ResolvedVersion) => {
  const m = new Map<string, number>();
  for (const p of v.parts) m.set(itemKey(p), (m.get(itemKey(p)) ?? 0) + p.qty);
  return m;
};

export function itemIndex(vs: ResolvedVersion[]): Map<string, Item> {
  const m = new Map<string, Item>();
  for (const v of vs) for (const p of [...v.parts, ...v.extras]) if (!m.has(itemKey(p))) m.set(itemKey(p), p);
  return m;
}

// ---------- identify ----------
export interface Observation { key: string; qty?: number }
export interface Ranked { version: ResolvedVersion; score: number; matched: string[]; missing: string[]; qtyMismatch: string[] }

export function identify(vs: ResolvedVersion[], obs: Observation[]): Ranked[] {
  return vs.map((version) => {
    const q = qtyMap(version);
    const r: Ranked = { version, score: 0, matched: [], missing: [], qtyMismatch: [] };
    for (const o of obs) {
      const have = q.get(o.key);
      if (have === undefined) { r.score -= 3; r.missing.push(o.key); continue; }
      r.score += 2; r.matched.push(o.key);
      if (o.qty !== undefined) {
        if (o.qty === have) r.score += 1; else { r.score -= 0.5; r.qtyMismatch.push(o.key); }
      }
    }
    return r;
  }).sort((a, b) => b.score - a.score);
}

// ---------- guided questions ----------
export interface Question {
  a: string[]; // part keys present only in versions `aSet`
  aSet: string[]; // version keys
  b: string[]; // part keys present only in complement (may be empty -> yes/no)
  bSet: string[];
}

/** Next best question to split the candidates, or null if indistinguishable. */
export function nextQuestion(candidates: ResolvedVersion[], skipped: Set<string> = new Set()): Question | null {
  if (candidates.length < 2) return null;
  const all = candidates.map((c) => c.key);
  const groups = new Map<string, string[]>(); // signature -> part keys
  const keys = new Set(candidates.flatMap((c) => c.parts.map(itemKey)));
  for (const k of keys) {
    const sig = candidates.filter((c) => c.parts.some((p) => itemKey(p) === k)).map((c) => c.key);
    if (sig.length === 0 || sig.length === candidates.length) continue;
    const s = sig.join('|');
    groups.set(s, [...(groups.get(s) ?? []), k]);
  }
  let best: { sig: string; score: number } | null = null;
  for (const sig of groups.keys()) {
    if (skipped.has(sig)) continue;
    const n = sig.split('|').length;
    const comp = all.filter((x) => !sig.split('|').includes(x)).join('|');
    const balance = Math.min(n, all.length - n) / all.length;
    const score = balance + (groups.has(comp) ? 0.25 : 0);
    if (!best || score > best.score) best = { sig, score };
  }
  if (!best) return null;
  const aSet = best.sig.split('|');
  const bSet = all.filter((x) => !aSet.includes(x));
  return { a: groups.get(best.sig)!, aSet, b: groups.get(bSet.join('|')) ?? [], bSet };
}

export const questionId = (q: Question) => q.aSet.join('|');

// ---------- common ----------
export interface PartRow { key: string; item: Item; qty: Record<string, number> }
export interface CommonResult { all: PartRow[]; some: PartRow[]; unique: PartRow[] }

export function compare(vs: ResolvedVersion[]): CommonResult {
  const idx = itemIndex(vs);
  const maps = vs.map((v) => [v.key, qtyMap(v)] as const);
  const rows: PartRow[] = [];
  for (const [key, item] of idx) {
    const qty: Record<string, number> = {};
    for (const [vk, m] of maps) if (m.has(key)) qty[vk] = m.get(key)!;
    if (Object.keys(qty).length) rows.push({ key, item, qty });
  }
  const n = vs.length;
  const cnt = (r: PartRow) => Object.keys(r.qty).length;
  const sort = (a: PartRow, b: PartRow) => a.item.colorName.localeCompare(b.item.colorName) || a.item.partId.localeCompare(b.item.partId, undefined, { numeric: true });
  return {
    all: rows.filter((r) => cnt(r) === n).sort(sort),
    some: rows.filter((r) => cnt(r) > 1 && cnt(r) < n).sort(sort),
    unique: rows.filter((r) => cnt(r) === 1).sort(sort),
  };
}

// ---------- separation ----------
export interface SeparationPlan {
  piles: Record<string, PartRow[]>; // version key -> parts unique to it
  shared: (PartRow & { sameQty: boolean })[]; // parts in >1 selected version
}

export function separate(vs: ResolvedVersion[]): SeparationPlan {
  const c = compare(vs);
  const piles: Record<string, PartRow[]> = Object.fromEntries(vs.map((v) => [v.key, []]));
  for (const r of c.unique) piles[Object.keys(r.qty)[0]].push(r);
  const shared = [...c.all, ...c.some].map((r) => ({ ...r, sameQty: new Set(Object.values(r.qty)).size === 1 }));
  return { piles, shared };
}
