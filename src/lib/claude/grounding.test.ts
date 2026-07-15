import assert from "node:assert/strict";
import test from "node:test";
import type { OpportunityCard } from "@/db/queries";
import type { OpportunityRow, OrganizationRow } from "@/db/schema";
import { groundExplanation } from "./explainResults";
import { fallbackAnswer } from "./groundedQa";

function card(overrides: Partial<OpportunityCard> = {}): OpportunityCard {
  return {
    id: "known-id",
    slug: "known-listing",
    title: "Known Listing",
    orgName: "Known Organization",
    category: "internship",
    interestTags: [],
    format: "in_person",
    city: "Durham",
    costType: "free",
    costAmount: null,
    compensation: "none",
    compensationDetail: null,
    gradeMin: 9,
    gradeMax: 12,
    ageMin: null,
    ageMax: null,
    schedule: "summer",
    timeCommitment: null,
    applicationDeadline: null,
    lastVerifiedAt: null,
    sourceUrl: null,
    ...overrides,
  };
}

test("grounded explanations discard invented ids and rebuild claims from stored fields", () => {
  const grounded = groundExplanation(
    {
      summary: "Invented summary about a cash prize.",
      perResult: [
        { id: "invented-id", reason: "Invented opportunity" },
        { id: "known-id", reason: "Invented $10,000 stipend" },
      ],
    },
    { category: "internship" },
    [card()],
  );

  assert.equal(grounded.perResult.some((item) => item.id === "invented-id"), false);
  assert.equal(grounded.perResult[0].id, "known-id");
  assert.equal(grounded.perResult[0].reason.includes("$10,000"), false);
  assert.equal(grounded.summary.includes("cash prize"), false);
});

test("listing fallback uses the existing does-not-say response when a fact is absent", () => {
  const answer = fallbackAnswer(
    "Is transportation provided?",
    { transportationNotes: null } as OpportunityRow,
    {} as OrganizationRow,
  );

  assert.match(answer, /^The listing does not say/);
});
