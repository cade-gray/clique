import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { Store } from './store.js';
import { readXlsx } from './xlsx.js';
import { parseDate, parsePlannerWorkbook, importPlannerTasks } from './planner.js';

// ---------- building test workbooks ----------

function zip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content);
    const comp = zlib.deflateRawSync(data);
    const nameBuf = Buffer.from(name);
    const crc = zlib.crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, comp);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8);
  eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const colName = (i) => String.fromCharCode(65 + i);

// Strings go to the shared string table (as Excel writes them); numbers are stored as values.
function workbook(sheetName, rows) {
  const shared = [];
  const sheetRows = rows
    .map((row, r) => {
      const cells = row
        .map((v, c) => {
          if (v === null || v === undefined) return '';
          const ref = `${colName(c)}${r + 1}`;
          if (typeof v === 'number') return `<c r="${ref}"><v>${v}</v></c>`;
          shared.push(v);
          return `<c r="${ref}" t="s"><v>${shared.length - 1}</v></c>`;
        })
        .join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');
  return zip({
    '[Content_Types].xml': '<Types/>',
    'xl/workbook.xml': `<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/sharedStrings.xml': `<sst>${shared.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join('')}</sst>`,
    'xl/worksheets/sheet1.xml': `<worksheet><sheetData>${sheetRows}</sheetData></worksheet>`,
  });
}

// The classic Planner layout: plan details, a blank row, then the task table.
function plannerExport() {
  return workbook('Core Ops', [
    ['Plan name', 'Core Ops'],
    ['Plan ID', 'abc123'],
    ['Date of export', '10/17/2026'],
    [],
    ['Task ID', 'Task Name', 'Bucket Name', 'Progress', 'Priority', 'Assigned To', 'Created By', 'Created Date', 'Start Date', 'Due Date', 'Is Recurring', 'Late', 'Completed Date', 'Completed By', 'Completed Checklist Items', 'Checklist Items', 'Labels', 'Description'],
    ['t1', 'Renew vendor cert', 'Doing', 'In progress', 'Urgent', 'Alex Smith;Priya Patel', 'Sam Lee', '09/01/2026', '09/02/2026', '11/30/2026', 'false', 'false', '', '', '1/2', 'Request CSR;Install cert', 'Security;Vendor', 'Cert expires Dec 1.\r\nOwner: Alex'],
    ['t2', 'Archive old reports', 'Done', 'Completed', 'Low', '', 'Sam Lee', '08/01/2026', '', '', 'false', 'false', '08/20/2026', 'Sam Lee', '2/2', 'Export;Delete', '', ''],
    ['t3', 'Plan Q1 roadmap', 'To do', 'Not started', 'Medium', 'Jordan Kim', 'Sam Lee', '10/01/2026', '', 46022, 'false', 'false', '', '', '', '', '', 'A & B <draft>'],
  ]);
}

async function freshStore() {
  const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'clique-planner-')));
  await store.init();
  return store;
}

// ---------- tests ----------

test('xlsx reader returns sheet rows with shared strings, numbers and gaps', () => {
  const [sheet] = readXlsx(workbook('Data', [['a', null, 3], [], ['x & y']]));
  assert.equal(sheet.name, 'Data');
  assert.deepEqual(sheet.rows, [['a', null, 3], [], ['x & y']]);
  assert.throws(() => readXlsx(Buffer.from('not a zip at all, just some text')));
});

test('dates: Excel serials, ISO, US and day-first when unambiguous', () => {
  assert.equal(parseDate(46022), '2025-12-31');
  assert.equal(parseDate('2026-11-30T00:00:00Z'), '2026-11-30');
  assert.equal(parseDate('11/30/2026'), '2026-11-30');
  assert.equal(parseDate('30/11/2026'), '2026-11-30');
  assert.equal(parseDate('2/3/26'), '2026-02-03');
  assert.equal(parseDate('13/13/2026'), '');
  assert.equal(parseDate(''), '');
});

test('a Planner export is parsed into tasks and buckets', () => {
  const r = parsePlannerWorkbook(plannerExport());
  assert.equal(r.planName, 'Core Ops');
  assert.deepEqual(r.buckets, [
    { name: 'Doing', count: 1 },
    { name: 'Done', count: 1 },
    { name: 'To do', count: 1 },
  ]);
  const [a, b, c] = r.tasks;
  assert.equal(a.title, 'Renew vendor cert');
  assert.deepEqual(a.assignees, ['Alex Smith', 'Priya Patel']);
  assert.deepEqual(a.labels, ['Security', 'Vendor']);
  assert.equal(a.dueDate, '2026-11-30');
  assert.equal(a.description, 'Cert expires Dec 1.\nOwner: Alex');
  // A partial count can't say which item is done, so none are marked.
  assert.deepEqual(a.checklist, [{ text: 'Request CSR', done: false }, { text: 'Install cert', done: false }]);
  assert.deepEqual(b.checklist.map((x) => x.done), [true, true]);
  assert.equal(b.progress, 'Completed');
  assert.equal(b.completedDate, '2026-08-20');
  assert.equal(c.dueDate, '2025-12-31');
  assert.equal(c.description, 'A & B <draft>');
});

test('header matching tolerates other Planner layouts', () => {
  const r = parsePlannerWorkbook(
    workbook('Tasks', [
      ['Task title', 'Bucket', 'Assignments', 'Due date', 'Labels'],
      ['One', 'Backlog', 'Alex', '2026-12-01', ''],
    ]),
  );
  assert.equal(r.planName, 'Tasks');
  assert.deepEqual(r.tasks.map((t) => [t.title, t.bucket, t.assignees, t.dueDate]), [['One', 'Backlog', ['Alex'], '2026-12-01']]);
  assert.throws(() => parsePlannerWorkbook(workbook('X', [['Foo', 'Bar'], ['1', '2']])), (e) => e.status === 400);
  assert.throws(() => parsePlannerWorkbook(Buffer.from('hello')), (e) => e.status === 400);
});

test('import creates one project per task in the chosen columns', async () => {
  const store = await freshStore();
  const before = (await store.listProjects()).length;
  const { tasks } = parsePlannerWorkbook(plannerExport());
  const result = await importPlannerTasks(store, tasks, { Doing: 'in-progress', Done: 'live', 'To do': '' });
  assert.equal(result.created.length, 2);
  assert.equal(result.skipped, 1);
  assert.equal((await store.listProjects()).length, before + 2);

  const p = await store.getProject(result.created[0].id);
  assert.equal(p.title, 'Renew vendor cert');
  assert.equal(p.status, 'in-progress');
  assert.deepEqual(p.properties.owner, ['Alex Smith', 'Priya Patel']);
  assert.equal(p.properties.due, '2026-11-30');
  assert.equal(p.properties.priority, 'High'); // Urgent -> closest option in the default workspace
  assert.deepEqual(p.subtasks.map((s) => s.text), ['Request CSR', 'Install cert']);
  assert.match(p.body, /^Cert expires Dec 1\.\n\nOwner: Alex\n\n\*\*Imported from Microsoft Planner\*\*/);
  assert.match(p.body, /- Labels: Security, Vendor/);
  assert.match(p.body, /- Planner task ID: `t1`/);

  const done = await store.getProject(result.created[1].id);
  assert.equal(done.status, 'live');
  assert.ok(done.subtasks.every((s) => s.done && s.doneAt.startsWith('2026-08-20')));

  // Importing again creates new projects rather than touching the existing ones.
  const again = await importPlannerTasks(store, tasks, { Doing: 'in-progress' });
  assert.equal(again.created[0].id, 'renew-vendor-cert-2');
  await assert.rejects(importPlannerTasks(store, tasks, { Doing: 'nope' }), (e) => e.status === 400);
});
