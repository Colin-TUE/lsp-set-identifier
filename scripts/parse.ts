import type { Item, Kind, SetInventory } from '../src/data/types';

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&#40;': '(',
  '&#41;': ')',
  '&quot;': '"',
  '&#39;': "'",
  '&lt;': '<',
  '&gt;': '>',
};

// Single pass so decoded output is never re-decoded (avoids double-unescaping).
const decode = (s: string) =>
  s.replace(/&(?:nbsp|amp|quot|lt|gt|#40|#41|#39);/g, (m) => ENTITIES[m]);

const SECTIONS: Record<string, Kind> = {
  'Regular Items:': 'regular',
  'Extra Items:': 'extra',
  'Counterparts:': 'counterpart',
  'Alternate Items:': 'alternate',
};

function parseName(html: string, setNo: string): string {
  const title = /Serious Play[^<]*?(?=\s*\*?\s*This Set Consists|<)/.exec(html);
  const nameMatch = /<B>([^<]*)<\/B>\s*<\/A>\s*[^<]*<\/FONT>/.exec(html);
  return decode(title?.[0] ?? nameMatch?.[1] ?? setNo)
    .replace(/\*$/, '')
    .trim();
}

/** Section header row ("Regular Items:" etc.), or null if the row is not one. */
function parseSection(row: string): Kind | null {
  const sec = /<B>([A-Za-z ]+:)<\/B><\/FONT><\/TD><\/TR>/.exec(row);
  return sec && SECTIONS[sec[1]] && /COLOR="#FFFFFF"/.test(row) ? SECTIONS[sec[1]] : null;
}

/** Split "<colour> <name>" (bold text) using the name from the image alt text. */
function splitColorName(boldText: string, altName: string): { colorName: string; display: string } {
  const nm = altName.replace(/\s+/g, ' ');
  const boldN = boldText.replace(/\s+/g, ' ');
  const hasName = nm !== '' && boldN.endsWith(nm);
  return {
    colorName: hasName ? boldN.slice(0, boldN.length - nm.length).trim() : '',
    display: hasName ? nm : boldN,
  };
}

function parseItem(row: string, kind: Kind): Item | null {
  if (!/class="IV_[^"]*IV_ITEM/.test(row)) return null;
  const link = /catalogitem\.page\?([PGM])=([^&"']+)(?:&idColor=(\d+))?/i.exec(row);
  if (!link) return null;
  const qty = Number(/<TD ALIGN="RIGHT">&nbsp;(\d+)&nbsp;<\/TD>/.exec(row)?.[1] ?? 0);
  const bold = decode(/<TD>\s*<B>([^<]*)<\/B>/.exec(row)?.[1] ?? '').trim();
  const nameAlt = decode(/Name:\s*([^"]*)"/.exec(row)?.[1] ?? '').trim();
  const { colorName, display } = splitColorName(bold, nameAlt);
  const mid = /<TD ALIGN="RIGHT"><TABLE[^>]*><TR><TD><FONT[^>]*>(\d+)&nbsp;/.exec(row);
  return {
    type: link[1].toUpperCase(),
    partId: decodeURIComponent(link[2]),
    colorId: Number(link[3] ?? 0),
    colorName: colorName || '(none)',
    name: display,
    qty,
    kind,
    matchId: mid ? Number(mid[1]) : 0,
  };
}

export function parseInventory(html: string, setNo: string, sourceUrl: string): SetInventory {
  const items: Item[] = [];
  let kind: Kind = 'regular';
  // Split into table rows (rows are not nested except the MID cell's inner table).
  const rows = html.split(/<TR (?=class="IV_|BGCOLOR="#000000"|BGCOLOR="#C0C0C0")/i).slice(1);
  for (const row of rows) {
    const section = parseSection(row);
    if (section) kind = section;
    else {
      const item = parseItem(row, kind);
      if (item) items.push(item);
    }
  }
  return { setNo, name: parseName(html, setNo), sourceUrl, items, changes: [] };
}

export interface ChangeGroup {
  date: string;
  matchIds: number[];
}

/** Parse the BrickLink inventory change log: alternate Match IDs introduced per date (ascending). */
export function parseChangelog(html: string): ChangeGroup[] {
  // Splitting on a capture group yields [text before, date1, text after date1, date2, ...].
  const parts = html.split(/<B>&nbsp;([A-Z][a-z]{2} \d{1,2}, \d{4})<\/B>/).slice(1);
  const groups: ChangeGroup[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const ids = new Set<number>();
    for (const m of parts[i + 1].matchAll(/\(Match ID (\d+)\)|\{Match ID \d+ to (\d+)\s*\}/gi)) {
      const n = Number(m[1] ?? m[2]);
      if (n > 0) ids.add(n);
    }
    if (ids.size) groups.push({ date: parts[i], matchIds: [...ids].sort((a, b) => a - b) });
  }
  return groups.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}
