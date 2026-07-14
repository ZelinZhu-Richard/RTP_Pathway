"use client";

interface Props {
  opportunityId: string;
  title: string;
  /** YYYY-MM-DD */
  deadline: string;
  orgName: string;
}

function googleCalendarUrl({ title, deadline, orgName }: Props): string {
  // All-day event on the deadline day (end date is exclusive in Google's format).
  const start = deadline.replaceAll("-", "");
  const endDate = new Date(`${deadline}T00:00:00Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const end = endDate.toISOString().slice(0, 10).replaceAll("-", "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Application deadline: ${title}`,
    dates: `${start}/${end}`,
    details: `Application deadline for ${title} (${orgName}) — via RTP Pathway.`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function CalendarLinks(props: Props) {
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      <a
        href={`/api/opportunities/${props.opportunityId}/calendar.ics`}
        className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-stone-700 hover:border-teal-400 hover:text-teal-800"
      >
        📅 Download .ics reminder
      </a>
      <a
        href={googleCalendarUrl(props)}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-stone-700 hover:border-teal-400 hover:text-teal-800"
      >
        Add to Google Calendar ↗
      </a>
    </div>
  );
}
