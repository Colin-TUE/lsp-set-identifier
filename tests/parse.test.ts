import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { parseChangelog, parseInventory } from '../scripts/parse';
import { changelogPage, inventoryPage, itemRow, sectionRow } from './helpers/bricklink';

const inv = parseInventory(readFileSync('fixtures/2000414-4.html', 'latin1'), '2000414-4', 'x');
const by = (k: string) => inv.items.filter((i) => i.kind === k);

describe('real BrickLink page', () => {
  test('sections', () => {
    expect(by('regular').length).toBe(117);
    expect(by('regular').reduce((a, i) => a + i.qty, 0)).toBe(234);
    expect(by('extra').length).toBe(3);
    expect(by('counterpart').length).toBe(4);
    expect(by('alternate').length).toBe(1);
  });
  test('colors and match ids', () => {
    const neon = by('regular').find((i) => i.partId === '3957b' && i.colorId === 16)!;
    const blue = by('alternate')[0];
    expect(neon.colorName).toBe('Trans-Neon Green');
    expect(blue.colorId).toBe(15);
    expect(blue.matchId).toBeGreaterThan(0);
    expect(neon.matchId).toBe(blue.matchId);
    const dbg = by('regular').find((i) => i.colorName === 'Dark Bluish Gray')!;
    expect(dbg.name).not.toMatch(/^Dark/);
  });
  test('changelog groups by date', () => {
    const g = parseChangelog(readFileSync('fixtures/2000430-2.changelog.html', 'latin1'));
    expect(g).toEqual([
      { date: 'Jul 1, 2023', matchIds: [1] },
      { date: 'Jul 2, 2023', matchIds: [2, 3] },
    ]);
  });
});

describe('set name', () => {
  const name = (html: string) => parseInventory(html, 'S-1', 'u').name;
  test('comes from the page title up to "This Set Consists"', () => {
    expect(name('<TITLE>Serious Play Kit * This Set Consists of 5</TITLE>')).toBe('Serious Play Kit');
  });
  test('title is decoded and loses a trailing asterisk', () => {
    expect(name('Serious Play A &amp; B &#40;x&#41; &quot;q&quot; &#39;s&#39; &lt;&gt;&nbsp;z*<')).toBe(
      `Serious Play A & B (x) "q" 's' <> z`,
    );
  });
  test('falls back to the bold name next to the link, then to the set number', () => {
    expect(name('<A><B>Some Set</B></A> (1 Part)</FONT>')).toBe('Some Set');
    expect(name('<HTML>nothing useful</HTML>')).toBe('S-1');
  });
});

describe('inventory rows', () => {
  const parse = (...rows: string[]) => parseInventory(inventoryPage(rows), 'S-1', 'u').items;

  test('an empty page has no items', () => {
    expect(parse()).toEqual([]);
  });
  test('reads type, part, colour, quantity and name', () => {
    expect(parse(itemRow())).toEqual([
      {
        type: 'P',
        partId: '3001',
        colorId: 5,
        colorName: 'Red',
        name: 'Brick 2 x 4',
        qty: 2,
        kind: 'regular',
        matchId: 0,
      },
    ]);
  });
  test('upper-cases the type and decodes the part id', () => {
    const [i] = parse(itemRow({ type: 'g', part: 'a%2Fb' }));
    expect(i.type).toBe('G');
    expect(i.partId).toBe('a/b');
  });
  test('items without idColor get colour 0', () => {
    expect(parse(itemRow({ color: undefined }))[0].colorId).toBe(0);
  });
  test('missing quantity is 0', () => {
    expect(parse(itemRow({ qty: undefined }))[0].qty).toBe(0);
  });
  test('colour is split off the bold text using the alt-text name, ignoring whitespace differences', () => {
    const [i] = parse(itemRow({ bold: 'Dark  Bluish Gray   Brick 2 x 4', alt: 'Brick 2  x 4' }));
    expect(i.colorName).toBe('Dark Bluish Gray');
    expect(i.name).toBe('Brick 2 x 4');
  });
  test('without a matching alt-text name the whole bold text is the name and the colour is "(none)"', () => {
    const [mismatch] = parse(itemRow({ bold: 'Red Brick', alt: 'Plate' }));
    expect([mismatch.colorName, mismatch.name]).toEqual(['(none)', 'Red Brick']);
    const [noAlt] = parse(itemRow({ bold: 'Red Brick', alt: '' }));
    expect([noAlt.colorName, noAlt.name]).toEqual(['(none)', 'Red Brick']);
  });
  test('a row without an image alt text keeps the whole bold text as the name', () => {
    const [i] = parse(itemRow({ bold: 'Red Brick', alt: undefined }));
    expect([i.colorName, i.name]).toEqual(['(none)', 'Red Brick']);
  });
  test('name equal to the whole bold text leaves no colour', () => {
    const [i] = parse(itemRow({ bold: 'Brick', alt: 'Brick' }));
    expect([i.colorName, i.name]).toEqual(['(none)', 'Brick']);
  });
  test('missing bold text gives an empty name', () => {
    expect(parse(itemRow({ bold: '' }))[0].name).toBe('');
  });
  test('reads the match id from the MID cell and defaults to 0', () => {
    expect(parse(itemRow({ mid: 7 }))[0].matchId).toBe(7);
    expect(parse(itemRow())[0].matchId).toBe(0);
  });
  test('skips rows that are not items or have no catalog link', () => {
    expect(parse(itemRow({ plain: true }), itemRow({ noLink: true }))).toEqual([]);
  });
});

describe('inventory sections', () => {
  const kinds = (...rows: string[]) => parseInventory(inventoryPage(rows), 'S-1', 'u').items.map((i) => i.kind);

  test('items default to regular before any header', () => {
    expect(kinds(itemRow())).toEqual(['regular']);
  });
  test('each known header switches the kind for the rows that follow', () => {
    expect(
      kinds(
        sectionRow('Regular Items:'),
        itemRow(),
        sectionRow('Extra Items:'),
        itemRow(),
        sectionRow('Counterparts:'),
        itemRow(),
        sectionRow('Alternate Items:'),
        itemRow(),
      ),
    ).toEqual(['regular', 'extra', 'counterpart', 'alternate']);
  });
  test('unknown or non-white headers do not switch the kind', () => {
    expect(
      kinds(
        sectionRow('Extra Items:'),
        sectionRow('Parts:'),
        itemRow(),
        sectionRow('Alternate Items:', { white: false }),
        itemRow(),
      ),
    ).toEqual(['extra', 'extra']);
  });
});

describe('changelog', () => {
  const parse = (...entries: { date: string; text: string }[]) => parseChangelog(changelogPage(entries));

  test('a page without dates has no groups', () => {
    expect(parseChangelog('<HTML>nothing</HTML>')).toEqual([]);
  });
  test('collects both Match ID notations, case-insensitively, de-duplicated and sorted', () => {
    expect(
      parse({
        date: 'Jan 5, 2024',
        text: '(Match ID 9) {Match ID 3 to 4 } {match ID 5 to 6} (Match ID 9) (Match ID 2)',
      }),
    ).toEqual([{ date: 'Jan 5, 2024', matchIds: [2, 4, 6, 9] }]);
  });
  test('ignores Match ID 0 and dates without any Match ID', () => {
    expect(parse({ date: 'Jan 5, 2024', text: '(Match ID 0)' }, { date: 'Feb 6, 2024', text: 'just words' })).toEqual(
      [],
    );
  });
  test('orders groups by date, not by position on the page', () => {
    expect(
      parse(
        { date: 'Mar 1, 2024', text: '(Match ID 3)' },
        { date: 'Jan 1, 2023', text: '(Match ID 1)' },
        { date: 'Dec 31, 2023', text: '(Match ID 2)' },
      ).map((g) => g.date),
    ).toEqual(['Jan 1, 2023', 'Dec 31, 2023', 'Mar 1, 2024']);
  });
  test('a Match ID only counts for the date block it is in', () => {
    expect(parse({ date: 'Jan 1, 2023', text: '(Match ID 1)' }, { date: 'Feb 1, 2023', text: '(Match ID 2)' })).toEqual(
      [
        { date: 'Jan 1, 2023', matchIds: [1] },
        { date: 'Feb 1, 2023', matchIds: [2] },
      ],
    );
  });
});
