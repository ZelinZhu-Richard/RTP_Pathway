// Pure formatting helpers shared by server and client components.

export function fmtDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!iso) return "";
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
    ...opts,
  }).format(date);
}

export function daysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const target = new Date(`${isoDate}T00:00:00Z`).getTime();
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime();
  return Math.round((target - today) / 86_400_000);
}

export type DeadlineUrgency = "rolling" | "closed" | "urgent" | "soon" | "open";

export function deadlineUrgency(isoDate: string | null): DeadlineUrgency {
  const days = daysUntil(isoDate);
  if (days === null) return "rolling";
  if (days < 0) return "closed";
  if (days <= 7) return "urgent";
  if (days <= 30) return "soon";
  return "open";
}

export function deadlineText(isoDate: string | null): string {
  const urgency = deadlineUrgency(isoDate);
  if (urgency === "rolling") return "Rolling admission";
  if (urgency === "closed") return `Closed ${fmtDate(isoDate)}`;
  const days = daysUntil(isoDate)!;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days <= 14) return `Due in ${days} days`;
  return `Due ${fmtDate(isoDate)}`;
}

export function eligibilityText(o: {
  gradeMin: number | null;
  gradeMax: number | null;
  ageMin: number | null;
  ageMax: number | null;
}): string {
  if (o.gradeMin != null || o.gradeMax != null) {
    if (o.gradeMin != null && o.gradeMax != null) {
      return o.gradeMin === o.gradeMax ? `Grade ${o.gradeMin}` : `Grades ${o.gradeMin}–${o.gradeMax}`;
    }
    return o.gradeMin != null ? `Grade ${o.gradeMin}+` : `Up to grade ${o.gradeMax}`;
  }
  if (o.ageMin != null || o.ageMax != null) {
    if (o.ageMin != null && o.ageMax != null) return `Ages ${o.ageMin}–${o.ageMax}`;
    return o.ageMin != null ? `Ages ${o.ageMin}+` : `Up to age ${o.ageMax}`;
  }
  return "All ages";
}

export function costCompText(o: {
  costType: string;
  costAmount: string | null;
  compensation: string;
  compensationDetail: string | null;
}): string {
  const parts: string[] = [];
  parts.push(o.costType === "free" ? "Free" : (o.costAmount ?? "Costs money"));
  if (o.compensation === "paid") parts.push(o.compensationDetail ? `Pays ${o.compensationDetail}` : "Paid");
  else if (o.compensation === "stipend") parts.push(o.compensationDetail ?? "Stipend");
  return parts.join(" · ");
}
