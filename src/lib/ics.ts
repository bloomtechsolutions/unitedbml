/** Minimal RFC 5545 (iCalendar) builder — no external dependency needed for a handful of
 * VEVENTs. Shared between the client (single "Add to Outlook" download) and the server-side
 * meetings feed route (a whole-calendar subscription). */

export interface IcsEventInput {
  uid: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:MM", 24-hour. Defaults to 09:00 if omitted. */
  time?: string | null;
  /** Minutes. Defaults to 60. */
  durationMinutes?: number;
  title: string;
  location?: string | null;
  description?: string | null;
  cancelled?: boolean;
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/** Maldives has a fixed UTC+5 offset with no DST, so a local meeting_date/meeting_time pair can
 * be converted straight to a UTC instant without a VTIMEZONE block. */
function maldivesLocalToUtc(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+05:00`);
}

function formatIcsUtc(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** Escapes text per RFC 5545 §3.3.11 (backslash, semicolon, comma, newline). */
function escapeIcsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** Folds a content line at 75 octets as RFC 5545 requires, continuation lines prefixed with a space. */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    chunks.push(rest.slice(0, 75));
    rest = ' ' + rest.slice(75);
  }
  chunks.push(rest);
  return chunks.join('\r\n');
}

export function buildIcsEvent(input: IcsEventInput): string {
  const start = maldivesLocalToUtc(input.date, input.time || '09:00');
  const end = new Date(start.getTime() + (input.durationMinutes ?? 60) * 60_000);
  const lines = [
    'BEGIN:VEVENT',
    `UID:${input.uid}`,
    `DTSTAMP:${formatIcsUtc(new Date())}`,
    `DTSTART:${formatIcsUtc(start)}`,
    `DTEND:${formatIcsUtc(end)}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
  ];
  if (input.location) lines.push(`LOCATION:${escapeIcsText(input.location)}`);
  if (input.description) lines.push(`DESCRIPTION:${escapeIcsText(input.description)}`);
  lines.push(`STATUS:${input.cancelled ? 'CANCELLED' : 'CONFIRMED'}`);
  lines.push('END:VEVENT');
  return lines.map(foldLine).join('\r\n');
}

export function buildIcsCalendar(veventBlocks: string[], calendarName: string): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UnitedBML//Meetings//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:${escapeIcsText(calendarName)}`),
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
    ...veventBlocks,
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadIcsFile(filename: string, icsText: string) {
  const blob = new Blob([icsText], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
