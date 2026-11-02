// What `npm run dev` runs. Local testing edits a git-ignored copy of the starter workspace, so
// clicking around never changes data/, which is what the repo ships. Delete data.local/ for a fresh
// copy. Setting DATA_DIR yourself skips all of this.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedLocalData } from './localData.js';

if (!process.env.DATA_DIR) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const local = path.join(root, 'data.local');
  if (seedLocalData(path.join(root, 'data'), local)) console.log('Copied data/ to data.local/ for local testing.');
  process.env.DATA_DIR = local;
}

await import('./index.js');
