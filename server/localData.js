import fs from 'node:fs';
import path from 'node:path';

// Copies the starter workspace once, then leaves the copy alone. The bin stays behind: it holds
// deleted pages and has no place in a starting point.
export function seedLocalData(from, to) {
  if (fs.existsSync(to)) return false;
  fs.cpSync(from, to, { recursive: true, filter: (src) => path.basename(src) !== '.trash' });
  return true;
}
