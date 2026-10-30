/**
 * Small UI library: typed helpers that return HTML strings styled by
 * tokens.css + components.css. Pages should compose these instead of
 * writing raw markup or class names.
 */
import './tokens.css';
import './components.css';

export type Html = string;
export type Attrs = Record<string, string | number | boolean | undefined | null>;

export const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Serialise attributes; false/undefined/null are skipped, true renders a bare attribute. */
export function attrs(a: Attrs = {}): string {
  return Object.entries(a)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${esc(String(v))}"`))
    .join('');
}

const cls = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

// ---- Text ----
export const muted = (c: Html): Html => `<div class="ui-text-muted">${c}</div>`;
export const mutedInline = (c: Html): Html => `<span class="ui-text-muted">${c}</span>`;
export const pending = (c: Html): Html => `<span class="ui-text-pending">${c}</span>`;
export const strong = (c: Html): Html => `<b>${c}</b>`;
export const paragraph = (c: Html, o: { muted?: boolean } = {}): Html =>
  `<p class="${cls('ui-paragraph', o.muted && 'ui-text-muted')}">${c}</p>`;
export const heading = (level: 1 | 2 | 3, c: Html): Html =>
  `<h${level} class="ui-heading ui-heading--${level}">${c}</h${level}>`;
export const divider = (): Html => '<hr class="ui-divider">';
export const link = (href: string, c: Html, o: { external?: boolean } = {}): Html =>
  `<a href="${esc(href)}"${o.external ? ' target="_blank" rel="noopener"' : ''}>${c}</a>`;

// ---- Layout ----
export const row = (c: Html, o: { noPrint?: boolean } = {}): Html =>
  `<div class="${cls('ui-row', o.noPrint && 'ui-noprint')}">${c}</div>`;

// ---- Buttons ----
export interface ButtonOpts {
  variant?: 'default' | 'active' | 'choice';
  noPrint?: boolean;
  attrs?: Attrs;
}
export const button = (c: Html, o: ButtonOpts = {}): Html =>
  `<button${attrs({ class: cls('ui-button', o.variant === 'active' && 'ui-button--active', o.variant === 'choice' && 'ui-button--choice', o.noPrint && 'ui-noprint'), ...o.attrs })}>${c}</button>`;

export const tabs = <T extends string>(items: Record<T, string>, active: T): Html =>
  `<nav class="ui-tabs ui-noprint" role="tablist">${(Object.keys(items) as T[])
    .map(
      (t) =>
        `<button${attrs({ class: cls('ui-tab', t === active && 'ui-tab--active'), role: 'tab', 'aria-selected': String(t === active), 'data-tab': t })}>${esc(items[t])}</button>`,
    )
    .join('')}</nav>`;

// ---- App shell ----
export const header = (title: string, nav: Html): Html =>
  `<header class="ui-header"><div class="ui-page"><div class="ui-header__title">${heading(1, esc(title))}</div>${nav}</div></header>`;
export const footer = (c: Html): Html => `<footer class="ui-footer"><div class="ui-page">${c}</div></footer>`;
export const shell = (parts: { header: Html; main: Html; footer: Html }): Html =>
  `<div class="ui-shell">${parts.header}<main class="ui-shell__main ui-page">${parts.main}</main>${parts.footer}</div>`;

// ---- Card / disclosure ----
export interface CardOpts {
  highlight?: boolean;
  row?: boolean;
  muted?: boolean;
  list?: boolean;
}
const cardCls = (o: CardOpts) =>
  cls(
    'ui-card',
    o.highlight && 'ui-card--highlight',
    o.row && 'ui-card--row',
    o.list && 'ui-card--list',
    o.muted && 'ui-text-muted',
  );
export const card = (c: Html, o: CardOpts = {}): Html => `<div class="${cardCls(o)}">${c}</div>`;
export const notice = (c: Html): Html => card(c, { muted: true });
export const collapsible = (summary: Html, c: Html, o: CardOpts = {}): Html =>
  `<details class="${cardCls(o)}"><summary>${summary}</summary>${c}</details>`;

// ---- Form controls ----
export const textInput = (a: Attrs): Html => `<input${attrs({ type: 'text', class: 'ui-input', ...a })}>`;
export const numberInput = (a: Attrs, size?: 'sm' | 'md'): Html =>
  `<input${attrs({ type: 'number', class: cls('ui-input', size && `ui-input--${size}`), ...a })}>`;
export const checkbox = (a: Attrs): Html => `<input${attrs({ type: 'checkbox', ...a })}>`;
export const select = (options: { value: string; label: string; selected?: boolean }[], a: Attrs = {}): Html =>
  `<select${attrs({ class: 'ui-select', ...a })}>${options.map((o) => `<option${attrs({ value: o.value, selected: o.selected })}>${esc(o.label)}</option>`).join('')}</select>`;
export const field = (label: string, control: Html): Html => `<label>${esc(label)} ${control}</label>`;

// ---- Data display ----
export const qty = (v: string | number, o: { title?: string } = {}): Html =>
  `<span${attrs({ class: 'ui-qty', title: o.title })}>${v}</span>`;

/** Generic list row: leading content, flexible meta, trailing content. */
export const listRow = (c: Html, o: { done?: boolean; as?: 'div' | 'label' } = {}): Html => {
  const tag = o.as ?? 'div';
  return `<${tag} class="${cls('ui-list-row', o.done && 'ui-list-row--done')}">${c}</${tag}>`;
};
export const listRowMeta = (c: Html): Html => `<span class="ui-list-row__meta">${c}</span>`;

export interface PartLike {
  colorName: string;
  name: string;
  partId: string;
}
export interface PartRowOpts {
  trailing?: Html;
  img: string;
  check?: { checked: boolean; attrs: Attrs };
}
/** Image + colour/name + part id + trailing content, optionally with a checkbox. */
export function partRow(p: PartLike, o: PartRowOpts): Html {
  const img = `<img class="ui-list-row__img" src="${esc(o.img)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`;
  const meta = listRowMeta(`<b>${esc(p.colorName)}</b> ${esc(p.name)}<br>${mutedInline(esc(p.partId))}`);
  const box = o.check ? checkbox({ ...o.check.attrs, checked: o.check.checked }) : '';
  return listRow(box + img + meta + (o.trailing ?? ''), o.check ? { as: 'label', done: o.check.checked } : {});
}
