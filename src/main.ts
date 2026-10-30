import {
  badge,
  dialog,
  button,
  card,
  collapsible,
  empty,
  esc,
  field,
  footer,
  header,
  heading,
  layout,
  link,
  list,
  listRow,
  listRowMeta,
  muted,
  mutedInline,
  notice,
  numberInput,
  paragraph,
  partRow,
  pending,
  progress,
  qty,
  row,
  section,
  select,
  shell,
  spacer,
  stack,
  tabs,
  textInput,
} from './ui';
import { sets } from './data/sets.generated';
import { versionOverrides, extraVersions, mergeDates } from './data/versions';
import { imgUrl, itemKey, type Item, type ResolvedVersion } from './data/types';
import { resolveAll } from './logic/versions';
import { candidatesFor, hasProgress, listProducts, resetIdentify as resetIdentifyState } from './logic/flow';
import {
  changeFrom,
  compare,
  distinguish,
  identify,
  itemIndex,
  nextQuestion,
  questionId,
  separate,
  type PartRow,
  type Question,
} from './logic/analysis';

const versions = resolveAll(sets, versionOverrides, extraVersions, mergeDates);
const index = itemIndex(versions);
const byKey = new Map(versions.map((v) => [v.key, v]));
const vLabel = (v: ResolvedVersion) => `${v.setNo} ${v.setName} · ${v.name}${v.pending ? ' (pending)' : ''}`;
const label = (i: Item) => `${i.partId} | ${i.colorName} | ${i.name}`;

type Tab = 'identify' | 'separate';
const state = {
  tab: 'identify' as Tab,
  obs: [] as { key: string; qty?: number }[],
  setFilter: '',
  answers: [] as { qid: string; keep: string[] }[],
  skipped: new Set<string>(),
  flash: '',
  workshop: JSON.parse(localStorage.getItem('lsp-workshop') ?? '{}') as Record<string, number>,
  checked: new Set<string>(JSON.parse(localStorage.getItem('lsp-checked') ?? '[]')),
  /** Versions the user is happy to keep mixed together instead of sorting out. */
  picker: false,
  mixed: new Set<string>(JSON.parse(localStorage.getItem('lsp-mixed') ?? '[]')),
};

const saveWorkshop = () => localStorage.setItem('lsp-workshop', JSON.stringify(state.workshop));
const saveChecked = () => localStorage.setItem('lsp-checked', JSON.stringify([...state.checked]));
for (const k of Object.keys(state.workshop)) if (!byKey.has(k)) delete state.workshop[k];
const count = (v: ResolvedVersion) => state.workshop[v.key] ?? 0;
const inWorkshop = () => versions.filter((v) => count(v) > 0);
const boxes = () => Object.values(state.workshop).reduce((a, n) => a + n, 0);
const itemOf = (k: string) => index.get(k)!;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const invLink = (setNo: string) => {
  const url =
    sets.find((s) => s.setNo === setNo)?.sourceUrl ?? `https://www.bricklink.com/catalogItemInv.asp?S=${setNo}`;
  return link(url, 'BrickLink inventory ↗', { external: true });
};
const products = listProducts(sets);
const resetIdentify = (keepParts = false) => resetIdentifyState(state, keepParts);

const partHtml = (i: Item, trailing = '') => partRow(i, { img: imgUrl(i), trailing });

const candidates = () => candidatesFor(versions, state);

// ---------- Step 1: identify ----------

let currentQ: Question | null = null;

function renderQuestion(q: Question): string {
  currentQ = q;
  const MAX = 3;
  // Any single element of a side is enough to decide, so show a few easy-to-spot ones:
  // common (high qty), plain (no printed pattern / assembly), and different shapes.
  const easy = (k: string) => itemOf(k).qty - (/pb|px|c\d|^x/.test(itemOf(k).partId) ? 100 : 0);
  const side = (keys: string[]) => {
    const seen = new Set<string>();
    const pick = [...keys]
      .sort((x, y) => easy(y) - easy(x))
      .filter((k) => !seen.has(itemOf(k).partId) && seen.add(itemOf(k).partId))
      .slice(0, MAX);
    const hint =
      keys.length > 1
        ? muted(`Any one of these is enough${keys.length > pick.length ? ` (${keys.length} in total)` : ''}`)
        : '';
    return hint + list(pick.map((k) => partHtml(itemOf(k))).join(''));
  };
  const skip = button('Not sure, skip', { variant: 'ghost', attrs: { 'data-ans': 'skip' } });
  if (q.b.length)
    return (
      paragraph('<b>Which of these is in the box?</b>') +
      row(
        button(`<b>A</b>${side(q.a)}`, { variant: 'choice', attrs: { 'data-ans': 'A' } }) +
          button(`<b>B</b>${side(q.b)}`, { variant: 'choice', attrs: { 'data-ans': 'B' } }),
        { stretch: true },
      ) +
      row(spacer() + skip)
    );
  return (
    paragraph('<b>Is this in the box?</b>') +
    side(q.a) +
    row(
      button('Yes', { variant: 'primary', attrs: { 'data-ans': 'A' } }) +
        button('No', { attrs: { 'data-ans': 'B' } }) +
        spacer() +
        skip,
    )
  );
}

const brief = (items: Item[], max = 6) => {
  const top = [...items].sort((x, y) => y.qty - x.qty);
  return (
    list(
      top
        .slice(0, max)
        .map((i) => partHtml(i, qty(i.qty)))
        .join(''),
    ) + (items.length > max ? muted(`and ${items.length - max} more`) : '')
  );
};

const addButton = (v: ResolvedVersion, primary = false) =>
  button(count(v) ? `+1 more (${count(v)} in workshop)` : 'Add to workshop', {
    variant: primary ? 'primary' : 'default',
    size: primary ? 'md' : 'sm',
    noPrint: true,
    attrs: { 'data-add': v.key, 'data-next': primary || undefined },
  });

function candidateDetails(r: ReturnType<typeof identify>[number], cands: ResolvedVersion[]): string {
  const v = r.version;
  const others = cands.filter((c) => c !== v);
  const d = distinguish(v, others);
  const sameSet = versions.filter((x) => x.setNo === v.setNo);
  const prev = sameSet[sameSet.indexOf(v) - 1];
  const ch = prev ? changeFrom(v, prev) : null;
  const sec = (t: string, items: Item[]) => (items.length ? stack(heading(3, t) + brief(items), { gap: 'sm' }) : '');
  return (
    (r.missing.length
      ? muted(
          `Not in this version: ${r.missing.map((k) => esc(itemOf(k).colorName + ' ' + itemOf(k).partId)).join(', ')}`,
        )
      : '') +
    (r.qtyMismatch.length
      ? muted(`Different quantity: ${r.qtyMismatch.map((k) => esc(itemOf(k).partId)).join(', ')}`)
      : '') +
    (others.length
      ? sec(`Only in this version (${d.onlyHere.length})`, d.onlyHere) +
        sec(`Other candidates have, this one doesn't (${d.lacks.length})`, d.lacks)
      : '') +
    (ch && (ch.onlyHere.length || ch.lacks.length)
      ? sec(`New since ${prev.name} (${ch.onlyHere.length})`, ch.onlyHere) +
        sec(`Replaced since ${prev.name} (${ch.lacks.length})`, ch.lacks)
      : '') +
    (v.extras.length ? sec(`Spares / extras (${v.extras.length})`, v.extras) : '') +
    muted(invLink(v.setNo))
  );
}

function renderIdentify(): string {
  const cands = candidates();
  const ranked = identify(cands, state.obs);
  const progressed = hasProgress(state);

  // Box picker: which set is printed on the box narrows things down a lot.
  const setOptions = [
    { value: '', label: 'Any set / not sure', selected: false },
    ...products.map(([no, name]) => ({ value: no, label: `${no} ${name}`, selected: no === state.setFilter })),
  ];
  const narrow = row(
    field('Product number on the box', select(setOptions, { id: 'setFilter' })) +
      spacer() +
      (progressed ? button('Start over', { variant: 'ghost', attrs: { id: 'resetAns' } }) : ''),
  );

  let body = narrow;
  if (cands.length === 1) {
    currentQ = null;
    const v = cands[0];
    body += card(
      row(
        `<div>${muted('This box is')}<b>${esc(vLabel(v))}</b></div>` +
          spacer() +
          addButton(v, true) +
          button('Next box', { attrs: { id: 'nextBox' } }),
      ),
      { success: true },
    );
  } else {
    const q = nextQuestion(cands, state.skipped);
    if (q) body += renderQuestion(q);
    else {
      currentQ = null;
      body += notice(
        'No more questions can tell the remaining versions apart. Compare them below or check the BrickLink inventory.',
      );
    }
  }
  if (state.flash) body = notice(state.flash) + body;

  const noFit =
    state.obs.length > 0 && !cands.every((v) => state.obs.every((o) => v.parts.some((p) => itemKey(p) === o.key)));
  const opts = [...index.values()].map((i) => `<option value="${esc(label(i))}"></option>`).join('');
  const parts = section(
    'Look up specific parts',
    stack(
      row(
        textInput({ id: 'partIn', list: 'parts', placeholder: 'Part no., name or colour' }, { grow: true }) +
          `<datalist id="parts">${opts}</datalist>` +
          numberInput({ id: 'qtyIn', min: 0, placeholder: 'Qty' }, 'sm') +
          button('Add part', { attrs: { id: 'addObs' } }),
      ) +
        (state.obs.length
          ? list(
              state.obs
                .map((o, n) =>
                  partHtml(
                    itemOf(o.key),
                    qty(o.qty ?? '') +
                      button('✕', { variant: 'ghost', size: 'icon', attrs: { 'data-rm': n, 'aria-label': 'Remove' } }),
                  ),
                )
                .join(''),
            )
          : '') +
        (noFit ? notice('No version contains all these parts, so the closest matches are shown.') : ''),
    ),
    {
      level: 3,
      actions: state.obs.length
        ? badge(String(state.obs.length))
        : mutedInline('Optional: spotted a distinctive piece? Add it to narrow the match.'),
    },
  );

  const results =
    cands.length > 1
      ? collapsible(
          `<b>Possible versions</b>${badge(String(cands.length))}`,
          list(
            ranked
              .map((r) =>
                listRow(
                  listRowMeta(
                    `<b>${esc(vLabel(r.version))}</b>${state.obs.length ? ' ' + mutedInline(`score ${r.score}`) : ''}`,
                  ) + addButton(r.version),
                ),
              )
              .join(''),
          ) +
            ranked
              .slice(0, 1)
              .map((r) => collapsible(`<b>How is ${esc(r.version.name)} different?</b>`, candidateDetails(r, cands)))
              .join(''),
        )
      : collapsible('<b>Details of this version</b>', candidateDetails(ranked[0], cands));

  return layout(
    section('Identify a box', body, { actions: badge(`${plural(cands.length, 'candidate')}`) }) + parts + results,
    workshopPanel(),
  );
}

// ---------- Workshop panel (shared side bar) ----------

function workshopPanel(): string {
  const ws = inWorkshop();
  const rows = ws.length
    ? list(
        ws
          .map((v) =>
            listRow(
              listRowMeta(`<b>${esc(v.setNo)}</b> ${esc(v.setName)}<br>${mutedInline(esc(v.name))}`) +
                button('−', { size: 'icon', attrs: { 'data-dec': v.key, 'aria-label': 'One less' } }) +
                qty(count(v)) +
                button('+', { size: 'icon', attrs: { 'data-add': v.key, 'aria-label': 'One more' } }),
            ),
          )
          .join(''),
      )
    : empty('No boxes yet. Identify a box, then add it here.');
  const next =
    state.tab === 'identify'
      ? button('Sort after workshop →', {
          variant: ws.length ? 'primary' : 'default',
          attrs: { 'data-tab': 'separate' },
        })
      : button('← Identify more boxes', { attrs: { 'data-tab': 'identify' } });
  return section('Your workshop', rows + next, {
    actions:
      badge(`${boxes()} ${boxes() === 1 ? 'box' : 'boxes'}`, { tone: ws.length ? 'accent' : undefined }) +
      button('+ Add sets', { size: 'sm', noPrint: true, attrs: { id: 'openPicker' } }),
  });
}

/** Dialog listing every known version with a box counter, to build the workshop without identifying. */
function pickerDialog(): string {
  const stepper = (v: ResolvedVersion) =>
    (count(v)
      ? button('−', { size: 'icon', attrs: { 'data-dec': v.key, 'aria-label': 'One less' } }) + qty(count(v))
      : '') +
    button(count(v) ? '+' : 'Add', {
      size: count(v) ? 'icon' : 'sm',
      attrs: { 'data-add': v.key, 'aria-label': 'One more' },
    });
  const body = sets
    .filter((s) => !s.noInventory)
    .map((s) =>
      stack(
        heading(3, `${s.setNo} ${esc(s.name)}`) +
          list(
            versions
              .filter((v) => v.setNo === s.setNo)
              .map((v) => listRow(listRowMeta(esc(v.name) + (v.pending ? ' ' + pending('pending') : '')) + stepper(v)))
              .join(''),
          ),
        { gap: 'sm' },
      ),
    )
    .join('');
  return dialog('pickerDlg', 'Add sets to your workshop', body, {
    footer:
      mutedInline(`${boxes()} ${boxes() === 1 ? 'box' : 'boxes'} in workshop`) +
      spacer() +
      button('Done', { variant: 'primary', attrs: { id: 'closePicker' } }),
  });
}

// ---------- Step 2: sort ----------

/** A pile to sort into: one version, or every "keep mixed" version merged into one pile. */
interface Pile {
  v: ResolvedVersion; // parts/extras hold per-box qty for a version, totals for the mixed pile
  boxes: number;
  mixed: boolean;
}
const MIXED = 'mixed';

function sumItems(lists: Item[][]): Item[] {
  const m = new Map<string, Item>();
  for (const i of lists.flat()) {
    const k = itemKey(i);
    const prev = m.get(k);
    m.set(k, prev ? { ...prev, qty: prev.qty + i.qty } : { ...i });
  }
  return [...m.values()];
}

function piles(vs: ResolvedVersion[]): Pile[] {
  const sorted = vs.filter((v) => !state.mixed.has(v.key));
  const mixed = vs.filter((v) => state.mixed.has(v.key));
  const out: Pile[] = sorted.map((v) => ({ v, boxes: count(v), mixed: false }));
  if (mixed.length) {
    const times = (items: Item[], n: number) => items.map((i) => ({ ...i, qty: i.qty * n }));
    out.push({
      mixed: true,
      boxes: mixed.reduce((a, v) => a + count(v), 0),
      v: {
        key: MIXED,
        setNo: '',
        setName: 'Mixed pile',
        id: MIXED,
        name: mixed.map((v) => `${count(v)} × ${v.setNo} ${v.name}`).join(', '),
        pending: false,
        parts: sumItems(mixed.map((v) => times(v.parts, count(v)))),
        extras: sumItems(mixed.map((v) => times(v.extras, count(v)))),
      },
    });
  }
  return out;
}
const pileLabel = (p: Pile) => (p.mixed ? `Mixed pile (${p.v.name})` : vLabel(p.v));
/** Total quantity of a part in a pile (mixed pile quantities are already totals). */
const pileTotal = (p: Pile, perPile: number) => (p.mixed ? perPile : perPile * p.boxes);

const qtyCells = (vs: ResolvedVersion[], r: PartRow, value: (v: ResolvedVersion) => number | string) =>
  vs.map((v) => qty(r.qty[v.key] ? value(v) : '–', { title: vLabel(v) })).join('');
const colHead = (vs: unknown[], title: (n: number) => string) =>
  listRow(listRowMeta('Part') + vs.map((_, n) => qty(`#${n + 1}`, { title: title(n) })).join(''), { head: true });
const legend = (labels: string[]) => row(labels.map((l, n) => badge(`#${n + 1}`) + mutedInline(esc(l))).join('&ensp;'));

const mixToggle = (v: ResolvedVersion, mixed: boolean) =>
  button(mixed ? 'Sort out' : 'Skip sorting', {
    variant: mixed ? 'default' : 'ghost',
    size: 'sm',
    noPrint: true,
    attrs: { 'data-mix': v.key, title: mixed ? 'Sort this version out again' : 'Keep this version in the mixed pile' },
  });

/** The versions kept in the mixed pile, each collapsed to a single row. */
const mixedMembers = (vs: ResolvedVersion[]) =>
  list(
    vs
      .filter((v) => state.mixed.has(v.key))
      .map((v) => listRow(listRowMeta(`<b>${esc(vLabel(v))}</b>`) + badge(`${count(v)} ×`) + mixToggle(v, true)))
      .join(''),
  );

function renderSeparate(): string {
  const vs = inWorkshop();
  const ps = piles(vs);
  if (ps.length < 2)
    return layout(
      section(
        'Sort after workshop',
        empty(
          !vs.length
            ? 'Add the boxes used in your workshop first.'
            : vs.length === 1
              ? 'All boxes are the same version, so nothing needs sorting: just split the parts evenly.'
              : 'Everything is kept mixed, so there is nothing to sort. Choose at least one version to sort out.',
        ) +
          (vs.length > 1
            ? mixedMembers(vs)
            : row(button('← Identify boxes', { variant: 'primary', attrs: { 'data-tab': 'identify' } }))),
      ),
      workshopPanel(),
    );

  const pvs = ps.map((p) => p.v);
  const p = separate(pvs);
  const total = (r: PartRow, pile: Pile) => pileTotal(pile, r.qty[pile.v.key] ?? 0);
  const chk = (id: string, i: Item, trailing: string) =>
    partRow(i, { img: imgUrl(i), trailing, check: { checked: state.checked.has(id), attrs: { 'data-chk': id } } });

  const ids = [
    ...ps.flatMap((x) => p.piles[x.v.key].map((r) => `${x.v.key}|${r.key}`)),
    ...p.shared.map((r) => `shared|${r.key}`),
  ];
  const done = ids.filter((id) => state.checked.has(id)).length;

  const intro = section(
    'Sort after workshop',
    paragraph(
      'First pull out the parts that only one pile has, then count the shared parts into the piles. Quantities are totals for the whole workshop. Tick parts off as you go.',
      { muted: true },
    ) +
      row(mutedInline(`${done} of ${ids.length} parts sorted`) + spacer()) +
      progress(done, ids.length) +
      muted('Happy to keep some versions together? Use “Skip sorting” on them below and they go into one mixed pile.'),
    {
      actions:
        button('Reset ticks', { variant: 'ghost', noPrint: true, attrs: { id: 'clearChk' } }) +
        button('Print', { noPrint: true, attrs: { id: 'print' } }),
    },
  );

  const step1 = ps
    .map((x) =>
      section(
        esc(x.mixed ? `Kept mixed (${x.boxes} boxes)` : vLabel(x.v)),
        (x.mixed ? mixedMembers(vs) + heading(3, 'Parts only the mixed pile has') : '') +
          list(
            p.piles[x.v.key]
              .map((r) =>
                chk(
                  `${x.v.key}|${r.key}`,
                  r.item,
                  (x.mixed ? '' : mutedInline(`${r.qty[x.v.key]}/box`)) + qty(total(r, x)),
                ),
              )
              .join(''),
          ) || empty('No parts unique to this pile'),
        { level: 3, actions: x.mixed ? '' : badge(`${x.boxes} ×`) + mixToggle(x.v, false) },
      ),
    )
    .join('');

  const labels = ps.map(pileLabel);
  const step2 = section(
    `Step 2 · Shared parts: count into piles`,
    legend(labels) +
      list(
        colHead(ps, (n) => labels[n]) +
          p.shared
            .map((r) =>
              chk(
                `shared|${r.key}`,
                r.item,
                ps.map((x, n) => qty(r.qty[x.v.key] ? total(r, x) : '–', { title: labels[n] })).join(''),
              ),
            )
            .join(''),
      ),
    { actions: badge(String(p.shared.length)) },
  );

  const ex = ps.filter((x) => x.v.extras.length);
  const extras = ex.length
    ? collapsible(
        '<b>Optional spares (extras)</b>',
        ex
          .map((x) =>
            stack(
              heading(3, esc(pileLabel(x))) +
                list(x.v.extras.map((i) => partHtml(i, qty(pileTotal(x, i.qty)))).join('')),
              { gap: 'sm' },
            ),
          )
          .join(''),
      )
    : '';

  const c = compare(vs);
  const cmp = (t: string, rows: PartRow[]) =>
    stack(
      heading(3, `${t} (${rows.length})`) +
        list(
          colHead(vs, (n) => vLabel(vs[n])) +
            rows
              .map((r) =>
                partHtml(
                  r.item,
                  qtyCells(vs, r, (v) => r.qty[v.key]),
                ),
              )
              .join(''),
        ),
      { gap: 'sm' },
    );
  const comparison = collapsible(
    '<b>Compare versions (per box)</b>',
    legend(vs.map(vLabel)) +
      cmp('In all versions', c.all) +
      cmp('In some versions', c.some) +
      cmp('Only in one version', c.unique),
    { noPrint: true },
  );

  return layout(
    intro + heading(2, 'Step 1 · Parts unique to one pile') + step1 + step2 + extras + comparison,
    workshopPanel(),
  );
}

// ---------- Shell ----------

function render() {
  const prevScroll = document.querySelector('#pickerDlg .ui-dialog__body')?.scrollTop ?? 0;
  const n = boxes();
  const TABS: Record<Tab, string> = {
    identify: '1 · Identify boxes',
    separate: `2 · Sort after workshop${n ? ` (${n})` : ''}`,
  };
  const body = state.tab === 'identify' ? renderIdentify() : renderSeparate();
  state.flash = '';
  const noInv = sets.filter((s) => s.noInventory);
  document.getElementById('app')!.innerHTML = shell({
    header: header('LEGO Serious Play set identifier', tabs(TABS, state.tab)),
    main: body + pickerDialog(),
    footer: footer(
      (noInv.length
        ? paragraph(
            `Known sets without a BrickLink inventory (cannot be identified): ${noInv.map((s) => link(s.sourceUrl, esc(s.setNo + ' ' + s.name))).join('; ')}`,
            { muted: true },
          )
        : '') + paragraph('Data from BrickLink inventories. Images hotlinked from BrickLink.', { muted: true }),
    ),
  });
  const dlg = document.getElementById('pickerDlg') as HTMLDialogElement;
  // Only a close of the live dialog counts (not the old one being replaced by a re-render).
  dlg.addEventListener('close', () => {
    if (dlg.isConnected) state.picker = false;
  });
  // Clicking the backdrop (the dialog element itself, outside its content) closes it.
  dlg.addEventListener('click', (e) => e.target === dlg && dlg.close());
  if (state.picker) {
    dlg.showModal();
    dlg.querySelector('.ui-dialog__body')!.scrollTop = prevScroll;
  }
}

document.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
  if (!t) return;
  const d = t.dataset;
  if (d.add) {
    state.workshop[d.add] = (state.workshop[d.add] ?? 0) + 1;
    saveWorkshop();
    // After adding the identified box, get ready for the next one.
    if (d.next !== undefined) {
      state.flash = `Added ${esc(vLabel(byKey.get(d.add)!))}. Ready for the next box.`;
      resetIdentify();
    }
  } else if (t.id === 'openPicker') state.picker = true;
  else if (t.id === 'closePicker') state.picker = false;
  else if (d.mix) {
    if (state.mixed.has(d.mix)) state.mixed.delete(d.mix);
    else state.mixed.add(d.mix);
    localStorage.setItem('lsp-mixed', JSON.stringify([...state.mixed]));
  } else if (d.dec) {
    const n = (state.workshop[d.dec] ?? 0) - 1;
    if (n > 0) state.workshop[d.dec] = n;
    else delete state.workshop[d.dec];
    saveWorkshop();
  } else if (d.tab) {
    state.tab = d.tab as Tab;
    window.scrollTo(0, 0);
  } else if (t.id === 'addObs') {
    const v = (document.getElementById('partIn') as HTMLInputElement).value.trim();
    const q = (document.getElementById('qtyIn') as HTMLInputElement).value;
    const hit = [...index.entries()].find(([, i]) => label(i) === v);
    if (!hit) return alert('Pick a part from the suggestion list.');
    state.obs.push({ key: hit[0], qty: q === '' ? undefined : Number(q) });
  } else if (d.rm) state.obs.splice(Number(d.rm), 1);
  else if (d.ans && currentQ) {
    const qid = questionId(currentQ);
    if (d.ans === 'skip') state.skipped.add(qid);
    else state.answers.push({ qid, keep: d.ans === 'A' ? currentQ.aSet : currentQ.bSet });
  } else if (t.id === 'resetAns')
    resetIdentify(true); // keep the looked-up parts
  else if (t.id === 'nextBox') resetIdentify();
  else if (t.id === 'clearChk') {
    if (!confirm('Clear all ticks?')) return;
    state.checked.clear();
    saveChecked();
  } else if (t.id === 'print') return window.print();
  else return;
  render();
});

document.addEventListener('change', (e) => {
  const el = e.target as HTMLInputElement;
  if (el.id === 'setFilter') {
    state.setFilter = el.value;
    state.answers = [];
    state.skipped.clear();
  } else if (el.dataset.chk) {
    if (el.checked) state.checked.add(el.dataset.chk);
    else state.checked.delete(el.dataset.chk);
    saveChecked();
  } else return;
  render();
});

render();
