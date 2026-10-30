/**
 * Usage: npm run scrape            (reads scripts/sets.txt, caches pages in scripts/cache)
 *        npm run scrape -- --refresh   (ignore cache)
 *        Entries in sets.txt may be a URL or a path to a saved HTML file ("setNo=path.html").
 * The logic lives in scrape-lib.ts (tested); this file only does the real I/O.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { argv } from 'node:process';
import { versionOverrides, extraVersions, mergeDates } from '../src/data/versions';
import { parseSetsFile, renderGenerated, scrape, type Io } from './scrape-lib';

const cacheDir = 'scripts/cache';
mkdirSync(cacheDir, { recursive: true });

const io: Io = {
  readCache: (name) => (existsSync(`${cacheDir}/${name}`) ? readFileSync(`${cacheDir}/${name}`, 'latin1') : undefined),
  writeCache: (name, html) => writeFileSync(`${cacheDir}/${name}`, html, 'latin1'),
  readFile: (path) => readFileSync(path, 'latin1'),
  fetchHtml: async (url) => {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    return { ok: res.ok, status: res.status, html: Buffer.from(await res.arrayBuffer()).toString('latin1') };
  },
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

const sets = await scrape({
  entries: parseSetsFile(readFileSync('scripts/sets.txt', 'utf8')),
  refresh: argv.includes('--refresh'),
  io,
  data: { overrides: versionOverrides, extra: extraVersions, merge: mergeDates },
  log: console.log,
  warn: console.warn,
});

writeFileSync('src/data/sets.generated.ts', renderGenerated(sets));
console.log(`wrote src/data/sets.generated.ts (${sets.length} sets)`);
