import type { OpportunityRow, OrganizationRow } from "@/db/schema";
import { costCompText, deadlineText, eligibilityText, fmtDate } from "@/lib/display";
import { formatLabel, scheduleLabel } from "@/lib/taxonomy";
import { CLAUDE_MODEL, asData, getClaude, isClaudeEnabled } from "./client";

const NOT_STATED =
  "The listing does not say — check the original source or contact the organization before applying.";

export interface QaResult {
  answer: string;
  usedClaude: boolean;
}

function listingFacts(opp: OpportunityRow, org: OrganizationRow) {
  return {
    title: opp.title,
    organization: org.name,
    description: opp.description,
    whatYoullDo: opp.whatYoullDo,
    eligibility: eligibilityText(opp),
    eligibilityNotes: opp.eligibilityNotes,
    city: opp.city,
    locationDetail: opp.locationDetail,
    format: formatLabel(opp.format),
    costAndCompensation: costCompText(opp),
    schedule: opp.schedule ? scheduleLabel(opp.schedule) : null,
    timeCommitment: opp.timeCommitment,
    applicationDeadline: opp.applicationDeadline ?? "rolling (no fixed deadline)",
    startDate: opp.startDate,
    endDate: opp.endDate,
    howToApply: opp.howToApply,
    applicationUrl: opp.applicationUrl,
    contactEmail: opp.contactEmail,
    transportationNotes: opp.transportationNotes,
    sourceUrl: opp.sourceUrl,
    lastVerified: opp.lastVerifiedAt ? fmtDate(opp.lastVerifiedAt) : "not yet verified",
  };
}

export async function answerListingQuestion(
  question: string,
  opp: OpportunityRow,
  org: OrganizationRow,
): Promise<QaResult> {
  if (isClaudeEnabled()) {
    try {
      const response = await getClaude().messages.create({
        model: CLAUDE_MODEL(),
        max_tokens: 512,
        system: [
          "You answer a student's question about ONE specific opportunity listing.",
          "Answer ONLY from the listing JSON provided. Do not use outside knowledge about the organization or program.",
          `If the listing does not contain the answer, reply exactly: "${NOT_STATED}"`,
          "Keep answers to 1-3 sentences, plain language for a high-school student.",
        ].join("\n"),
        messages: [
          {
            role: "user",
            content:
              asData("listing", JSON.stringify(listingFacts(opp, org))) +
              "\n\n" +
              asData("student_question", question),
          },
        ],
      });
      const text = response.content
        .filter((block): block is { type: "text"; text: string } & typeof block => block.type === "text")
        .map((block) => block.text)
        .join(" ")
        .trim();
      if (text) return { answer: text, usedClaude: true };
    } catch {
      // fall through to the field router
    }
  }
  return { answer: fallbackAnswer(question, opp, org), usedClaude: false };
}

// ---------------------------------------------------------------------------
// Deterministic fallback: route question keywords to listing fields.

export function fallbackAnswer(question: string, opp: OpportunityRow, org: OrganizationRow): string {
  const q = question.toLowerCase();
  const answer = (text: string | null | undefined, prefix = "") =>
    text ? `${prefix}${text}` : NOT_STATED;

  if (/transport|bus|ride|get there|drive/.test(q)) {
    return answer(opp.transportationNotes, "Transportation/access notes: ");
  }
  if (/deadline|due|apply by|last day/.test(q)) {
    return `Application deadline: ${deadlineText(opp.applicationDeadline).toLowerCase()}.`;
  }
  if (/cost|price|fee|expensive|pay to/.test(q)) {
    return `Cost: ${costCompText(opp)}.`;
  }
  if (/paid|pay\b|stipend|money|earn|wage|salary/.test(q)) {
    if (opp.compensation === "none") return "This is an unpaid opportunity.";
    return `Compensation: ${opp.compensationDetail ?? opp.compensation}.`;
  }
  if (/grade|age|old|eligib|who can|9th|10th|11th|12th|freshman|sophomore|junior|senior/.test(q)) {
    const base = `Eligibility: ${eligibilityText(opp)}.`;
    return opp.eligibilityNotes ? `${base} The listing says: “${opp.eligibilityNotes}”.` : base;
  }
  if (/experience|prior|prerequisite|require/.test(q)) {
    return opp.eligibilityNotes
      ? `The listing's eligibility notes say: “${opp.eligibilityNotes}”. Anything beyond that isn't stated — check with the organization.`
      : NOT_STATED;
  }
  if (/hours|time|commit|long|weeks|schedule|when/.test(q)) {
    const parts = [opp.timeCommitment, opp.schedule ? `schedule: ${scheduleLabel(opp.schedule)}` : null].filter(Boolean);
    return parts.length ? `Time commitment: ${parts.join("; ")}.` : NOT_STATED;
  }
  if (/where|location|address|city/.test(q)) {
    return `Location: ${[opp.locationDetail, opp.city].filter(Boolean).join(", ")} (${formatLabel(opp.format)}).`;
  }
  if (/start|begin/.test(q)) {
    return opp.startDate ? `Start date: ${fmtDate(opp.startDate)}.` : NOT_STATED;
  }
  if (/end|finish/.test(q)) {
    return opp.endDate ? `End date: ${fmtDate(opp.endDate)}.` : NOT_STATED;
  }
  if (/contact|email|reach|question/.test(q)) {
    return opp.contactEmail
      ? `Contact: ${opp.contactEmail}.`
      : org.website
        ? `No contact email on file — try the organization's website: ${org.website}`
        : NOT_STATED;
  }
  if (/how.*apply|application|sign up/.test(q)) {
    if (opp.howToApply) return opp.howToApply;
    return opp.applicationUrl ? `Apply through the application link: ${opp.applicationUrl}` : NOT_STATED;
  }
  return NOT_STATED;
}
