// Minimal .xlsx reader: just enough to get cell values out of an Excel export, without a dependency.
// An .xlsx file is a zip of XML parts; we read the sheets, their shared strings, and each cell's
// raw value. Formatting is ignored, so dates stored as numbers come back as Excel serial numbers.

import zlib from 'node:zlib';

// Guards against a small upload that inflates into something huge.
const MAX_PART_BYTES = 100 * 1024 * 1024;

export function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Corrupt zip directory');
    const nameLen = buf.readUInt16LE(p + 28);
    entries.set(buf.toString('utf8', p + 46, p + 46 + nameLen), {
      method: buf.readUInt16LE(p + 10),
      size: buf.readUInt32LE(p + 20),
      offset: buf.readUInt32LE(p + 42),
    });
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return {
    has: (name) => entries.has(name),
    read(name) {
      const e = entries.get(name);
      if (!e) return null;
      if (buf.readUInt32LE(e.offset) !== 0x04034b50) throw new Error('Corrupt zip entry');
      const start = e.offset + 30 + buf.readUInt16LE(e.offset + 26) + buf.readUInt16LE(e.offset + 28);
      const data = buf.subarray(start, start + e.size);
      if (e.method === 0) return data.toString('utf8');
      if (e.method === 8) return zlib.inflateRawSync(data, { maxOutputLength: MAX_PART_BYTES }).toString('utf8');
      throw new Error(`Unsupported zip compression ${e.method}`);
    },
  };
}

// XML entities plus Excel's _xHHHH_ escapes (used for characters such as carriage returns).
export function decodeXml(s) {
  return s
    .replace(/&(?:#x([0-9a-f]+)|#(\d+)|(amp|lt|gt|quot|apos));/gi, (_, hex, dec, named) =>
      hex ? String.fromCodePoint(parseInt(hex, 16)) : dec ? String.fromCodePoint(Number(dec)) : { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[named.toLowerCase()],
    )
    .replace(/_x([0-9a-f]{4})_/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

const attr = (attrs, name) => attrs.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];

// All text runs inside an element, skipping phonetic hints (<rPh>) that Excel adds for some languages.
function textOf(xml) {
  let out = '';
  for (const m of xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)) out += m[1] ?? '';
  return decodeXml(out);
}

// "C12" -> 2 (zero-based column index).
function columnIndex(ref) {
  let n = 0;
  for (const ch of ref.match(/^[A-Z]+/)?.[0] ?? '') n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseSheet(xml, shared) {
  const rows = [];
  for (const rm of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rowNum = Number(attr(rm[1], 'r')) || rows.length + 1;
    const row = [];
    for (const cm of (rm[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attr(cm[1], 'r');
      const col = ref ? columnIndex(ref) : row.length;
      const type = attr(cm[1], 't');
      const body = cm[2] ?? '';
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = null;
      if (type === 's') value = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') value = textOf(body);
      else if (type === 'str' || type === 'e') value = v === undefined ? '' : decodeXml(v);
      else if (type === 'b') value = v === '1';
      else if (v !== undefined) value = Number(v);
      row[col] = value;
    }
    rows[rowNum - 1] = row;
  }
  return Array.from(rows, (r) => Array.from(r ?? [], (v) => v ?? null));
}

// Returns [{ name, rows }] in workbook order; rows are arrays of string | number | boolean | null.
export function readXlsx(buf) {
  const zip = readZip(buf);
  const workbook = zip.read('xl/workbook.xml');
  if (!workbook) throw new Error('Not an Excel workbook');
  const shared = [];
  const sst = zip.read('xl/sharedStrings.xml');
  if (sst) for (const m of sst.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)) shared.push(m[1] ? textOf(m[1]) : '');
  const targets = {};
  const rels = zip.read('xl/_rels/workbook.xml.rels') ?? '';
  for (const m of rels.matchAll(/<Relationship\b([^>]*)>/g)) targets[attr(m[1], 'Id')] = attr(m[1], 'Target');
  const sheets = [];
  for (const m of workbook.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const target = targets[attr(m[1], 'r:id')];
    if (!target) continue;
    const file = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
    const xml = zip.read(file);
    if (xml) sheets.push({ name: decodeXml(attr(m[1], 'name') ?? ''), rows: parseSheet(xml, shared) });
  }
  return sheets;
}
