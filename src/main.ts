import './style.css';
import { sets } from './data/sets.generated';
import { versionOverrides, extraVersions, mergeDates } from './data/versions';
import { imgUrl, type Item, type ResolvedVersion } from './data/types';
import { resolveAll } from './logic/versions';
import { compare, identify, itemIndex, nextQuestion, questionId, separate, type PartRow, type Question } from './logic/analysis';

const versions = resolveAll(sets, versionOverrides, extraVersions, mergeDates);
const index = itemIndex(versions);
const byKey = new Map(versions.map((v) => [v.key, v]));
const vLabel = (v: ResolvedVersion) => `${v.setNo} · ${v.name}${v.pending ? ' (pending)' : ''}`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const label = (i: Item) => `${i.partId} | ${i.colorName} | ${i.name}`;

const state = {
  tab: 'identify' as 'identify' | 'common' | 'separate',
  obs: [] as { key: string; qty?: number }[],
  setFilter: '',
  answers: [] as { qid: string; keep: string[] }[],
  skipped: new Set<string>(),
  selCommon: new Set<string>(),
  selSep: new Set<string>(),
  checked: new Set<string>(JSON.parse(localStorage.getItem('lsp-checked') ?? '[]')),
};

const itemOf = (k: string) => index.get(k)!;

function partHtml(i: Item, extra = ''): string {
  return `<div class="part"><img src="${imgUrl(i)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
    <div class="meta"><b>${esc(i.colorName)}</b> ${esc(i.name)}<br><span class="muted">${esc(i.partId)}</span></div>${extra}</div>`;
}

function candidates(): ResolvedVersion[] {
  let c = versions.filter((v) => !state.setFilter || v.setNo === state.setFilter);
  for (const a of state.answers) c = c.filter((v) => a.keep.includes(v.key));
  return c;
}

let currentQ: Question | null = null;

function renderQuestion(q: Question): string {
  currentQ = q;
  const side = (keys: string[]) =>
    keys.slice(0, 6).map((k) => partHtml(itemOf(k))).join('') + (keys.length > 6 ? `<div class="muted">+${keys.length - 6} more</div>` : '');
  if (q.b.length)
    return `<div class="card"><b>Which do you have?</b><div class="row">
      <button class="choice" data-ans="A">A${side(q.a)}</button><button class="choice" data-ans="B">B${side(q.b)}</button></div>
      <button data-ans="skip">Not sure / skip</button></div>`;
  return `<div class="card"><b>Do you have this?</b>${side(q.a)}<div class="row">
    <button data-ans="A">Yes</button><button data-ans="B">No</button><button data-ans="skip">Not sure / skip</button></div></div>`;
}

function renderIdentify(): string {
  const cands = candidates();
  
  const opts = [...index.values()].map((i) => `<option value="${esc(label(i))}"></option>`).join('');
  let h = `<h2>1. Narrow down</h2><div class="card row">
    <label>Set: <select id="setFilter"><option value="">Any</option>${sets.filter((s) => !s.noInventory).map((s) => `<option value="${s.setNo}" ${s.setNo === state.setFilter ? 'selected' : ''}>${esc(s.setNo + ' - ' + s.name)}</option>`).join('')}</select></label></div>
    <h2>2. Parts you know</h2><div class="card">
    <div class="row"><input type="text" id="partIn" list="parts" placeholder="Part no, name or colour" size="40"><datalist id="parts">${opts}</datalist>
    <input type="number" id="qtyIn" min="0" placeholder="qty (optional)" style="width:7rem"><button id="addObs">Add</button></div>
    ${state.obs.map((o, n) => partHtml(itemOf(o.key), `<span class="qty">${o.qty ?? ''}</span><button data-rm="${n}">x</button>`)).join('')}</div>`;

  const q = nextQuestion(cands, state.skipped);
  h += `<h2>3. Don't know the parts? Answer questions</h2>`;
  if (state.answers.length || state.skipped.size) h += `<div class="row noprint"><button id="resetAns">Reset answers</button></div>`;
  if (cands.length > 1 && q) h += renderQuestion(q);
  else {
    currentQ = null;
    if (cands.length > 1) h += `<div class="card muted">No more questions available.</div>`;
  }

  h += `<h2>Result (${cands.length} candidate${cands.length === 1 ? '' : 's'})</h2>`;
  h += identify(cands, state.obs).map((r) => `<div class="card ${cands.length === 1 ? 'best' : ''}"><b>${esc(vLabel(r.version))}</b>
    ${state.obs.length ? `<span class="score"> score ${r.score}</span>` : ''}
    ${r.missing.length ? `<div class="muted">Not in this version: ${r.missing.map((k) => esc(itemOf(k).colorName + ' ' + itemOf(k).partId)).join(', ')}</div>` : ''}
    ${r.qtyMismatch.length ? `<div class="muted">Different quantity: ${r.qtyMismatch.map((k) => esc(itemOf(k).partId)).join(', ')}</div>` : ''}</div>`).join('');
  return h;
}

function versionPicker(sel: Set<string>, name: string): string {
  return `<div class="card chips">${sets.filter((s) => !s.noInventory).map((s) => `<b>${s.setNo}</b> <span class="muted">${esc(s.name)}</span>` +
    versions.filter((v) => v.setNo === s.setNo).map((v) => `<label><input type="checkbox" data-sel="${name}" value="${v.key}" ${sel.has(v.key) ? 'checked' : ''}> ${esc(v.name)}${v.pending ? ' <span class="pending">(pending)</span>' : ''}</label>`).join('')).join('<hr>')}</div>`;
}

const qtyCells = (vs: ResolvedVersion[], r: PartRow) =>
  vs.map((v) => `<span class="qty" title="${esc(vLabel(v))}" style="min-width:2.5rem">${r.qty[v.key] ?? '-'}</span>`).join('');
const legend = (vs: ResolvedVersion[]) => `<div class="muted">Quantity columns: ${vs.map((v, n) => `${n + 1} = ${esc(vLabel(v))}`).join(' | ')}</div>`;

function renderCommon(): string {
  const h = `<h2>Select versions to compare</h2>` + versionPicker(state.selCommon, 'common');
  const vs = [...state.selCommon].map((k) => byKey.get(k)!);
  if (vs.length < 2) return h + `<p class="muted">Select at least two versions.</p>`;
  const c = compare(vs);
  const sec = (t: string, rows: PartRow[]) => `<h2>${t} (${rows.length})</h2>${legend(vs)}<div class="card">${rows.map((r) => partHtml(r.item, qtyCells(vs, r))).join('') || '<span class="muted">none</span>'}</div>`;
  return h + sec('In all selected versions', c.all) + sec('In some versions', c.some) + sec('Only in one version', c.unique);
}

function renderSeparate(): string {
  let h = `<h2>Which versions were mixed?</h2>` + versionPicker(state.selSep, 'sep');
  const vs = [...state.selSep].map((k) => byKey.get(k)!);
  if (vs.length < 2) return h + `<p class="muted">Select at least two versions.</p>`;
  const p = separate(vs);
  const chk = (id: string, i: Item, qtyHtml: string) => `<label class="part ${state.checked.has(id) ? 'done' : ''}"><input type="checkbox" data-chk="${esc(id)}" ${state.checked.has(id) ? 'checked' : ''}>
    <img src="${imgUrl(i)}" alt="" onerror="this.style.visibility='hidden'"><span class="meta"><b>${esc(i.colorName)}</b> ${esc(i.name)}<br><span class="muted">${esc(i.partId)}</span></span>${qtyHtml}</label>`;
  h += `<div class="row noprint"><button id="clearChk">Clear checkmarks</button><button id="print">Print</button></div>`;
  h += `<h2>Step 1: sort parts that belong to only one version</h2>`;
  for (const v of vs)
    h += `<h3>${esc(vLabel(v))}</h3><div class="card">${p.piles[v.key].map((r) => chk(`${v.key}|${r.key}`, r.item, `<span class="qty">${r.qty[v.key]}</span>`)).join('') || '<span class="muted">No unique parts</span>'}</div>`;
  h += `<h2>Step 2: shared parts - count into piles</h2>${legend(vs)}<div class="card">` +
    p.shared.map((r) => chk(`shared|${r.key}`, r.item, qtyCells(vs, r) + (r.sameQty ? '<span class="muted">same in all</span>' : ''))).join('') + '</div>';
  const ex = vs.filter((v) => v.extras.length);
  if (ex.length) h += `<h2>Optional spares (extras)</h2>` + ex.map((v) => `<h3>${esc(vLabel(v))}</h3><div class="card">${v.extras.map((i) => partHtml(i, `<span class="qty">${i.qty}</span>`)).join('')}</div>`).join('');
  return h;
}

const TABS = { identify: 'Identify', common: 'Common parts', separate: 'Separate after workshop' } as const;

function render() {
  const body = state.tab === 'identify' ? renderIdentify() : state.tab === 'common' ? renderCommon() : renderSeparate();
  document.getElementById('app')!.innerHTML = `<h1>LEGO Serious Play set identifier</h1>
    <nav>${(Object.keys(TABS) as (keyof typeof TABS)[]).map((t) => `<button data-tab="${t}" class="${t === state.tab ? 'active' : ''}">${TABS[t]}</button>`).join('')}</nav>${body}
    ${sets.some((s) => s.noInventory) ? `<p class="muted">Known sets without a BrickLink inventory (cannot be identified): ${sets.filter((s) => s.noInventory).map((s) => `<a href="${s.sourceUrl}">${esc(s.setNo + ' ' + s.name)}</a>`).join('; ')}</p>` : ''}
    <p class="muted">Data from BrickLink inventories. Images hotlinked from BrickLink.</p>`;
}

document.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
  if (!t) return;
  const d = t.dataset;
  if (d.tab) state.tab = d.tab as typeof state.tab;
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
  else if (el.dataset.sel) { const s = el.dataset.sel === 'common' ? state.selCommon : state.selSep; if (el.checked) s.add(el.value); else s.delete(el.value); }
  else if (el.dataset.chk) { if (el.checked) state.checked.add(el.dataset.chk); else state.checked.delete(el.dataset.chk); localStorage.setItem('lsp-checked', JSON.stringify([...state.checked])); }
  else return;
  render();
});

render();
