import type { VersionDef } from './types';

/**
 * Versions are derived automatically from the BrickLink change log:
 * "Original", then one cumulative version per change date (see src/logic/versions.ts).
 * The three exports below let you correct that. Re-run `pnpm scrape` is NOT needed for edits here;
 * they are applied when the site is built.
 */

/**
 * mergeDates: treat several change-log dates as ONE version (same production run).
 * Key = set number, value = list of groups, each group a list of dates exactly as printed in the
 * scraper output / change log. Dates not mentioned stay separate versions.
 * The merged version is named "Update Jul 1, 2023 + Jul 2, 2023".
 */
export const mergeDates: Record<string, string[][]> = {
  '2000430-2': [['Jul 1, 2023', 'Jul 2, 2023']],
  '2000430-1': [['Jun 16, 2020', 'Jun 20, 2020']],
};

/**
 * versionOverrides: completely replace the derived versions of a set with your own list.
 * `alternates` are the Match IDs (MID column on BrickLink) whose alternate replaces the regular item.
 * Versions are not cumulative automatically here: list every Match ID in effect.
 * Example:
 *   '2000430-1': [
 *     { id: 'orig', name: 'Original', alternates: [] },
 *     { id: 'v2', name: 'Revised', alternates: [1, 2, 3] },
 *   ],
 */
export const versionOverrides: Record<string, VersionDef[]> = {};

/**
 * extraVersions: append versions to the derived list, e.g. pending BrickLink change requests that are
 * not visible on the page yet. Set `pending: true` to mark it in the UI.
 */
export const extraVersions: Record<string, VersionDef[]> = {
  '2000430-2': [
    { id: '2026', name: '2026 update (pending BrickLink approval)', alternates: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], pending: true },
  ],
};
