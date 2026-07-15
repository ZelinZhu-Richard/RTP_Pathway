import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

test("database search totals, pagination, explicit logging, and demand/supply reconcile", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "rtp-pathway-db-test-"));
  process.env.DATABASE_PATH = path.join(directory, "test.db");

  const [{ db }, schema, { searchOpportunities }, { logSearchEvent }, { computeAnalytics }] =
    await Promise.all([
      import("@/db/client"),
      import("@/db/schema"),
      import("@/db/queries"),
      import("@/lib/searchEvents"),
      import("@/db/analytics"),
    ]);

  db.insert(schema.organizations)
    .values({ id: "org-test", name: "Test Organization", nameNormalized: "test organization" })
    .run();
  for (let index = 1; index <= 3; index += 1) {
    db.insert(schema.opportunities)
      .values({
        id: `opp-${index}`,
        orgId: "org-test",
        title: `Test Internship ${index}`,
        slug: `test-internship-${index}`,
        description: "A test opportunity",
        category: "internship",
        format: "in_person",
        city: "Durham",
        costType: "free",
        compensation: "none",
        status: "approved",
      })
      .run();
  }

  const firstPage = searchOpportunities({ category: "internship" }, { limit: 2 });
  const secondPage = searchOpportunities({ category: "internship" }, { limit: 2, offset: 2 });
  assert.equal(firstPage.total, 3);
  assert.equal(firstPage.results.length, 2);
  assert.equal(secondPage.total, 3);
  assert.equal(secondPage.results.length, 1);

  assert.equal(
    logSearchEvent(
      "keyword",
      "Find something for Jane Doe at East Chapel Hill High",
      { category: "internship" },
      firstPage.total,
    ),
    true,
  );
  const event = db.select().from(schema.searchEvents).get();
  assert.equal(event?.queryText, "[keyword query]");
  assert.deepEqual(JSON.parse(event?.filters ?? "{}"), { category: "internship" });

  const analytics = computeAnalytics();
  const internship = analytics.demandSupplyByCategory.find((row) => row.key === "internship");
  assert.equal(analytics.totals.searches30d, 1);
  assert.equal(internship?.searches, 1);
  assert.equal(internship?.activeListings, 3);
  assert.equal(internship?.demandPerListing, 0.3);
});
