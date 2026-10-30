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
  // From BrickLink inventory change request https://www.bricklink.com/message.asp?ID=1551670 (not yet approved).
  // Builds on the 2023 update (Match IDs 1-3, on the page) and adds the swaps and spares from the request.
  '2000430-2': [
    {
      id: '2026',
      name: '2026 update (from open change request, pending BrickLink approval)',
      alternates: [1, 2, 3],
      pending: true,
      swaps: [
        { from: { partId: '3003', colorId: 42 }, to: { partId: '3003', colorId: 156, colorName: 'Medium Azure' } },
        { from: { partId: '3001', colorId: 42 }, to: { partId: '3001', colorId: 156, colorName: 'Medium Azure' } },
        { from: { partId: '3624', colorId: 42 }, to: { partId: '3624', colorId: 63, colorName: 'Dark Blue' } },
        { from: { partId: '3066', colorId: 13 }, to: { partId: '3066', colorId: 251, colorName: 'Trans-Black' } },
        { from: { partId: '10312pb03', colorId: 13 }, to: { partId: '10312', colorId: 251, colorName: 'Trans-Black', name: 'Windscreen 10 x 6 x 3 Bubble Canopy Double Tapered with Square Front Cutout' } },
        { from: { partId: '3957b', colorId: 16 }, to: { partId: '3957b', colorId: 12, colorName: 'Trans-Clear' } },
        { from: { partId: '2569', colorId: 16 }, to: { partId: '2569', colorId: 50, colorName: 'Trans-Dark Pink' } },
      ],
      addExtras: [
        { partId: '93061', colorId: 1, colorName: 'White', name: 'Arm Skeleton, Bent with Clips at 90 degrees (Vertical Grip)', qty: 1 },
        { partId: '6266', colorId: 1, colorName: 'White', name: 'Leg Skeleton', qty: 1 },
        { partId: '3626pb0001', colorId: 1, colorName: 'White', name: 'Minifigure, Head with Black Standard Skull Pattern', qty: 1 },
        { partId: '2446', colorId: 1, colorName: 'White', name: 'Minifigure, Headgear Helmet Motorcycle (Standard)', qty: 1 },
        { partId: '39262', colorId: 115, colorName: 'Pearl Gold', name: 'Minifigure, Headgear Crown Eggshell with 5 Points and Center Stud', qty: 4 },
      ],
    },
  ],
  // From BrickLink inventory change request https://www.bricklink.com/message.asp?ID=1551669 (not yet approved;
  // a BrickLink reviewer suggested a new set entry instead, so this may become its own set number).
  '2000431-1': [
    {
      id: '2026',
      name: '2026 update (from open change request, pending BrickLink approval)',
      alternates: [],
      pending: true,
      swaps: [
        { from: { partId: '54572', colorId: 4 }, to: { partId: '54572', colorId: 1, colorName: 'White' } },
        { from: { partId: '30000', colorId: 7 }, to: { partId: '30000', colorId: 1, colorName: 'White' } },
        { from: { partId: '57029c01', colorId: 85 }, to: { partId: '49743c01', colorId: 85, colorName: 'Dark Bluish Gray', name: 'Projectile Launcher, 2 x 6 x 1 1/3 Spring Shooter with Light Bluish Gray Top' } },
        { from: { partId: '57028pb01', colorId: 86 }, to: { partId: '46537pb01', colorId: 86, colorName: 'Light Bluish Gray', name: 'Projectile Arrow, Solid Shaft with Molded Flexible Rubber Black Cross Shaped End Pattern' } },
      ],
      removes: [{ partId: '3666', colorId: 11 }],
      setQty: [
        { partId: '2780', colorId: 11, qty: 100 },
        { partId: '3706', colorId: 11, qty: 10 },
      ],
      addParts: [
        { type: 'P', partId: '32034', colorId: 86, colorName: 'Light Bluish Gray', name: 'Technic, Axle and Pin Connector Angled #2 - 180 degrees', qty: 100 },
      ],
    },
  ],
};
