// Minimal RFC 5545 builder for a single all-day deadline event.

function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Fold long content lines at 74 octets per RFC 5545 §3.1. */
function fold(line: string): string[] {
  if (line.length <= 74) return [line];
  const parts = [line.slice(0, 74)];
  for (let i = 74; i < line.length; i += 73) parts.push(" " + line.slice(i, i + 73));
  return parts;
}

export interface IcsEvent {
  uid: string;
  /** YYYY-MM-DD — rendered as an all-day event on this date */
  date: string;
  summary: string;
  description?: string;
  url?: string;
}

export function buildIcs(event: IcsEvent): string {
  const start = event.date.replaceAll("-", "");
  const endDate = new Date(`${event.date}T00:00:00Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const end = endDate.toISOString().slice(0, 10).replaceAll("-", "");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RTP Pathway//Opportunity Deadlines//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}@rtp-pathway`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${escapeText(event.summary)}`,
    ...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
    ...(event.url ? [`URL:${escapeText(event.url)}`] : []),
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Application deadline reminder",
    "TRIGGER:-P3D",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.flatMap(fold).join("\r\n") + "\r\n";
}
