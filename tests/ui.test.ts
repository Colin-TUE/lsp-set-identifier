import { describe, expect, test } from 'vitest';
import {
  attrs,
  badge,
  dialog,
  empty,
  layout,
  list,
  listRowMeta,
  progress,
  section,
  spacer,
  stack,
  button,
  card,
  checkbox,
  collapsible,
  divider,
  esc,
  field,
  footer,
  header,
  heading,
  link,
  listRow,
  muted,
  mutedInline,
  notice,
  numberInput,
  paragraph,
  partRow,
  pending,
  qty,
  row,
  select,
  shell,
  strong,
  tabs,
  textInput,
} from '../src/ui';
import { imgUrl } from '../src/data/types';

describe('escaping and attributes', () => {
  test('esc escapes HTML special characters', () => {
    expect(esc(`<a href="x">&</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });
  test('attrs skips empty values, renders bare booleans and escapes', () => {
    expect(attrs({ a: 'x"y', b: true, c: false, d: undefined, e: null, n: 0 })).toBe(' a="x&quot;y" b n="0"');
  });
});

describe('text and layout', () => {
  test('text helpers', () => {
    expect(muted('x')).toBe('<div class="ui-text-muted">x</div>');
    expect(mutedInline('x')).toContain('ui-text-muted');
    expect(pending('x')).toContain('ui-text-pending');
    expect(strong('x')).toBe('<b>x</b>');
    expect(divider()).toContain('ui-divider');
  });
  test('heading levels and paragraph variants', () => {
    expect(heading(2, 'T')).toBe('<h2 class="ui-heading ui-heading--2">T</h2>');
    expect(paragraph('p')).not.toContain('ui-text-muted');
    expect(paragraph('p', { muted: true })).toContain('ui-text-muted');
  });
  test('link only adds target for external links', () => {
    expect(link('/a', 'x')).toBe('<a href="/a">x</a>');
    expect(link('https://x/?a="', 'x', { external: true })).toContain('target="_blank" rel="noopener"');
    expect(link('https://x/?a="', 'x')).toContain('&quot;');
  });
  test('row can be hidden when printing', () => {
    expect(row('x')).not.toContain('ui-noprint');
    expect(row('x', { noPrint: true })).toContain('ui-noprint');
  });
});

describe('buttons and tabs', () => {
  test('button variants and attributes', () => {
    expect(button('Go')).toContain('class="ui-button"');
    expect(button('Go', { variant: 'choice' })).toContain('ui-button--choice');
    expect(button('Go', { variant: 'active', noPrint: true, attrs: { id: 'x' } })).toMatch(
      /ui-button--active ui-noprint.*id="x"/,
    );
  });
  test('tabs mark only the active tab', () => {
    const html = tabs({ a: 'A', b: 'B<' }, 'b');
    expect(html).toContain('data-tab="a"');
    expect(html.match(/ui-tab--active/g)).toHaveLength(1);
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('B&lt;');
  });
});

describe('cards and shell', () => {
  test('card options', () => {
    expect(card('x', { highlight: true, row: true, list: true })).toMatch(
      /ui-card--highlight.*ui-card--row.*ui-card--list/,
    );
    expect(notice('x')).toContain('ui-text-muted');
  });
  test('collapsible renders details with summary', () => {
    expect(collapsible('S', 'B')).toBe('<details class="ui-card"><summary>S</summary>B</details>');
  });
  test('shell composes header, main and footer in order', () => {
    const html = shell({ header: header('Title <1>', 'NAV'), main: 'MAIN', footer: footer('FOOT') });
    expect(html.indexOf('<header')).toBeLessThan(html.indexOf('MAIN'));
    expect(html.indexOf('MAIN')).toBeLessThan(html.indexOf('<footer'));
    expect(html).toContain('Title &lt;1&gt;');
    expect(html).toContain('NAV');
  });
});

describe('form controls', () => {
  test('inputs', () => {
    expect(textInput({ id: 'a' })).toBe('<input type="text" class="ui-input" id="a">');
    expect(numberInput({ min: 1 }, 'sm')).toContain('ui-input--sm');
    expect(numberInput({})).not.toContain('--sm');
    expect(checkbox({ checked: true })).toBe('<input type="checkbox" checked>');
    expect(checkbox({ checked: false })).not.toContain('checked');
  });
  test('select escapes labels and marks the selected option', () => {
    const html = select(
      [
        { value: '1', label: 'A&B', selected: true },
        { value: '2', label: 'C' },
      ],
      { id: 's' },
    );
    expect(html).toContain('<option value="1" selected>A&amp;B</option>');
    expect(html).toContain('<option value="2">C</option>');
    expect(field('Set:', html)).toMatch(/^<label class="ui-field">Set: <select/);
  });
});

describe('data display', () => {
  test('qty with and without title', () => {
    expect(qty(3)).toBe('<span class="ui-qty">3</span>');
    expect(qty('-', { title: 'a"b' })).toContain('title="a&quot;b"');
  });
  test('listRow modifiers', () => {
    expect(listRow('x', { done: true, as: 'label' })).toMatch(/^<label class="ui-list-row ui-list-row--done">/);
  });
  test('partRow escapes part data and supports a checkbox', () => {
    const part = { colorName: 'Red', name: '<b>Brick</b>', partId: '3001' };
    const plain = partRow(part, { img: 'x.jpg', trailing: 'T' });
    expect(plain).not.toContain('<b>Brick</b>');
    expect(plain).toContain('&lt;b&gt;Brick');
    expect(plain.endsWith('T</div>')).toBe(true);
    const checked = partRow(part, { img: 'x.jpg', check: { checked: true, attrs: { 'data-chk': 'k' } } });
    expect(checked).toMatch(/^<label .*ui-list-row--done/);
    expect(checked).toContain('data-chk="k" checked');
  });
});

describe('imgUrl', () => {
  test('uses the right BrickLink path per item type', () => {
    expect(imgUrl({ type: 'P', partId: '3001', colorId: 5 })).toBe('https://img.bricklink.com/P/5/3001.jpg');
    expect(imgUrl({ type: 'G', partId: 'g1', colorId: 0 })).toBe('https://img.bricklink.com/G/g1.jpg');
    expect(imgUrl({ type: 'M', partId: 'm1', colorId: 0 })).toBe('https://img.bricklink.com/M/m1.jpg');
  });
});

describe('layout, badges, sections, progress and dialog', () => {
  test('stack gap classes (md is the default)', () => {
    expect(stack('x')).toBe('<div class="ui-stack">x</div>');
    expect(stack('x', { gap: 'md' })).not.toContain('--md');
    expect(stack('x', { gap: 'lg' })).toContain('ui-stack--lg');
    expect(spacer()).toContain('ui-spacer');
  });
  test('row variants and layout', () => {
    expect(row('x', { between: true, stretch: true })).toContain('ui-row--between ui-row--stretch');
    expect(layout('M', 'A')).toMatch(/M<\/div><aside class="ui-layout__aside">A<\/aside>/);
  });
  test('badge tone', () => {
    expect(badge('x')).toBe('<span class="ui-badge">x</span>');
    expect(badge('x', { tone: 'success' })).toContain('ui-badge--success');
  });
  test('button sizes', () => {
    expect(button('x', { size: 'sm' })).toContain('ui-button--sm');
    expect(button('x', { size: 'icon' })).toContain('ui-button--sm ui-button--icon');
    expect(button('x', { size: 'md' })).not.toContain('--sm');
  });
  test('card and collapsible remaining options', () => {
    const c = card('x', { success: true, flush: true, noPrint: true, muted: true });
    expect(c).toMatch(/ui-card--success ui-card--flush ui-noprint ui-text-muted/);
    expect(collapsible('S', 'B', { open: true })).toContain('<details class="ui-card" open>');
  });
  test('section defaults to level 2, supports level 3 and actions', () => {
    const plain = section('T', 'B');
    expect(plain).toContain('<h2');
    expect(plain).toContain('ui-card--flush');
    expect(section('T', 'B', { level: 3, actions: 'ACT' })).toMatch(/<h3.*<\/h3>ACT<\/div>/);
  });
  test('empty and list helpers', () => {
    expect(empty('x')).toContain('ui-empty');
    expect(list('x')).toContain('ui-list');
    expect(listRowMeta('x')).toContain('ui-list-row__meta');
    expect(listRow('x', { head: true })).toContain('ui-list-row--head');
    expect(listRow('x')).toBe('<div class="ui-list-row">x</div>');
  });
  test('progress handles an empty total', () => {
    expect(progress(1, 4)).toContain('width:25%');
    expect(progress(0, 0)).toContain('width:0%');
  });
  test('dialog renders a footer only when given and escapes id/title', () => {
    const d = dialog('a"b', 'T<', 'BODY');
    expect(d).toContain('id="a&quot;b"');
    expect(d).toContain('aria-label="T&lt;"');
    expect(d).not.toContain('ui-dialog__foot');
    expect(dialog('x', 'T', 'B', { footer: 'F' })).toContain('<div class="ui-dialog__foot">F</div>');
  });
  test('textInput grow', () => {
    expect(textInput({}, { grow: true })).toContain('ui-input--grow');
  });
});
