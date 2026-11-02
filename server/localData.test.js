import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { seedLocalData } from './localData.js';

function folders(t) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clique-dev-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const from = path.join(tmp, 'data');
  fs.mkdirSync(path.join(from, 'projects', 'one'), { recursive: true });
  fs.writeFileSync(path.join(from, 'workspace.yaml'), 'name: starter\n');
  fs.writeFileSync(path.join(from, 'projects', 'one', 'index.md'), 'starter\n');
  return { from, to: path.join(tmp, 'data.local') };
}

test('the first run copies the starter workspace, without the bin', (t) => {
  const { from, to } = folders(t);
  fs.mkdirSync(path.join(from, '.trash'));
  fs.writeFileSync(path.join(from, '.trash', 'deleted.md'), 'gone\n');

  assert.equal(seedLocalData(from, to), true);
  assert.equal(fs.readFileSync(path.join(to, 'projects', 'one', 'index.md'), 'utf8'), 'starter\n');
  assert.equal(fs.existsSync(path.join(to, '.trash')), false);
});

test('later runs keep local edits, and edits never reach the starter workspace', (t) => {
  const { from, to } = folders(t);
  seedLocalData(from, to);
  const edited = path.join(to, 'projects', 'one', 'index.md');
  fs.writeFileSync(edited, 'edited\n');

  assert.equal(seedLocalData(from, to), false);
  assert.equal(fs.readFileSync(edited, 'utf8'), 'edited\n');
  assert.equal(fs.readFileSync(path.join(from, 'projects', 'one', 'index.md'), 'utf8'), 'starter\n');
});
