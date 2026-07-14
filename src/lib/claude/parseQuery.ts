import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Filters } from "@/lib/search";
import { taxonomy, type TaxonomyEntry } from "@/lib/taxonomy";
import { CLAUDE_MODEL, asData, getClaude, isClaudeEnabled } from "./client";
import { FiltersSchema } from "./schemas";

export interface ParseResult {
  filters: Filters;
  usedClaude: boolean;
}

/** NL question → validated Filters. Claude when available, rule-based otherwise. */
export async function parseQuery(question: string): Promise<ParseResult> {
  if (isClaudeEnabled()) {
    try {
      const message = await getClaude().messages.parse({
        model: CLAUDE_MODEL(),
        max_tokens: 1024,
        system: [
          "You convert a student's plain-English question about youth opportunities in the Research Triangle (Chapel Hill, Durham, Raleigh NC) into structured search filters.",
          "Only set a filter when the question clearly implies it; leave everything else null.",
          "Categories: " + taxonomy.categories.map((c) => `${c.id} (${c.label})`).join(", ") + ".",
          "Cities must be one of: " + taxonomy.cities.map((c) => c.id).join(", ") + ".",
          "Keywords should capture topics/interests (e.g. 'coding', 'animals', 'health') — not words already expressed as filters.",
        ].join("\n"),
        messages: [{ role: "user", content: asData("student_question", question) }],
        output_config: { format: zodOutputFormat(FiltersSchema) },
      });
      const parsed = message.parsed_output;
      if (parsed) return { filters: cleanParsed(parsed), usedClaude: true };
    } catch {
      // fall through to the rule-based parser
    }
  }
  return { filters: fallbackParse(question), usedClaude: false };
}

function cleanParsed(raw: Record<string, unknown>): Filters {
  const filters: Filters = {};
  const keywords = Array.isArray(raw.keywords)
    ? raw.keywords.filter((k): k is string => typeof k === "string" && k.length > 1).slice(0, 3)
    : [];
  if (keywords.length) filters.keywords = keywords;
  for (const key of ["category", "format", "cost", "compensation", "city", "schedule"] as const) {
    if (typeof raw[key] === "string" && raw[key]) filters[key] = raw[key] as string;
  }
  if (typeof raw.grade === "number") filters.grade = raw.grade;
  if (typeof raw.deadlineWithinDays === "number") filters.deadlineWithinDays = raw.deadlineWithinDays;
  return filters;
}

// ---------------------------------------------------------------------------
// Deterministic fallback parser — same Filters shape, so downstream identical.

function matchEntry(text: string, entries: TaxonomyEntry[]): string | undefined {
  let best: { id: string; length: number } | undefined;
  for (const entry of entries) {
    for (const term of [entry.label ?? "", ...(entry.synonyms ?? []), entry.id.replace(/_/g, " ")]) {
      const t = term.toLowerCase();
      if (t.length > 2 && text.includes(t) && (!best || t.length > best.length)) {
        best = { id: entry.id, length: t.length };
      }
    }
  }
  return best?.id;
}

const GRADE_WORDS: Record<string, number> = {
  freshman: 9, freshmen: 9, sophomore: 10, sophomores: 10,
  junior: 11, juniors: 11, senior: 12, seniors: 12,
};

export function fallbackParse(question: string): Filters {
  const text = question.toLowerCase();
  const filters: Filters = {};

  filters.category = matchEntry(text, taxonomy.categories);
  filters.city = matchEntry(text, taxonomy.cities);
  filters.schedule = matchEntry(text, taxonomy.schedules);

  if (/\bfree\b|no cost/.test(text)) filters.cost = "free";
  if (/\bpaid\b|\bpay(s|ing)?\b|stipend|make money|earn/.test(text)) filters.compensation = "any_pay";
  if (/\bonline\b|\bvirtual\b|\bremote\b/.test(text)) filters.format = "online";
  else if (/in[- ]person/.test(text)) filters.format = "in_person";

  const gradeMatch =
    text.match(/\b(\d{1,2})(?:st|nd|rd|th)?[- ]grade/) ?? text.match(/grade\s+(\d{1,2})\b/);
  if (gradeMatch) {
    const g = Number(gradeMatch[1]);
    if (g >= 6 && g <= 12) filters.grade = g;
  } else {
    const word = Object.keys(GRADE_WORDS).find((w) => new RegExp(`\\b${w}\\b`).test(text));
    if (word) filters.grade = GRADE_WORDS[word];
    const age = text.match(/\b(1[0-9])[- ]?(?:year[- ]old|yo\b|years old)/);
    if (!word && age) {
      const g = Number(age[1]) - 5;
      if (g >= 6 && g <= 12) filters.grade = g;
    }
  }

  if (/this week|before friday|next few days|by friday/.test(text)) filters.deadlineWithinDays = 7;
  else if (/this month|next 30 days|soon\b/.test(text)) filters.deadlineWithinDays = 30;

  // Interests become keywords (interest ids appear in the stored interest_tags JSON).
  const keywords: string[] = [];
  for (const interest of taxonomy.interests) {
    const terms = [interest.id, interest.label ?? "", ...(interest.synonyms ?? [])].map((t) => t.toLowerCase());
    if (terms.some((t) => t.length > 2 && new RegExp(`\\b${escapeRegExp(t)}\\b`).test(text))) {
      keywords.push(interest.id);
    }
  }
  if (keywords.length) filters.keywords = keywords.slice(0, 3);

  return filters;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
