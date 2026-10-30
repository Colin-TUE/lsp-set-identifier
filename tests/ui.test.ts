import { describe, expect, test } from 'vitest';
import {
  attrs,
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
