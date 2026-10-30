export type Kind = 'regular' | 'extra' | 'counterpart' | 'alternate';

export interface Item {
  type: string; // P | G | M
  partId: string;
  colorId: number;
  colorName: string;
  name: string;
  qty: number;
  kind: Kind;
  /** Match ID shown in BrickLink MID column. Regular + its alternate share an id. 0 = none. */
  matchId: number;
}

export interface SetInventory {
  setNo: string;
  name: string;
  sourceUrl: string;
  items: Item[];
  /** True for sets BrickLink has no inventory for; listed only, never matched. */
  noInventory?: boolean;
  /** From the BrickLink change log: alternate Match IDs introduced per date (ascending). */
  changes: { date: string; matchIds: number[] }[];
}

/** Hand-maintained: a version is a set of match IDs whose alternates replace the regular items. */
export interface VersionDef {
  id: string;
  name: string;
  alternates: number[];
  pending?: boolean;
  note?: string;
}

export interface ResolvedVersion {
  key: string; // setNo/versionId
  setNo: string;
  setName: string;
  id: string;
  name: string;
  pending: boolean;
  parts: Item[]; // resolved regular parts
  extras: Item[];
}

export const itemKey = (i: Pick<Item, 'partId' | 'colorId'>) => `${i.partId}:${i.colorId}`;
export const imgUrl = (i: Pick<Item, 'type' | 'partId' | 'colorId'>) =>
  i.type === 'P'
    ? `https://img.bricklink.com/P/${i.colorId}/${i.partId}.jpg`
    : i.type === 'G'
      ? `https://img.bricklink.com/G/${i.partId}.jpg`
      : `https://img.bricklink.com/M/${i.partId}.jpg`;
