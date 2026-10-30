import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { sets as generated } from '../src/data/sets.generated';
import type { VersionDef } from '../src/data/types';
import { parseChangelog, parseInventory } from '../scripts/parse';
import {
  CATALOG_URL,
  CHANGELOG_URL,
  INVENTORY_URL,
  parseSetsFile,
  renderGenerated,
  sameRunWarnings,
  scrape,
  type Entry,
  type Io,
  type VersionData,
} from '../scripts/scrape-lib';
import { changelogPage, inventoryPage, itemRow, sectionRow } from './helpers/bricklink';

// ---------- fake I/O ----------
interface Fake {
  io: Io;
  cache: Map<string, string>;
  files: Map<string, string>;
  /** URL -> response; missing URLs answer 404 */
  web: Map<string, { ok?: boolean; status?: number; html: string }>;
  fetched: string[];
  sleeps: number[];
  log: string[];
  warnings: string[];
}
function fake(): Fake {
  const f: Fake = {
    cache: new Map(),
    files: new Map(),
    web: new Map(),
    fetched: [],
    sleeps: [],
    log: [],
    warnings: [],
    io: undefined as unknown as Io,
  };
  f.io = {
    readCache: (n) => f.cache.get(n),
    writeCache: (n, h) => void f.cache.set(n, h),
    readFile: (p) => {
      const h = f.files.get(p);
      if (h === undefined) throw new Error(`ENOENT ${p}`);
      return h;
    },
    fetchHtml: async (url) => {
      f.fetched.push(url);
      const r = f.web.get(url);
      return r ? { ok: r.ok ?? true, status: r.status ?? 200, html: r.html } : { ok: false, status: 404, html: '' };
    },
    sleep: async (ms) => void f.sleeps.push(ms),
  };
  return f;
}
const noData: VersionData = { overrides: {}, extra: {}, merge: {} };
const run = (f: Fake, entries: Entry[], o: { refresh?: boolean; data?: VersionData } = {}) =>
  scrape({
    entries,
    refresh: o.refresh ?? false,
    io: f.io,
    data: o.data ?? noData,
    log: (m) => f.log.push(m),
    warn: (m) => f.warnings.push(m),
  });

/** A set with two alternates (match IDs 1 and 2), shaped like a BrickLink page. */
const twoAlternates = inventoryPage([
  sectionRow('Regular Items:'),
  itemRow({ part: 'a', qty: 3, mid: 1 }),
  itemRow({ part: 'b', mid: 2 }),
  sectionRow('Alternate Items:'),
  itemRow({ part: 'a2', color: 6, mid: 1 }),
  itemRow({ part: 'b2', color: 6, mid: 2 }),
]);
const url = (setNo: string): Entry => ({ type: 'url', setNo, url: INVENTORY_URL(setNo) });

// ---------- sets.txt ----------
describe('parseSetsFile', () => {
  test('skips blanks and comments and trims lines', () => {
    expect(parseSetsFile(`# comment\n\n  ${INVENTORY_URL('1-1')}  \n   # another\n`)).toEqual([
      { type: 'url', setNo: '1-1', url: INVENTORY_URL('1-1') },
    ]);
  });
  test('"!" entries are listed-only with a multi-word name', () => {
    expect(parseSetsFile('!2-1 Some Kit {2010 Version}')).toEqual([
      { type: 'listed', setNo: '2-1', name: 'Some Kit {2010 Version}' },
    ]);
  });
  test('"setNo=path" is a local file, but a URL containing "=" is not', () => {
    expect(parseSetsFile('3-1=saved/page.html\n' + INVENTORY_URL('4-1'))).toEqual([
      { type: 'local', setNo: '3-1', path: 'saved/page.html' },
      { type: 'url', setNo: '4-1', url: INVENTORY_URL('4-1') },
    ]);
  });
  test('a URL without an S parameter is an error', () => {
    expect(() => parseSetsFile('https://www.bricklink.com/x.asp?T=1')).toThrow(/S parameter/);
  });
  test('the real sets.txt parses, and every set number is unique', () => {
    const entries = parseSetsFile(readFileSync('scripts/sets.txt', 'utf8'));
    expect(entries.length).toBeGreaterThan(0);
    expect(new Set(entries.map((e) => e.setNo)).size).toBe(entries.length);
  });
});

// ---------- warnings and output ----------
describe('sameRunWarnings', () => {
  test('no warning for zero or one group', () => {
    expect(sameRunWarnings('S', [])).toEqual([]);
    expect(sameRunWarnings('S', [{ date: 'Jan 1, 2024', matchIds: [1] }])).toEqual([]);
  });
  test('warns when two versions are within the threshold, with the rounded gap', () => {
    const w = sameRunWarnings('S', [
      { date: 'Jan 1, 2024', matchIds: [1] },
      { date: 'Feb 1, 2024', matchIds: [2] },
    ]);
    expect(w).toHaveLength(1);
    expect(w[0]).toContain('WARN S: "Jan 1, 2024" and "Feb 1, 2024" are 31 days apart');
  });
  test('the threshold is inclusive: 183 days warns, 184 does not', () => {
    const gap = (to: string) =>
      sameRunWarnings('S', [
        { date: 'Jan 1, 2024', matchIds: [1] },
        { date: to, matchIds: [2] },
      ]);
    expect(gap('Jul 2, 2024')).toHaveLength(1); // 183 days (2024 is a leap year)
    expect(gap('Jul 3, 2024')).toEqual([]); // 184 days
  });
  test('merged groups: the gap runs to the latest date of the group', () => {
    const w = sameRunWarnings('S', [
      { date: 'Jan 1, 2023', matchIds: [1] },
      { date: 'Jul 1, 2023 + Jul 2, 2023', matchIds: [2] },
    ]);
    expect(w).toHaveLength(1);
    expect(w[0]).toContain('are 182 days apart');
  });
});

describe('renderGenerated', () => {
  test('is a TypeScript module that round-trips the data', () => {
    const src = renderGenerated([{ setNo: 'A-1', name: 'N', sourceUrl: 'u', items: [], changes: [] }]);
    expect(src.startsWith('// GENERATED by scripts/scrape-bricklink.ts - do not edit\n')).toBe(true);
    expect(src).toContain("import type { SetInventory } from './types';");
    const json = src.slice(src.indexOf('= ') + 2, src.lastIndexOf(';'));
    expect(JSON.parse(json)).toEqual([{ setNo: 'A-1', name: 'N', sourceUrl: 'u', items: [], changes: [] }]);
    expect(src.endsWith(';\n')).toBe(true);
  });
});

// ---------- scrape ----------
describe('scrape: listed-only sets', () => {
  test('are recorded without fetching anything', async () => {
    const f = fake();
    const sets = await run(f, [{ type: 'listed', setNo: '9-1', name: 'Kit' }]);
    expect(sets).toEqual([
      { setNo: '9-1', name: 'Kit', sourceUrl: CATALOG_URL('9-1'), items: [], changes: [], noInventory: true },
    ]);
    expect(f.fetched).toEqual([]);
    expect(f.log).toEqual(['9-1: no inventory (listed only)']);
  });
});

const page = () => inventoryPage([sectionRow('Regular Items:'), itemRow({ part: 'a' })]);

describe('scrape: URL entries', () => {
  test('fetch inventory and change log, cache both, and pause politely after each', async () => {
    const f = fake();
    f.web.set(INVENTORY_URL('5-1'), { html: page() });
    f.web.set(CHANGELOG_URL('5-1'), { html: changelogPage([]) });
    const [s] = await run(f, [url('5-1')]);
    expect(s.setNo).toBe('5-1');
    expect(s.sourceUrl).toBe(INVENTORY_URL('5-1'));
    expect(s.items).toHaveLength(1);
    expect(f.fetched).toEqual([INVENTORY_URL('5-1'), CHANGELOG_URL('5-1')]);
    expect([...f.cache.keys()].sort()).toEqual(['5-1.changelog.html', '5-1.html']);
    expect(f.sleeps).toEqual([1500, 1500]);
    expect(f.log[0]).toBe('fetching 5-1');
  });
  test('use the cache without touching the network', async () => {
    const f = fake();
    f.cache.set('5-1.html', page());
    f.cache.set('5-1.changelog.html', changelogPage([{ date: 'Jan 1, 2024', text: '(Match ID 1)' }]));
    const [s] = await run(f, [url('5-1')]);
    expect(s.items).toHaveLength(1);
    expect(f.fetched).toEqual([]);
    expect(f.sleeps).toEqual([]);
  });
  test('--refresh ignores the cache and overwrites it', async () => {
    const f = fake();
    f.cache.set('5-1.html', 'stale');
    f.cache.set('5-1.changelog.html', 'stale');
    f.web.set(INVENTORY_URL('5-1'), { html: page() });
    f.web.set(CHANGELOG_URL('5-1'), { html: changelogPage([]) });
    const [s] = await run(f, [url('5-1')], { refresh: true });
    expect(s.items).toHaveLength(1);
    expect(f.cache.get('5-1.html')).toBe(page());
    expect(f.fetched).toHaveLength(2);
  });
  test('entries are scraped in file order', async () => {
    const f = fake();
    for (const n of ['1-1', '2-1', '3-1']) {
      f.cache.set(`${n}.html`, page());
      f.cache.set(`${n}.changelog.html`, changelogPage([]));
    }
    const sets = await run(f, [url('2-1'), { type: 'listed', setNo: '9-9', name: 'x' }, url('1-1'), url('3-1')]);
    expect(sets.map((s) => s.setNo)).toEqual(['2-1', '9-9', '1-1', '3-1']);
  });
});

describe('scrape: URL failures', () => {
  test('an HTTP error on the inventory stops the run and caches nothing', async () => {
    const f = fake();
    f.web.set(INVENTORY_URL('5-1'), { ok: false, status: 503, html: '' });
    await expect(run(f, [url('5-1')])).rejects.toThrow('5-1: HTTP 503');
    expect(f.cache.size).toBe(0);
  });
  test('a response without an inventory (blocked) stops the run and is not cached', async () => {
    const f = fake();
    f.web.set(INVENTORY_URL('5-1'), { html: '<HTML>captcha</HTML>' });
    await expect(run(f, [url('5-1')])).rejects.toThrow(/no inventory in response \(blocked\?\)/);
    expect(f.cache.size).toBe(0);
    expect(f.sleeps).toEqual([]);
  });
  test('a failing change log only warns; the set is still scraped with no change groups', async () => {
    const f = fake();
    f.cache.set('5-1.html', page());
    f.web.set(CHANGELOG_URL('5-1'), { ok: false, status: 500, html: '' });
    const [s] = await run(f, [url('5-1')]);
    expect(s.changes).toEqual([]);
    expect(f.warnings).toEqual(['  WARN 5-1: change log HTTP 500']);
    expect(f.cache.has('5-1.changelog.html')).toBe(false);
  });
});

describe('scrape: local files', () => {
  const entry: Entry = { type: 'local', setNo: '6-1', path: 'saved.html' };

  test('read the file, link to the BrickLink inventory page and skip the change log fetch', async () => {
    const f = fake();
    f.files.set('saved.html', inventoryPage([itemRow({ part: 'z' })]));
    const [s] = await run(f, [entry]);
    expect(s.sourceUrl).toBe(INVENTORY_URL('6-1'));
    expect(s.items[0].partId).toBe('z');
    expect(s.changes).toEqual([]);
    expect(f.fetched).toEqual([]);
  });
  test('still use a cached change log', async () => {
    const f = fake();
    f.files.set('saved.html', twoAlternates);
    f.cache.set('6-1.changelog.html', changelogPage([{ date: 'Jan 1, 2024', text: '(Match ID 1)' }]));
    const [s] = await run(f, [entry]);
    expect(s.changes).toEqual([{ date: 'Jan 1, 2024', matchIds: [1] }]);
  });
  test('--refresh ignores the cached change log (and a local file has nothing to refetch)', async () => {
    const f = fake();
    f.files.set('saved.html', twoAlternates);
    f.cache.set('6-1.changelog.html', changelogPage([{ date: 'Jan 1, 2024', text: '(Match ID 1)' }]));
    const [s] = await run(f, [entry], { refresh: true });
    expect(s.changes).toEqual([]);
  });
  test('a missing file is an error', async () => {
    await expect(run(fake(), [entry])).rejects.toThrow('ENOENT saved.html');
  });
});

describe('scrape: diagnostics', () => {
  const close = changelogPage([
    { date: 'Jan 1, 2024', text: '(Match ID 1)' },
    { date: 'Feb 1, 2024', text: '(Match ID 2)' },
  ]);
  const far = changelogPage([
    { date: 'Jan 1, 2024', text: '(Match ID 1)' },
    { date: 'Jan 1, 2025', text: '(Match ID 2)' },
  ]);
  const setup = (changelog: string) => {
    const f = fake();
    f.cache.set('7-1.html', twoAlternates);
    f.cache.set('7-1.changelog.html', changelog);
    return f;
  };

  test('summary line lists items, change groups and the derived versions', async () => {
    const f = setup(far);
    await run(f, [url('7-1')]);
    expect(f.log).toEqual([
      '7-1: 4 items, 2 dated change groups, versions: Original | Update Jan 1, 2024 | Update Jan 1, 2025',
    ]);
    expect(f.warnings).toEqual([]);
  });
  test('warns about versions that are probably the same production run', async () => {
    const f = setup(close);
    await run(f, [url('7-1')]);
    expect(f.warnings).toHaveLength(1);
    expect(f.warnings[0]).toContain('WARN 7-1: "Jan 1, 2024" and "Feb 1, 2024" are 31 days apart');
  });
  test('no such warning once the dates are merged via mergeDates', async () => {
    const f = setup(close);
    await run(f, [url('7-1')], { data: { ...noData, merge: { '7-1': [['Jan 1, 2024', 'Feb 1, 2024']] } } });
    expect(f.warnings).toEqual([]);
  });
  test('hand-written version overrides are not second-guessed about dates', async () => {
    const f = setup(close);
    const overrides: Record<string, VersionDef[]> = {
      '7-1': [{ id: 'o', name: 'Only', alternates: [1, 2] }],
    };
    await run(f, [url('7-1')], { data: { ...noData, overrides } });
    expect(f.warnings).toEqual([]);
    expect(f.log[0]).toContain('versions: Only');
  });
  test('warns about alternates that no version uses', async () => {
    const f = setup(far);
    const overrides: Record<string, VersionDef[]> = {
      '7-1': [{ id: 'o', name: 'Only', alternates: [1] }],
    };
    await run(f, [url('7-1')], { data: { ...noData, overrides } });
    expect(f.warnings).toEqual(['  WARN 7-1: match ID 2 not in any version']);
  });
  test('extra versions are included in the summary', async () => {
    const f = setup(far);
    const extra: Record<string, VersionDef[]> = { '7-1': [{ id: 'x', name: 'Extra one', alternates: [] }] };
    await run(f, [url('7-1')], { data: { ...noData, extra } });
    expect(f.log[0]).toMatch(/Update Jan 1, 2025 \| Extra one$/);
  });
});

// ---------- regression against the committed data ----------
describe('parser output matches the committed generated data', () => {
  const generatedBy = (n: string) => generated.find((s) => s.setNo === n)!;

  test('2000414-4 fixture', () => {
    const parsed = parseInventory(readFileSync('fixtures/2000414-4.html', 'latin1'), '2000414-4', 'x');
    const g = generatedBy('2000414-4');
    expect(parsed.name).toBe(g.name);
    expect(parsed.items).toEqual(g.items);
  });
  test('2000430-2 change log fixture', () => {
    expect(parseChangelog(readFileSync('fixtures/2000430-2.changelog.html', 'latin1'))).toEqual(
      generatedBy('2000430-2').changes,
    );
  });
  // The cache is not in git, so this extra check only runs on a machine that has scraped before.
  const cached = existsSync('scripts/cache')
    ? readdirSync('scripts/cache').filter((n) => /^\d+-\d+\.html$/.test(n))
    : [];
  test.skipIf(!cached.length)('every cached page re-parses to exactly what is committed', () => {
    for (const file of cached) {
      const setNo = file.replace('.html', '');
      const g = generatedBy(setNo);
      const inv = parseInventory(readFileSync(`scripts/cache/${file}`, 'latin1'), setNo, g.sourceUrl);
      const log = readFileSync(`scripts/cache/${setNo}.changelog.html`, 'latin1');
      expect({ ...inv, changes: parseChangelog(log) }, setNo).toEqual(g);
    }
  });
});

describe('listed-only and inventory sets in the committed data stay consistent', () => {
  test('sets.txt and the generated data list the same sets in the same order', () => {
    const wanted = parseSetsFile(readFileSync('scripts/sets.txt', 'utf8')).map((e) => e.setNo);
    expect(generated.map((s) => s.setNo)).toEqual(wanted);
  });
  test('listed-only sets are exactly the "!" entries', () => {
    const listed = parseSetsFile(readFileSync('scripts/sets.txt', 'utf8'))
      .filter((e) => e.type === 'listed')
      .map((e) => e.setNo);
    expect(generated.filter((s) => s.noInventory).map((s) => s.setNo)).toEqual(listed);
  });
});
