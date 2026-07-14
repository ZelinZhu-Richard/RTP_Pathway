import { deadlineText, deadlineUrgency, fmtDate } from "@/lib/display";
import { verificationStatus } from "@/lib/taxonomy";

export function VerificationBadge({ lastVerifiedAt }: { lastVerifiedAt: string | null }) {
  const status = verificationStatus(lastVerifiedAt);
  if (status === "verified") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200"
        title={`Last verified ${fmtDate(lastVerifiedAt)}`}
      >
        <svg viewBox="0 0 16 16" className="h-3 w-3 fill-current" aria-hidden>
          <path d="M8 0a8 8 0 1 0 8 8A8 8 0 0 0 8 0Zm3.6 6.1-4 4.5a.75.75 0 0 1-1.1.02L4.4 8.5a.75.75 0 1 1 1.08-1.04l1.53 1.6 3.47-3.9a.75.75 0 0 1 1.12 1Z" />
        </svg>
        Verified {fmtDate(lastVerifiedAt, { year: undefined })}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200"
      title={lastVerifiedAt ? `Last verified ${fmtDate(lastVerifiedAt)}` : "Not yet verified"}
    >
      Needs verification
    </span>
  );
}

const urgencyStyles: Record<string, string> = {
  urgent: "bg-red-50 text-red-700 ring-red-200",
  soon: "bg-amber-50 text-amber-700 ring-amber-200",
  open: "bg-stone-100 text-stone-600 ring-stone-200",
  rolling: "bg-sky-50 text-sky-700 ring-sky-200",
  closed: "bg-stone-200 text-stone-500 ring-stone-300",
};

export function DeadlineBadge({ deadline }: { deadline: string | null }) {
  const urgency = deadlineUrgency(deadline);
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${urgencyStyles[urgency]}`}>
      {deadlineText(deadline)}
    </span>
  );
}

export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600 ring-1 ring-stone-200">
      {children}
    </span>
  );
}
