import Link from "next/link";
import { notFound } from "next/navigation";
import { getOpportunityBySlug, isPubliclyVisible, safeParseArray } from "@/db/queries";
import { costCompText, deadlineText, eligibilityText, fmtDate } from "@/lib/display";
import { categoryLabel, formatLabel, interestLabel, scheduleLabel } from "@/lib/taxonomy";
import { Chip, DeadlineBadge, VerificationBadge } from "@/components/Badges";
import { SaveButton } from "@/components/SaveCompare";
import { QAWidget } from "@/components/QAWidget";
import { CalendarLinks } from "@/components/CalendarLinks";
import { ReportIssueDialog } from "@/components/ReportIssueDialog";

export const dynamic = "force-dynamic";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">{title}</h2>
      <div className="text-sm leading-relaxed text-stone-800">{children}</div>
    </section>
  );
}

export default async function OpportunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const row = getOpportunityBySlug(slug);
  if (!row || row.opp.status === "archived") notFound();

  const { opp, org } = row;
  const closed = !isPubliclyVisible(opp);
  const interests = safeParseArray(opp.interestTags);

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-4">
      {closed && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This opportunity is no longer accepting applications (deadline{" "}
          {fmtDate(opp.applicationDeadline)}). It stays visible here for reference — check the
          organization&apos;s website for the next cycle.
        </div>
      )}

      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">{opp.title}</h1>
            <p className="text-stone-500">
              {org.website ? (
                <a href={org.website} target="_blank" rel="noopener noreferrer" className="hover:text-teal-700 hover:underline">
                  {org.name}
                </a>
              ) : (
                org.name
              )}
            </p>
          </div>
          <SaveButton id={opp.id} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip>{categoryLabel(opp.category)}</Chip>
          <Chip>{opp.city}</Chip>
          <Chip>{formatLabel(opp.format)}</Chip>
          {opp.schedule && <Chip>{scheduleLabel(opp.schedule)}</Chip>}
          {interests.map((tag) => (
            <Chip key={tag}>{interestLabel(tag)}</Chip>
          ))}
          <DeadlineBadge deadline={opp.applicationDeadline} />
          <VerificationBadge lastVerifiedAt={opp.lastVerifiedAt} />
        </div>
      </header>

      <Section title="What it is">
        <p>{opp.description}</p>
      </Section>

      <Section title="Who can apply">
        <p className="font-medium">{eligibilityText(opp)}</p>
        {opp.eligibilityNotes && opp.eligibilityNotes.toLowerCase() !== eligibilityText(opp).toLowerCase() && (
          <p className="mt-1 text-stone-600">Listed as: “{opp.eligibilityNotes}”</p>
        )}
        {opp.transportationNotes && (
          <p className="mt-1 text-stone-600">Transportation / access: {opp.transportationNotes}</p>
        )}
      </Section>

      <Section title="What you’ll do">
        <p>{opp.whatYoullDo ?? opp.description}</p>
      </Section>

      <Section title="Time commitment">
        <ul className="flex flex-col gap-1">
          {opp.timeCommitment && <li>{opp.timeCommitment}</li>}
          {opp.schedule && <li>Schedule: {scheduleLabel(opp.schedule)}</li>}
          {!opp.timeCommitment && !opp.schedule && <li>Not specified — check with the organization.</li>}
        </ul>
      </Section>

      <Section title="Cost & compensation">
        <p>{costCompText(opp)}</p>
        {opp.compensation === "none" && opp.costType === "free" && (
          <p className="mt-1 text-stone-500">Free to participate; this is an unpaid opportunity.</p>
        )}
      </Section>

      <Section title="How to apply">
        {opp.howToApply && <p className="mb-2">{opp.howToApply}</p>}
        {opp.applicationUrl ? (
          <a
            href={opp.applicationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800"
          >
            Apply / learn more ↗
          </a>
        ) : (
          <p className="text-stone-600">
            No application link on file
            {opp.contactEmail ? (
              <>
                {" "}
                — contact{" "}
                <a href={`mailto:${opp.contactEmail}`} className="text-teal-700 underline">
                  {opp.contactEmail}
                </a>
              </>
            ) : (
              " — reach out to the organization directly"
            )}
            .
          </p>
        )}
      </Section>

      <Section title="Important dates">
        <ul className="flex flex-col gap-1">
          <li>
            <span className="font-medium">Application deadline:</span> {deadlineText(opp.applicationDeadline)}
          </li>
          {opp.startDate && (
            <li>
              <span className="font-medium">Starts:</span> {fmtDate(opp.startDate)}
            </li>
          )}
          {opp.endDate && (
            <li>
              <span className="font-medium">Ends:</span> {fmtDate(opp.endDate)}
            </li>
          )}
        </ul>
        {opp.applicationDeadline && !closed && (
          <div className="mt-3">
            <CalendarLinks
              opportunityId={opp.id}
              title={opp.title}
              deadline={opp.applicationDeadline}
              orgName={org.name}
            />
          </div>
        )}
      </Section>

      <Section title="Source">
        <ul className="flex flex-col gap-1">
          {opp.sourceUrl && (
            <li>
              Original listing:{" "}
              <a href={opp.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-teal-700 underline break-all">
                {opp.sourceUrl}
              </a>
            </li>
          )}
          {opp.contactEmail && (
            <li>
              Contact:{" "}
              <a href={`mailto:${opp.contactEmail}`} className="text-teal-700 underline">
                {opp.contactEmail}
              </a>
            </li>
          )}
          <li className="text-stone-500">
            {opp.lastVerifiedAt
              ? `Last verified ${fmtDate(opp.lastVerifiedAt)}.`
              : "Not yet verified by our team."}{" "}
            Always confirm details with the organization before applying.
          </li>
        </ul>
      </Section>

      <QAWidget opportunityId={opp.id} />

      <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
        <p className="text-xs text-stone-500">See something wrong or out of date?</p>
        <ReportIssueDialog opportunityId={opp.id} />
      </div>

      <p className="text-center text-sm">
        <Link href="/" className="text-teal-700 hover:underline">
          ← Back to all opportunities
        </Link>
      </p>
    </article>
  );
}
