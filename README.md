# lsp-set-identifier

A simple website to identify which version of a LSP set you have and how to sort them back out after a workshop

## Usage

- `pnpm scrape` reads `scripts/sets.txt`, caches pages in `scripts/cache` (`-- --refresh` to refetch) and writes `src/data/sets.generated.ts`.
- Versions are derived automatically from each set's BrickLink change log: Original, then one cumulative version per change date. Edit `src/data/versions.ts` (documented inline) to correct this:
  - `mergeDates`: treat several change dates as one version, e.g. `'2000430-2': [['Jul 1, 2023', 'Jul 2, 2023']]`.
  - `versionOverrides`: replace a set's versions entirely.
  - `extraVersions`: add pending versions.
    The scraper warns when two change dates are within half a year (183 days) of each other and not merged.
- Deploy on Netlify: build `pnpm build`, publish `dist` (see `netlify.toml`).
- `pnpm install`, `pnpm dev` / `pnpm build` / `pnpm test`
