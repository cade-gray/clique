// Append-only event log: DATA_DIR/events.ndjson, one JSON object per line.
//
// A project's markdown file holds its *current* state, so moving a card overwrites the
// status that was there before and nothing records that the move happened. This log is
// the only record of how work moved over time, which is what the delivery figures on the
// stats page read. It is append-only and plain text, so it can be read, grepped and
// backed up like the rest of the data folder.
//
// Lines look like:
//   {"at":"2026-10-18T09:00:00.000Z","type":"created","project":"foo","title":"Foo","to":"backlog"}
//   {"at":"2026-10-18T11:30:00.000Z","type":"status","project":"foo","title":"Foo","from":"backlog","to":"live"}

import fs from 'node:fs/promises';

export const EVENT_TYPES = ['log-started', 'created', 'status', 'deleted'];

export class EventLog {
  constructor(file) {
    this.file = file;
    // Serialises appends within this process so two writes can't interleave mid-line.
    this.tail = Promise.resolve();
  }

  // Never rejects. The caller's project write has already succeeded by this point, and
  // losing a line of history is not a good reason to fail someone's edit, so a failure
  // is logged and swallowed. Returns a promise the caller can await for ordering.
  append(event) {
    const line = `${JSON.stringify(event)}\n`;
    this.tail = this.tail.then(() =>
      fs.appendFile(this.file, line, 'utf8').catch((e) => {
        console.error(`Clique could not write to the event log ${this.file}: ${e.message}`);
      }),
    );
    return this.tail;
  }

  async appendAll(events) {
    for (const e of events) await this.append(e);
  }

  // Oldest first. A line that can't be used (half-written during a crash, hand-edited,
  // an event type from a newer version) is skipped rather than failing the whole read.
  async read() {
    let text;
    try {
      text = await fs.readFile(this.file, 'utf8');
    } catch (e) {
      if (e.code === 'ENOENT') return [];
      throw e;
    }
    const out = [];
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      let e;
      try {
        e = JSON.parse(line);
      } catch {
        continue;
      }
      if (!e || typeof e !== 'object' || !EVENT_TYPES.includes(e.type)) continue;
      const at = new Date(e.at);
      if (Number.isNaN(at.getTime())) continue;
      out.push({ ...e, at: at.toISOString() });
    }
    // Backfilled entries carry their original timestamps, so the file is not necessarily
    // in date order even though appends are.
    return out.sort((a, b) => a.at.localeCompare(b.at));
  }
}
