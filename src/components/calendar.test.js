import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultStart, formatSlot, icsFilename, icsText, outlookUrl, subtaskEvent } from './calendar.js';

const event = (over = {}) =>
  subtaskEvent({
    text: 'Security review of token scopes',
    owners: ['Alex', 'Sam'],
    projectTitle: 'Online banking real-time balances',
    url: 'http://clique.example/#/p/online-banking-real-time-balances',
    start: new Date('2026-10-23T13:00:00Z'),
    ...over,
  });

test('a block defaults to an hour at 9am tomorrow, local time', () => {
  const start = defaultStart(new Date('2026-10-22T20:15:00'));
  assert.equal(start.getDate(), 23);
  assert.equal(start.getHours(), 9);
  assert.equal(start.getMinutes(), 0);
  assert.equal(event().end - event().start, 60 * 60 * 1000);
});

test('the event names the to-do and its project, and lists the owners', () => {
  const ev = event();
  assert.equal(ev.title, 'Security review of token scopes — Online banking real-time balances');
  assert.match(ev.description, /^To-do on Online banking real-time balances\./);
  assert.match(ev.description, /Owners: Alex, Sam/);
  assert.match(subtaskEvent({ text: 'x', owners: ['Alex'], projectTitle: 'P' }).description, /Owner: Alex/);
  assert.doesNotMatch(subtaskEvent({ text: 'x', projectTitle: 'P' }).description, /Owner/);
});

test('the Outlook link carries the compose parameters and UTC times', () => {
  const url = outlookUrl(event());
  assert.ok(url.startsWith('https://outlook.office.com/calendar/deeplink/compose?'));
  assert.match(url, /[?&]path=\/calendar\/action\/compose(&|$)/);
  assert.match(url, /[?&]rru=addevent(&|$)/);
  assert.match(url, /[?&]startdt=2026-10-23T13:00:00Z(&|$)/);
  assert.match(url, /[?&]enddt=2026-10-23T14:00:00Z(&|$)/);
  // Spaces encode as %20, never as +, which a calendar would show literally.
  assert.ok(!new URL(url).search.includes('+'));
  assert.equal(new URL(url).searchParams.get('subject'), event().title);
});

test('the Outlook body is HTML, with the project link clickable and the text escaped', () => {
  const body = new URL(outlookUrl(event({ projectTitle: 'Cards & <Core>' }))).searchParams.get('body');
  assert.match(body, /Cards &amp; &lt;Core&gt;/);
  assert.match(body, /<br>/);
  assert.match(body, /<a href="http:\/\/clique\.example\/#\/p\/online-banking-real-time-balances">/);
});

test('the .ics file is a valid single event with UTC stamps and CRLF endings', () => {
  const ics = icsText(event(), { now: new Date('2026-10-22T20:00:00Z'), uid: 'fixed@clique' });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.equal(ics.split('\r\n').filter((l) => l.startsWith('BEGIN:VEVENT')).length, 1);
  assert.ok(ics.includes('UID:fixed@clique\r\n'));
  assert.ok(ics.includes('DTSTAMP:20261022T200000Z\r\n'));
  assert.ok(ics.includes('DTSTART:20261023T130000Z\r\n'));
  assert.ok(ics.includes('DTEND:20261023T140000Z\r\n'));
  assert.ok(!/\n(?!\r)/.test(ics.replace(/\r\n/g, '')), 'no bare newlines');
});

test('.ics text escapes the characters that would otherwise end a field', () => {
  const ics = icsText(event({ text: 'Review scopes; tokens, keys \\ secrets' }), { uid: 'u@clique' });
  const summary = unfold(ics).find((l) => l.startsWith('SUMMARY:'));
  assert.equal(summary, 'SUMMARY:Review scopes\; tokens\\, keys \\\\ secrets — Online banking real-time balances');
  // The description keeps its line breaks as the escaped form, not real ones.
  assert.match(unfold(ics).find((l) => l.startsWith('DESCRIPTION:')), /\\nOwners: Alex\\, Sam\\nhttp/);
});

test('long lines fold at 75 octets without splitting a character', () => {
  const ics = icsText(event({ text: 'Review the refresh-token rotation path and the service-to-service scopes the gateway uses — every one of them' }), { uid: 'u@clique' });
  for (const line of ics.split('\r\n')) {
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `line too long: ${line}`);
  }
  // Unfolding puts the em dash back together, so it survived the break.
  assert.match(unfold(ics).find((l) => l.startsWith('SUMMARY:')), /gateway uses — every one of them/);
});

test('the file is named after the to-do', () => {
  assert.equal(icsFilename('Security review of token scopes'), 'security-review-of-token-scopes.ics');
  assert.equal(icsFilename('  ???  '), 'to-do.ics');
  assert.ok(icsFilename('x'.repeat(200)).length <= 54);
});

test('the slot reads as a day and a time range', () => {
  const ev = event({ start: new Date('2026-10-23T13:00:00') });
  assert.match(formatSlot(ev.start, ev.end), /^Fri, Oct 23, .*–.*$/);
});

// Join continuation lines (a leading space) back onto the line they belong to.
function unfold(ics) {
  return ics.split('\r\n').reduce((out, line) => {
    if (line.startsWith(' ')) out[out.length - 1] += line.slice(1);
    else out.push(line);
    return out;
  }, []);
}
