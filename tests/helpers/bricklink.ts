/** Minimal BrickLink-shaped HTML, just enough for the parser's patterns. */

export const sectionRow = (title: string, o: { white?: boolean } = {}) =>
  `<TR BGCOLOR="#000000"><TD COLSPAN="5" ALIGN="CENTER"><FONT FACE="Tahoma" SIZE="2"${o.white === false ? '' : ' COLOR="#FFFFFF"'}><B>${title}</B></FONT></TD></TR>`;

export interface ItemOpts {
  part?: string;
  type?: string;
  /** undefined = no idColor in the link */
  color?: number;
  /** undefined = no quantity cell */
  qty?: number;
  /** Bold text: "<colour> <name>" */
  bold?: string;
  /** Name from the image alt text */
  alt?: string;
  mid?: number;
  /** Row without the IV_ITEM class */
  plain?: boolean;
  /** Row without a catalog link */
  noLink?: boolean;
}

const DEFAULTS: ItemOpts = { part: '3001', type: 'P', color: 5, qty: 2, bold: 'Red Brick 2 x 4', alt: 'Brick 2 x 4' };

// Passing an option explicitly as `undefined` leaves that cell out of the row.
const imgCell = (v: ItemOpts) => (v.alt === undefined ? '' : `<TD><IMG ALT="Part No: ${v.part}  Name: ${v.alt}"></TD>`);
const qtyCell = (v: ItemOpts) => (v.qty === undefined ? '' : `<TD ALIGN="RIGHT">&nbsp;${v.qty}&nbsp;</TD>`);
const colorQuery = (v: ItemOpts) => (v.color === undefined ? '' : `&idColor=${v.color}`);
const linkCell = (v: ItemOpts) =>
  v.noLink ? '' : `<TD><A HREF="/v2/catalog/catalogitem.page?${v.type}=${v.part}${colorQuery(v)}">${v.part}</A></TD>`;
const boldCell = (v: ItemOpts) => (v.bold === '' ? '<TD></TD>' : `<TD><B>${v.bold}</B></TD>`);
const midCell = (v: ItemOpts) =>
  v.mid
    ? `<TD ALIGN="RIGHT"><TABLE BORDER="0"><TR><TD><FONT SIZE="1">${v.mid}&nbsp;</FONT></TD></TR></TABLE></TD>`
    : '';

export function itemRow(o: ItemOpts = {}): string {
  const v = { ...DEFAULTS, ...o };
  const cls = v.plain ? 'IV_X' : `IV_${v.part} IV_ITEM`;
  const cells = [imgCell(v), qtyCell(v), linkCell(v), boldCell(v), midCell(v)];
  return `<TR class="${cls}" BGCOLOR="#FFFFFF">${cells.join('')}</TR>`;
}

export const inventoryPage = (rows: string[], head = '') =>
  `<HTML><BODY>${head}<TABLE>${rows.join('')}</TABLE></BODY></HTML>`;

/** Change log page: one block per date with free text containing Match ID notes. */
export const changelogPage = (entries: { date: string; text: string }[]) =>
  `<HTML>junk <B>&nbsp;Not a date</B>${entries.map((e) => `<B>&nbsp;${e.date}</B> ${e.text} <BR>`).join('')}</HTML>`;
