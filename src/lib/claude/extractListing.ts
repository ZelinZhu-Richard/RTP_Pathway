import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { taxonomy } from "@/lib/taxonomy";
import { CLAUDE_MODEL, asData, getClaude, isClaudeEnabled } from "./client";
import { ExtractedListingSchema, type ExtractedListing } from "./schemas";

export interface ExtractionResult {
  fields: ExtractedListing | null;
  missingFields: string[];
  usedClaude: boolean;
  notice?: string;
}

/**
 * Required fields for a publishable listing. Computed IN CODE (not by the
 * model) so the submit form, the API, and the admin queue always agree.
 */
export function computeMissingFields(fields: Partial<ExtractedListing>): string[] {
  const missing: string[] = [];
  if (!fields.title) missing.push("title");
  if (!fields.orgName) missing.push("organization name");
  if (!fields.category) missing.push("category");
  if (!fields.description) missing.push("description");
  if (!fields.city) missing.push("city");
  if (!fields.format) missing.push("format (in person / online / hybrid)");
  if (!fields.applicationUrl && !fields.contactEmail) missing.push("application link or contact email");
  if (fields.deadlineType === "unknown" || (!fields.applicationDeadline && fields.deadlineType !== "rolling")) {
    missing.push("application deadline (or confirm it's rolling)");
  }
  return missing;
}

export async function extractListing(messyText: string): Promise<ExtractionResult> {
  if (!isClaudeEnabled()) {
    return {
      fields: null,
      missingFields: [],
      usedClaude: false,
      notice: "AI extraction is currently unavailable — please fill in the form fields manually.",
    };
  }
  try {
    const message = await getClaude().messages.parse({
      model: CLAUDE_MODEL(),
      max_tokens: 2048,
      system: [
        "You extract structured listing data from a community organization's program description for a youth-opportunity directory in the Research Triangle, NC.",
        "Extract ONLY what the text states. Use null for anything absent — never guess dates, costs, ages, or locations.",
        "Dates must be YYYY-MM-DD. If the text says applications are accepted on a rolling/ongoing basis, set deadlineType='rolling'; if no deadline information appears at all, set deadlineType='unknown'.",
        "Cities must be one of: " + taxonomy.cities.map((c) => c.id).join(", ") + " — use null if the text names somewhere else, and put the raw place in locationDetail.",
        "Write description/whatYoullDo in plain language a high-school student understands.",
        "List anything a human reviewer should double-check in assumptions.",
      ].join("\n"),
      messages: [{ role: "user", content: asData("submitted_description", messyText.slice(0, 12_000)) }],
      output_config: { format: zodOutputFormat(ExtractedListingSchema) },
    });
    const fields = message.parsed_output;
    if (!fields) throw new Error("no parsed output");
    return { fields, missingFields: computeMissingFields(fields), usedClaude: true };
  } catch {
    return {
      fields: null,
      missingFields: [],
      usedClaude: false,
      notice: "AI extraction failed — please fill in the form fields manually.",
    };
  }
}
