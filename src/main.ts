import { button, card, checkbox, collapsible, divider, esc, field, heading, link, listRow, listRowMeta, muted, mutedInline, notice, numberInput, page, paragraph, partRow, pending, qty, row, select, tabs, textInput } from './ui';
import { sets } from './data/sets.generated';
import { versionOverrides, extraVersions, mergeDates } from './data/versions';
import { imgUrl, itemKey, type Item, type ResolvedVersion } from './data/types';
import { resolveAll } from './logic/versions';
import { changeFrom, compare, distinguish, identify, itemIndex, nextQuestion, questionId, separate, type PartRow, type Question } from './logic/analysis';

const versions = resolveAll(sets, versionOverrides, extraVersions, mergeDates);
const index = itemIndex(versions);
const byKey = new Map(versions.map((v) => [v.key, v]));
const vLabel = (v: ResolvedVersion) => `${v.setNo} ${v.setName} · ${v.name}${v.pending ? ' (pending)' : ''}`;
const label = (i: Item) => `${i.partId} | ${i.colorName} | ${i.name}`;

const state = {
  tab: 'identify' as 'identify' | 'common' | 'separate',
  obs: [] as { key: string; qty?: number }[],
  setFilter: '',
  answers: [] as { qid: string; keep: string[] }[],
  skipped: new Set<string>(),
  workshop: JSON.parse(localStorage.getItem('lsp-workshop') ?? '{}') as Record<string, number>,
  checked: new Set<string>(JSON.parse(localStorage.getItem('lsp-checked') ?? '[]')),
};

const saveWorkshop = () => localStorage.setItem('lsp-workshop', JSON.stringify(state.workshop));
for (const k of Object.keys(state.workshop)) if (!byKey.has(k)) delete state.workshop[k];
const count = (v: ResolvedVersion) => state.workshop[v.key] ?? 0;
const inWorkshop = () => versions.filter((v) => count(v) > 0);
const itemOf = (k: string) => index.get(k)!;
const invLink = (setNo: string) => {
  const url = sets.find((s) => s.setNo === setNo)?.sourceUrl ?? `https://www.bricklink.com/catalogItemInv.asp?S=${setNo}`;
  return link(url, 'BrickLink inventory', { external: true });
};

const partHtml = (i: Item, trailing = '') => partRow(i, { img: imgUrl(i), trailing });

function candidates(): ResolvedVersion[] {
  let c = versions.filter((v) => !state.setFilter || v.setNo === state.setFilter);
  for (const a of state.answers) c = c.filter((v) => a.keep.includes(v.key));
  // Parts the user has entered rule out versions that do not contain them (unless that would rule out everything).
  const has = (v: ResolvedVersion, k: string) => v.parts.some((p) => itemKey(p) === k);
  const fit = c.filter((v) => state.obs.every((o) => has(v, o.key)));
  return fit.length ? fit : c;
}

let currentQ: Question | null = null;

function renderQuestion(q: Question): string {
  currentQ = q;
  const MAX = 3;
  // Any single element of a side is enough to decide, so show a few easy-to-spot ones:
  // common (high qty), plain (no printed pattern / assembly), and different shapes.
  const easy = (k: string) => itemOf(k).qty - (/pb|px|c\d|^x/.test(itemOf(k).partId) ? 100 : 0);
  const side = (keys: string[]) => {
    const seen = new Set<string>();
    const pick = [...keys].sort((x, y) => easy(y) - easy(x)).filter((k) => !seen.has(itemOf(k).partId) && seen.add(itemOf(k).partId)).slice(0, MAX);
    return muted(keys.length > 1 ? `Any one of these is enough${keys.length > pick.length ? ` (${keys.length} in total)` : ''}:` : '') + pick.map((k) => partHtml(itemOf(k))).join('');
  };
  const skip = button('Not sure / skip', { attrs: { 'data-ans': 'skip' } });
  if (q.b.length)
    return card(`<b>Which do you have?</b>` + row(
      button(`A${side(q.a)}`, { variant: 'choice', attrs: { 'data-ans': 'A' } }) + button(`B${side(q.b)}`, { variant: 'choice', attrs: { 'data-ans': 'B' } })) + skip);
  return card(`<b>Do you have this?</b>${side(q.a)}` + row(
    button('Yes', { attrs: { 'data-ans': 'A' } }) + button('No', { attrs: { 'data-ans': 'B' } }) + skip));
}

const brief = (items: Item[], max = 6) => {
  const top = [...items].sort((x, y) => y.qty - x.qty);
  return top.slice(0, max).map((i) => partHtml(i, qty(i.qty))).join('') + (items.length > max ? muted(`and ${items.length - max} more`) : '');
};

function candidateHtml(r: ReturnType<typeof identify>[number], cands: ResolvedVersion[]): string {
  const v = r.version;
  const others = cands.filter((c) => c !== v);
  const d = distinguish(v, others);
  const sameSet = versions.filter((x) => x.setNo === v.setNo);
  const prev = sameSet[sameSet.indexOf(v) - 1];
  const ch = prev ? changeFrom(v, prev) : null;
  const total = v.parts.reduce((a, p) => a + p.qty, 0);
  const sec = (t: string, items: Item[]) => (items.length ? `<div><b>${t}</b>${brief(items)}</div>` : '');
  const summary = `<b>${esc(vLabel(v))}</b> ${mutedInline(`${total} pieces${state.obs.length ? `, score ${r.score}` : ''}`)} ` +
    button(count(v) ? `In workshop (${count(v)}) +1` : 'Add to workshop', { noPrint: true, attrs: { 'data-add': v.key } });
  const body = muted(`${invLink(v.setNo)} for the full details of ${esc(v.setNo + ' ' + v.setName)}`) +
    (r.missing.length ? muted(`Not in this version: ${r.missing.map((k) => esc(itemOf(k).colorName + ' ' + itemOf(k).partId)).join(', ')}`) : '') +
    (r.qtyMismatch.length ? muted(`Different quantity: ${r.qtyMismatch.map((k) => esc(itemOf(k).partId)).join(', ')}`) : '') +
    (others.length ? sec(`Parts only in this version (${d.onlyHere.length})`, d.onlyHere) + sec(`Parts the other candidates have that this one doesn't (${d.lacks.length})`, d.lacks) : '') +
    (ch && (ch.onlyHere.length || ch.lacks.length) ? divider() + sec(`Changed since previous version (${prev.name}): now has (${ch.onlyHere.length})`, ch.onlyHere) + sec(`...instead of (${ch.lacks.length})`, ch.lacks) : '') +
    (v.extras.length ? sec(`Spares / extras (${v.extras.length})`, v.extras) : '');
  return collapsible(summary, body, { highlight: cands.length === 1 });
}

function renderIdentify(): string {
  const cands = candidates();

  const opts = [...index.values()].map((i) => `<option value="${esc(label(i))}"></option>`).join('');
  const ws = inWorkshop();
  let h = ws.length ? card(`<b>Workshop:</b> ${ws.map((v) => `${count(v)} &times; ${esc(v.setNo + ' ' + v.name)}`).join('; ')} ${mutedInline('(edit on the Common parts or Separate tab)')}`) : '';
  const setOptions = [{ value: '', label: 'Any', selected: false }, ...sets.filter((s) => !s.noInventory).map((s) => ({ value: s.setNo, label: s.setNo + ' - ' + s.name, selected: s.setNo === state.setFilter }))];
  h += heading(2, '1. Narrow down') + card(field('Set:', select(setOptions, { id: 'setFilter' })) + (state.setFilter ? invLink(state.setFilter) : ''), { row: true });
  h += heading(2, '2. Parts you know') + card(
    row(textInput({ id: 'partIn', list: 'parts', placeholder: 'Part no, name or colour', size: 40 }) + `<datalist id="parts">${opts}</datalist>` +
      numberInput({ id: 'qtyIn', min: 0, placeholder: 'qty (optional)' }, 'md') + button('Add', { attrs: { id: 'addObs' } })) +
    state.obs.map((o, n) => partHtml(itemOf(o.key), qty(o.qty ?? '') + button('x', { attrs: { 'data-rm': n } }))).join(''));

  const q = nextQuestion(cands, state.skipped);
  h += heading(2, "3. Don't know the parts? Answer questions");
  if (state.answers.length || state.skipped.size) h += row(button('Reset answers', { attrs: { id: 'resetAns' } }), { noPrint: true });
  if (cands.length > 1 && q) h += renderQuestion(q);
  else {
    currentQ = null;
    if (cands.length > 1) h += notice('No more questions available.');
  }

  const noFit = state.obs.length > 0 && !cands.every((v) => state.obs.every((o) => v.parts.some((p) => itemKey(p) === o.key)));
  if (noFit) h += notice('No version contains all the parts you entered, so the closest matches are shown.');
  h += heading(2, `Result (${cands.length} candidate${cands.length === 1 ? '' : 's'})`);
  h += identify(cands, state.obs).map((r) => candidateHtml(r, cands)).join('');
  return h;
}

function versionPicker(): string {
  const picker = collapsible('<b>Add or remove sets</b>', sets.filter((s) => !s.noInventory).map((s) => `<b>${s.setNo} ${esc(s.name)}</b> ${invLink(s.setNo)}` +
    versions.filter((v) => v.setNo === s.setNo).map((v) => `<label>${checkbox({ 'data-sel': v.key, checked: !!count(v) })} ${esc(v.name)}${v.pending ? ' ' + pending('(pending)') : ''}</label>`).join('')).join(divider()), { list: true });
  const list = inWorkshop();
  return card('<b>Workshop sets</b>' + (list.length
    ? list.map((v) => listRow(numberInput({ min: 1, value: count(v), 'data-cnt': v.key }, 'sm') + ' &times; ' + listRowMeta(esc(vLabel(v))) + button('Remove', { attrs: { 'data-rmws': v.key } }))).join('')
    : muted('No sets yet. Add sets below, or identify a set on the Identify tab and use "Add to workshop".'))) + picker;
}

const qtyCells = (vs: ResolvedVersion[], r: PartRow) => vs.map((v) => qty(r.qty[v.key] ?? '-', { title: vLabel(v) })).join('');
const legend = (vs: ResolvedVersion[]) => muted(`Quantity columns: ${vs.map((v, n) => `${n + 1} = ${esc(vLabel(v))}`).join(' | ')}`);

function renderCommon(): string {
  const h = heading(2, 'Workshop sets') + versionPicker();
  const vs = inWorkshop();
  if (vs.length < 2) return h + paragraph('Add at least two different versions to compare.', { muted: true });
  const c = compare(vs);
  const sec = (t: string, rows: PartRow[]) => heading(2, `${t} (${rows.length})`) + legend(vs) + muted('Quantities are per box.') +
    card(rows.map((r) => partHtml(r.item, qtyCells(vs, r))).join('') || mutedInline('none'));
  return h + sec('In all selected versions', c.all) + sec('In some versions', c.some) + sec('Only in one version', c.unique);
}

function renderSeparate(): string {
  let h = heading(2, 'Workshop sets') + versionPicker();
  const vs = inWorkshop();
  if (vs.length < 2) return h + paragraph('Add at least two different versions to get a sorting guide.', { muted: true });
  const p = separate(vs);
  const total = (r: PartRow, v: ResolvedVersion) => (r.qty[v.key] ?? 0) * count(v);
  const totalCells = (r: PartRow) => vs.map((v) => qty(r.qty[v.key] ? total(r, v) : '-', { title: vLabel(v) })).join('');
  const chk = (id: string, i: Item, trailing: string) => partRow(i, { img: imgUrl(i), trailing, check: { checked: state.checked.has(id), attrs: { 'data-chk': id } } });
  const setTitle = (v: ResolvedVersion) => heading(3, `${count(v)} &times; ${esc(vLabel(v))}`);
  h += row(button('Clear checkmarks', { attrs: { id: 'clearChk' } }) + button('Print', { attrs: { id: 'print' } }), { noPrint: true });
  h += paragraph('Quantities are totals for the whole workshop (per-box quantity &times; number of boxes).', { muted: true });
  h += heading(2, 'Step 1: sort parts that belong to only one version');
  for (const v of vs)
    h += setTitle(v) + card(p.piles[v.key].map((r) => chk(`${v.key}|${r.key}`, r.item, qty(total(r, v)) + mutedInline(`(${r.qty[v.key]} per box)`))).join('') || mutedInline('No unique parts'));
  h += heading(2, 'Step 2: shared parts - count into piles') + legend(vs) + card(p.shared.map((r) => chk(`shared|${r.key}`, r.item, totalCells(r))).join(''));
  const ex = vs.filter((v) => v.extras.length);
  if (ex.length) h += heading(2, 'Optional spares (extras)') + ex.map((v) => setTitle(v) + card(v.extras.map((i) => partHtml(i, qty(i.qty * count(v)))).join(''))).join('');
  return h;
}

const TABS = { identify: 'Identify', common: 'Common parts', separate: 'Separate after workshop' } as const;

function render() {
  const body = state.tab === 'identify' ? renderIdentify() : state.tab === 'common' ? renderCommon() : renderSeparate();
  const noInv = sets.filter((s) => s.noInventory);
  document.getElementById('app')!.innerHTML = page(heading(1, 'LEGO Serious Play set identifier') + tabs(TABS, state.tab) + body +
    (noInv.length ? paragraph(`Known sets without a BrickLink inventory (cannot be identified): ${noInv.map((s) => link(s.sourceUrl, esc(s.setNo + ' ' + s.name))).join('; ')}`, { muted: true }) : '') +
    paragraph('Data from BrickLink inventories. Images hotlinked from BrickLink.', { muted: true }));
}

document.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
  if (!t) return;
  const d = t.dataset;
  if (d.add) { e.preventDefault(); state.workshop[d.add] = (state.workshop[d.add] ?? 0) + 1; saveWorkshop(); }
  else if (d.rmws) { delete state.workshop[d.rmws]; saveWorkshop(); }
  else if (d.tab) state.tab = d.tab as typeof state.tab;
  else if (t.id === 'addObs') {
    const v = (document.getElementById('partIn') as HTMLInputElement).value.trim();
    const qty = (document.getElementById('qtyIn') as HTMLInputElement).value;
    const hit = [...index.entries()].find(([, i]) => label(i) === v);
    if (!hit) return alert('Pick a part from the suggestion list.');
    state.obs.push({ key: hit[0], qty: qty === '' ? undefined : Number(qty) });
  } else if (d.rm) state.obs.splice(Number(d.rm), 1);
  else if (d.ans && currentQ) {
    const qid = questionId(currentQ);
    if (d.ans === 'skip') state.skipped.add(qid);
    else state.answers.push({ qid, keep: d.ans === 'A' ? currentQ.aSet : currentQ.bSet });
  } else if (t.id === 'resetAns') { state.answers = []; state.skipped.clear(); }
  else if (t.id === 'clearChk') { state.checked.clear(); localStorage.removeItem('lsp-checked'); }
  else if (t.id === 'print') return window.print();
  else return;
  render();
});

document.addEventListener('change', (e) => {
  const el = e.target as HTMLInputElement;
  if (el.id === 'setFilter') { state.setFilter = el.value; state.answers = []; state.skipped.clear(); }
  else if (el.dataset.sel) { if (el.checked) state.workshop[el.dataset.sel] = state.workshop[el.dataset.sel] || 1; else delete state.workshop[el.dataset.sel]; saveWorkshop(); }
  else if (el.dataset.cnt) { const n = Math.floor(Number(el.value)); if (n >= 1) state.workshop[el.dataset.cnt] = n; else delete state.workshop[el.dataset.cnt]; saveWorkshop(); }
  else if (el.dataset.chk) { if (el.checked) state.checked.add(el.dataset.chk); else state.checked.delete(el.dataset.chk); localStorage.setItem('lsp-checked', JSON.stringify([...state.checked])); }
  else return;
  render();
});

render();
