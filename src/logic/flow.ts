import { itemKey, type ResolvedVersion, type SetInventory } from '../data/types';

/** Product number as printed on the box: BrickLink's "2000414-4" without the "-4" variant suffix. */
export const productNo = (setNo: string) => setNo.replace(/-\d+$/, '');

/** Product name without BrickLink's variant notes like "(214 Pieces Version)" or "{2013 Version}". */
export const productName = (name: string) => name.replace(/\s*[({][^)}]*[)}]\s*$/, '');

/** Distinct products (number, name) among sets that have an inventory, sorted by number. */
export function listProducts(
  sets: Pick<SetInventory, 'setNo' | 'name' | 'noInventory'>[],
): (readonly [string, string])[] {
  return [
    ...new Map(
      sets.filter((s) => !s.noInventory).map((s) => [productNo(s.setNo), productName(s.name)] as const),
    ).entries(),
  ].sort(([a], [b]) => a.localeCompare(b));
}

export interface IdentifyState {
  obs: { key: string; qty?: number }[];
  setFilter: string;
  answers: { qid: string; keep: string[] }[];
  skipped: Set<string>;
}

/** Versions still possible given the product filter, answered questions and entered parts. */
export function candidatesFor(versions: ResolvedVersion[], s: IdentifyState): ResolvedVersion[] {
  let c = versions.filter((v) => !s.setFilter || productNo(v.setNo) === s.setFilter);
  for (const a of s.answers) c = c.filter((v) => a.keep.includes(v.key));
  // Parts the user has entered rule out versions that do not contain them (unless that would rule out everything).
  const has = (v: ResolvedVersion, k: string) => v.parts.some((p) => itemKey(p) === k);
  const fit = c.filter((v) => s.obs.every((o) => has(v, o.key)));
  return fit.length ? fit : c;
}

/** Reset the guided questions; unless `keepParts`, also forget the looked-up parts and product filter (new box). */
export function resetIdentify(s: IdentifyState, keepParts = false): void {
  if (!keepParts) {
    s.obs = [];
    s.setFilter = '';
  }
  s.answers = [];
  s.skipped.clear();
}

/** Whether "Start over" is worth showing: looked-up parts alone do not count. */
export const hasProgress = (s: IdentifyState) => s.answers.length > 0 || s.skipped.size > 0;
