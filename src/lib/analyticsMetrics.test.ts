import assert from "node:assert/strict";
import test from "node:test";
import { buildDemandSupply, parsePipelineImportSummary } from "./analyticsMetrics";

test("category demand reconciles searches, zero results, supply, and no-supply gaps", () => {
  const result = buildDemandSupply(
    [
      { category: "internship", count: 2 },
      { category: "volunteer", count: 4 },
    ],
    [
      { filters: JSON.stringify({ category: "internship" }), resultCount: 2 },
      { filters: JSON.stringify({ category: "internship" }), resultCount: 0 },
      { filters: JSON.stringify({ category: "scholarship" }), resultCount: 0 },
      { filters: JSON.stringify({ city: "Durham" }), resultCount: 4 },
      { filters: "not-json", resultCount: 0 },
    ],
  );

  assert.equal(result.categorizedSearches, 3);
  const internship = result.data.find((row) => row.key === "internship");
  assert.deepEqual(internship, {
    key: "internship",
    label: "Internship",
    searches: 2,
    activeListings: 2,
    zeroResultSearches: 1,
    demandPerListing: 1,
    noSupply: false,
  });
  const scholarship = result.data.find((row) => row.key === "scholarship");
  assert.equal(scholarship?.noSupply, true);
  assert.equal(scholarship?.demandPerListing, null);
  assert.equal(result.data[0].key, "scholarship");
});

test("pipeline audit parsing strips paths and marks demo sources", () => {
  assert.deepEqual(
    parsePipelineImportSummary(
      JSON.stringify({
        sources: ["/tmp/data/seed_opportunities_raw.csv", "C:\\feeds\\partner.csv"],
        rows: 44,
        inserted: 39,
        queued: 4,
        skipped: 1,
      }),
      "2026-07-14T10:00:00.000Z",
    ),
    {
      createdAt: "2026-07-14T10:00:00.000Z",
      sources: ["seed_opportunities_raw.csv", "partner.csv"],
      rows: 44,
      inserted: 39,
      queued: 4,
      skipped: 1,
      usesDemoData: true,
    },
  );
});
