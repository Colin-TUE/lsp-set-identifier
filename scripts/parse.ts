import type { Item, Kind, SetInventory } from '../src/data/types';

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#40;/g, '(')
    .replace(/&#41;/g, ')')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const SECTIONS: Record<string, Kind> = {
  'Regular Items:': 'regular',
  'Extra Items:': 'extra',
  'Counterparts:': 'counterpart',
  'Alternate Items:': 'alternate',
};

export function parseInventory(html: string, setNo: string, sourceUrl: string): SetInventory {
  const title = /Serious Play[^<]*?(?=\s*\*?\s*This Set Consists|<)/.exec(html);
  const nameMatch = /<B>([^<]*)<\/B>\s*<\/A>\s*[^<]*<\/FONT>/.exec(html);
  const name = decode(title?.[0] ?? nameMatch?.[1] ?? setNo)
    .replace(/\*$/, '')
    .trim();

  const items: Item[] = [];
  let kind: Kind = 'regular';
  // Split into table rows (rows are not nested except the MID cell's inner table).
  const parts = html.split(/<TR (?=class="IV_|BGCOLOR="#000000"|BGCOLOR="#C0C0C0")/i).slice(1);
  for (const row of parts) {
    const sec = /<B>([A-Za-z ]+:)<\/B><\/FONT><\/TD><\/TR>/.exec(row);
    if (sec && SECTIONS[sec[1]] && /COLOR="#FFFFFF"/.test(row)) {
      kind = SECTIONS[sec[1]];
      continue;
    }
    if (!/class="IV_[^"]*IV_ITEM/.test(row)) continue;

    const link = /catalogitem\.page\?([PGM])=([^&"']+)(?:&idColor=(\d+))?/i.exec(row);
    if (!link) continue;
    const qty = Number(/<TD ALIGN="RIGHT">&nbsp;(\d+)&nbsp;<\/TD>/.exec(row)?.[1] ?? 0);
    const bold = decode(/<TD>\s*<B>([^<]*)<\/B>/.exec(row)?.[1] ?? '').trim();
    const nameAlt = decode(/Name:\s*([^"]*)"/.exec(row)?.[1] ?? '').trim();
    const nm = nameAlt.replace(/\s+/g, ' ');
    const boldN = bold.replace(/\s+/g, ' ');
    const colorName = nm && boldN.endsWith(nm) ? boldN.slice(0, boldN.length - nm.length).trim() : '';
    const display = nm && boldN.endsWith(nm) ? nm : boldN;
    const mid = /<TD ALIGN="RIGHT"><TABLE[^>]*><TR><TD><FONT[^>]*>(\d+)&nbsp;/.exec(row);
    items.push({
      type: link[1].toUpperCase(),
      partId: decodeURIComponent(link[2]),
      colorId: Number(link[3] ?? 0),
      colorName: colorName || '(none)',
      name: display,
      qty,
      kind,
      matchId: mid ? Number(mid[1]) : 0,
    });
  }
  return { setNo, name, sourceUrl, items, changes: [] };
}

export interface ChangeGroup {
  date: string;
  matchIds: number[];
}

/** Parse the BrickLink inventory change log: alternate Match IDs introduced per date (ascending). */
export function parseChangelog(html: string): ChangeGroup[] {
  const chunks = html.split(/<B>&nbsp;(?=[A-Z][a-z]{2} \d{1,2}, \d{4}<\/B>)/).slice(1);
  const groups = chunks
    .map((c) => {
      const date = /^([A-Z][a-z]{2} \d{1,2}, \d{4})/.exec(c)![1];
      const ids = new Set<number>();
      for (const m of c.matchAll(
        /\((?:Match ID (\d+))\)|\{Match ID \d+ to (\d+)\s*\}|\{match ID \d+ to (\d+)\s*\}/gi,
      )) {
        const n = Number(m[1] ?? m[2] ?? m[3]);
        if (n > 0) ids.add(n);
      }
      return { date, matchIds: [...ids].sort((a, b) => a - b) };
    })
    .filter((g) => g.matchIds.length);
  return groups.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}
