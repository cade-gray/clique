// Booking time to work on a task. Clique stores nothing about it: the event is handed straight
// to Google Calendar or Outlook on the web as a pre-filled draft, or saved as a .ics file for
// desktop Outlook, Apple Calendar and anything else that reads the standard format.

// Every block starts out as an hour tomorrow morning. Clique deliberately doesn't ask when:
// the slot is meant to be moved in the calendar itself, where the day's conflicts are visible.
export const BLOCK_MINUTES = 60;
export const BLOCK_HOUR = 9;

export function defaultStart(now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(BLOCK_HOUR, 0, 0, 0);
  return d;
}

// The event itself, in the one shape both calendars are built from.
export function subtaskEvent({ text, summary = '', projectTitle, url, start = defaultStart(), minutes = BLOCK_MINUTES }) {
  return {
    title: `${text} — ${projectTitle}`,
    description: summary,
    url,
    start,
    end: new Date(start.getTime() + minutes * 60000),
  };
}

// "Fri, Oct 23, 9:00 AM – 10:00 AM", so the slot is on screen before it is sent anywhere.
export function formatSlot(start, end) {
  const day = start.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = (d) => d.toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day}, ${time(start)} – ${time(end)}`;
}

// ---------- Google Calendar ----------

const GOOGLE_COMPOSE = 'https://calendar.google.com/calendar/render';

// A task without a summary has only the link, and either can be missing.
function plainBody(ev) {
  return [ev.description, ev.url].filter(Boolean).join('\n');
}

export function googleUrl(ev) {
  const stamp = (d) => utcStamp(d).replace(/[-:]/g, '');
  const query = new URLSearchParams({ action: 'TEMPLATE', text: ev.title, dates: `${stamp(ev.start)}/${stamp(ev.end)}`, details: plainBody(ev) });
  return `${GOOGLE_COMPOSE}?${query}`;
}

// ---------- Outlook on the web ----------

// Microsoft publishes no documentation for this link; the parameters below are the
// community-tested ones, so if a tenant ever stops honouring them, the .ics download is the
// way in that cannot break. Times go as UTC: Outlook shows them in the mailbox's own zone.
const OUTLOOK_COMPOSE = 'https://outlook.office.com/calendar/deeplink/compose';

export function outlookUrl(ev) {
  // path is left unencoded and the timestamps keep their colons, matching the links Outlook
  // is known to accept.
  const query = [
    'path=/calendar/action/compose',
    'rru=addevent',
    `subject=${encodeURIComponent(ev.title)}`,
    `startdt=${utcStamp(ev.start)}`,
    `enddt=${utcStamp(ev.end)}`,
    `body=${encodeURIComponent(outlookBody(ev))}`,
  ];
  return `${OUTLOOK_COMPOSE}?${query.join('&')}`;
}

// The compose form renders its body as HTML, so the link back to the project is clickable.
function outlookBody(ev) {
  const html = escapeHtml(ev.description).replace(/\n/g, '<br>');
  const href = ev.url && escapeHtml(ev.url);
  return [html, href && `<a href="${href}">${href}</a>`].filter(Boolean).join('<br>');
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function utcStamp(d) {
  return `${d.toISOString().slice(0, 19)}Z`;
}

// ---------- .ics file ----------

export function icsText(ev, { now = new Date(), uid = newUid() } = {}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Clique//Project tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsTime(now)}`,
    `DTSTART:${icsTime(ev.start)}`,
    `DTEND:${icsTime(ev.end)}`,
    `SUMMARY:${icsEscape(ev.title)}`,
    `DESCRIPTION:${icsEscape(plainBody(ev))}`,
    ...(ev.url ? [`URL:${icsEscape(ev.url)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

function icsTime(d) {
  return `${d.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`;
}

// Backslash first, or it would escape the backslashes the other rules add.
function icsEscape(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// A content line is at most 75 octets; the rest continues on the next line after a space.
// Measured in octets and broken between characters, so an em dash is never cut in half.
const encoder = new TextEncoder();
function fold(line) {
  const out = [];
  let current = '';
  let octets = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (octets + size > 75) {
      out.push(current);
      current = ' ';
      octets = 1;
    }
    current += ch;
    octets += size;
  }
  out.push(current);
  return out.join('\r\n');
}

// crypto.randomUUID needs a secure context, and Clique is often served over plain http
// on an internal host, so the id is built from the clock and a random suffix instead.
function newUid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}@clique`;
}

export function icsFilename(text) {
  const slug = String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
  return `${slug || 'task'}.ics`;
}

export function downloadIcs(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
