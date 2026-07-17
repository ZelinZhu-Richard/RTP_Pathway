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
        eligibilityNotes: index === 1 ? "High-school students in the Triangle" : null,
        whatYoullDo: index === 1 ? "Work with a local mentor" : null,
        contactEmail: index === 1 ? "private@example.com" : null,
        status: "approved",
      })
      .run();
  }
  db.insert(schema.opportunities)
    .values([
      {
        id: "opp-archived",
        orgId: "org-test",
        title: "Archived Internship",
        slug: "archived-internship",
        description: "No longer public",
        category: "internship",
        format: "in_person",
        city: "Durham",
        status: "archived",
      },
      {
        id: "opp-expired",
        orgId: "org-test",
        title: "Expired Internship",
        slug: "expired-internship",
        description: "Deadline has passed",
        category: "internship",
        format: "in_person",
        city: "Durham",
        applicationDeadline: "2000-01-01",
        status: "approved",
      },
    ])
    .run();

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

  const [{ NextRequest }, publicOpportunityRoute, nlSearchRoute] = await Promise.all([
    import("next/server"),
    import("@/app/api/opportunities/[id]/route"),
    import("@/app/api/nl-search/route"),
  ]);

  const detailResponse = await publicOpportunityRoute.GET(
    new NextRequest("http://localhost/api/opportunities/opp-1"),
    { params: Promise.resolve({ id: "opp-1" }) },
  );
  assert.equal(detailResponse.status, 200);
  const detailBody = (await detailResponse.json()) as { opportunity: Record<string, unknown> };
  assert.deepEqual(Object.keys(detailBody.opportunity).sort(), [
    "ageMax",
    "ageMin",
    "applicationDeadline",
    "category",
    "city",
    "compensation",
    "compensationDetail",
    "costAmount",
    "costType",
    "description",
    "eligibility",
    "format",
    "gradeMax",
    "gradeMin",
    "id",
    "interestTags",
    "lastVerifiedAt",
    "orgName",
    "schedule",
    "slug",
    "sourceUrl",
    "timeCommitment",
    "title",
    "whatYoullDo",
  ]);
  assert.equal(detailBody.opportunity.eligibility, "High-school students in the Triangle");
  assert.equal("contactEmail" in detailBody.opportunity, false);
  assert.equal("status" in detailBody.opportunity, false);

  for (const id of ["opp-archived", "opp-expired", "opp-missing"]) {
    const response = await publicOpportunityRoute.GET(
      new NextRequest(`http://localhost/api/opportunities/${id}`),
      { params: Promise.resolve({ id }) },
    );
    assert.equal(response.status, 404);
  }

  const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const eventCountBeforeNlSearch = db.select().from(schema.searchEvents).all().length;
    const nlResponse = await nlSearchRoute.POST(
      new NextRequest("http://localhost/api/nl-search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: "internships in Durham", pageSize: 2 }),
      }),
    );
    assert.equal(nlResponse.status, 200);
    const nlBody = (await nlResponse.json()) as {
      results: unknown[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
    assert.equal(nlBody.results.length, 2);
    assert.equal(nlBody.total, 3);
    assert.equal(nlBody.page, 1);
    assert.equal(nlBody.pageSize, 2);
    assert.equal(nlBody.totalPages, 2);
    assert.equal(
      db.select().from(schema.searchEvents).all().length,
      eventCountBeforeNlSearch + 1,
    );

    const invalidPageSizeResponse = await nlSearchRoute.POST(
      new NextRequest("http://localhost/api/nl-search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: "internships", pageSize: 49 }),
      }),
    );
    assert.equal(invalidPageSizeResponse.status, 400);
    assert.equal(
      db.select().from(schema.searchEvents).all().length,
      eventCountBeforeNlSearch + 1,
    );
  } finally {
    if (originalAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
  }
});
