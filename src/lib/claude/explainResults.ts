import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { OpportunityCard } from "@/db/queries";
import { costCompText, deadlineText, eligibilityText, fmtDate } from "@/lib/display";
import type { Filters } from "@/lib/search";
import { categoryLabel, formatLabel, scheduleLabel } from "@/lib/taxonomy";
import { CLAUDE_MODEL, asData, getClaude, isClaudeEnabled } from "./client";
import { ExplanationSchema, type Explanation } from "./schemas";

export interface ExplainResult {
  explanation: Explanation;
  usedClaude: boolean;
}

/** Compact projection sent to the model — never the full DB, only the returned rows. */
function projection(cards: OpportunityCard[]) {
  return cards.map((c) => ({
    id: c.id,
    title: c.title,
    org: c.orgName,
    category: c.category,
    city: c.city,
    format: c.format,
    eligibility: eligibilityText(c),
    costAndPay: costCompText(c),
    deadline: c.applicationDeadline ?? "rolling",
    schedule: c.schedule,
    timeCommitment: c.timeCommitment,
    lastVerified: c.lastVerifiedAt ? fmtDate(c.lastVerifiedAt) : "not yet verified",
  }));
}

export async function explainResults(
  question: string,
  filters: Filters,
  results: OpportunityCard[],
): Promise<ExplainResult> {
  if (results.length === 0) {
    return { explanation: emptyExplanation(filters), usedClaude: false };
  }

  if (isClaudeEnabled()) {
    try {
      const message = await getClaude().messages.parse({
        model: CLAUDE_MODEL(),
        max_tokens: 1024,
        system: [
          "You are the search assistant for RTP Pathway, a source-linked preview directory for high-school students in the Research Triangle (NC).",
          "You are given a student's question and the matching database records.",
          "Explain the matches to the student. Reference ONLY the provided records and their ids — never invent programs, details, or ids.",
          "Note eligibility uncertainty where relevant (e.g. record doesn't state a grade range).",
          "Mention deadlines for time-sensitive matches. Keep it friendly and concrete.",
        ].join("\n"),
        messages: [
          {
            role: "user",
            content:
              asData("student_question", question) +
              "\n\n" +
              asData("database_records", JSON.stringify(projection(results.slice(0, 10)))),
          },
        ],
        output_config: { format: zodOutputFormat(ExplanationSchema) },
      });
      const parsed = message.parsed_output;
      if (parsed) {
        return { explanation: groundExplanation(parsed, filters, results), usedClaude: true };
      }
    } catch {
      // fall through to template
    }
  }

  return { explanation: templateExplanation(filters, results), usedClaude: false };
}

// ---------------------------------------------------------------------------

export function describeFilters(filters: Filters): string {
  const parts: string[] = [];
  if (filters.cost === "free") parts.push("free");
  if (filters.compensation === "any_pay") parts.push("paid");
  else if (filters.compensation === "paid") parts.push("paid");
  else if (filters.compensation === "stipend") parts.push("stipend");
  if (filters.schedule) parts.push(scheduleLabel(filters.schedule).toLowerCase());
  if (filters.category) parts.push(categoryLabel(filters.category).toLowerCase());
  else parts.push("opportunities");
  if (filters.keywords?.length) parts.push(`related to ${filters.keywords.join(", ")}`);
  if (filters.grade) parts.push(`for grade ${filters.grade}`);
  if (filters.city) parts.push(`in ${filters.city}`);
  if (filters.format) parts.push(`(${formatLabel(filters.format).toLowerCase()})`);
  if (filters.deadlineWithinDays) parts.push(`with deadlines within ${filters.deadlineWithinDays} days`);
  return parts.join(" ");
}

function templateExplanation(filters: Filters, results: OpportunityCard[]): Explanation {
  const summary = `Found ${results.length} ${describeFilters(filters)}. The soonest deadline is listed first — check each listing's source before applying.`;
  return {
    summary,
    perResult: results.slice(0, 6).map(reasonForCard),
  };
}

function reasonForCard(c: OpportunityCard): { id: string; reason: string } {
  return {
    id: c.id,
    reason: [
      c.costType === "free" ? "Free" : c.costAmount ?? "Has a fee",
      c.compensation !== "none" ? costCompText(c).split(" · ")[1] : null,
      eligibilityText(c),
      c.city,
      deadlineText(c.applicationDeadline).toLowerCase(),
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

/**
 * Treat model output only as an ordering/highlight suggestion. IDs are
 * allow-listed and every displayed claim is rebuilt from stored row fields.
 */
export function groundExplanation(
  modelExplanation: Explanation,
  filters: Filters,
  results: OpportunityCard[],
): Explanation {
  const cards = new Map(results.map((card) => [card.id, card]));
  const seen = new Set<string>();
  const perResult = modelExplanation.perResult.flatMap(({ id }) => {
    const card = cards.get(id);
    if (!card || seen.has(id)) return [];
    seen.add(id);
    return [reasonForCard(card)];
  }).slice(0, 6);
  const deterministic = templateExplanation(filters, results);
  return {
    summary: deterministic.summary,
    perResult: perResult.length > 0 ? perResult : deterministic.perResult,
  };
}

function emptyExplanation(filters: Filters): Explanation {
  const described = describeFilters(filters);
  const suggestions: string[] = [];
  if (filters.schedule) suggestions.push("removing the schedule filter");
  if (filters.city) suggestions.push("searching Triangle-wide instead of one city");
  if (filters.deadlineWithinDays) suggestions.push("widening the deadline window");
  if (filters.category) suggestions.push("trying a related category");
  const hint = suggestions.length
    ? ` Try ${suggestions.slice(0, 2).join(" or ")}.`
    : " Try different keywords.";
  return {
    summary: `No listings currently match ${described}.${hint} We log unmatched searches so local organizations can see what students are looking for.`,
    perResult: [],
  };
}
