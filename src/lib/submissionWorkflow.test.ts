import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { GoogleAuth } from "google-auth-library";
import { NextRequest } from "next/server";
import { SUBMISSION_SHEET_HEADERS } from "./googleSheetsPayload";

test("a Sheets outage preserves HTTP 201 and a later retry syncs the same local submission", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "rtp-pathway-submission-test-"));
  const envKeys = [
    "DATABASE_PATH",
    "ADMIN_PASSWORD",
    "GOOGLE_SHEETS_SYNC_ENABLED",
    "GOOGLE_SHEETS_SPREADSHEET_ID",
    "GOOGLE_SHEETS_TAB",
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  ] as const;
  const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  process.env.DATABASE_PATH = path.join(directory, "test.db");
  process.env.ADMIN_PASSWORD = "workflow-test-admin-password";
  process.env.GOOGLE_SHEETS_SYNC_ENABLED = "true";
  process.env.GOOGLE_SHEETS_SPREADSHEET_ID = "spreadsheet-test";
  process.env.GOOGLE_SHEETS_TAB = "Submissions";
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "service@example.test";
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "test-private-key-material-that-must-not-leak";

  const previousFetch = globalThis.fetch;
  const previousGetAccessToken = GoogleAuth.prototype.getAccessToken;
  GoogleAuth.prototype.getAccessToken = async () => "test-access-token";
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: { status: "UNAVAILABLE", message: "temporary outage" } }), {
      status: 503,
    })) as typeof fetch;

  try {
    const [
      { POST },
      { POST: reviewSubmission },
      { db },
      { opportunities, submissions },
      { syncSubmissionToGoogleSheet },
      { ADMIN_COOKIE, mintSessionCookie },
      { searchOpportunities },
      { logSearchEvent },
      { computeAnalytics },
    ] = await Promise.all([
      import("@/app/api/submissions/route"),
      import("@/app/api/admin/submissions/[id]/route"),
      import("@/db/client"),
      import("@/db/schema"),
      import("@/lib/googleSheets"),
      import("@/lib/auth"),
      import("@/db/queries"),
      import("@/lib/searchEvents"),
      import("@/db/analytics"),
    ]);
    const request = new NextRequest("http://localhost/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          orgName: "Workflow Test Organization",
          title: "Workflow Test Internship",
          description: "A safe integration fixture",
          category: "internship",
          city: "Durham",
          format: "in_person",
          applicationUrl: "https://example.test/apply",
          deadlineType: "rolling",
        },
      }),
    });
    const response = await POST(request);
    const body = (await response.json()) as { id: string; sheetSyncStatus: string };
    assert.equal(response.status, 201);
    assert.equal(body.sheetSyncStatus, "failed");
    assert.equal(db.select().from(submissions).get()?.sheetSyncStatus, "failed");

    let remoteHasRow = false;
    let appendCount = 0;
    let updateCount = 0;
    let updatedSheetValues: unknown[][] | null = null;
    globalThis.fetch = (async (_input, init) => {
      if ((init?.method ?? "GET") === "GET") {
        return new Response(
          JSON.stringify({
            values: remoteHasRow
              ? [[...SUBMISSION_SHEET_HEADERS], [body.id]]
              : [[...SUBMISSION_SHEET_HEADERS]],
          }),
          { status: 200 },
        );
      }
      if (init?.method === "PUT") {
        updateCount += 1;
        updatedSheetValues = JSON.parse(String(init.body ?? "{}"))?.values ?? null;
        return new Response(JSON.stringify({ updatedRange: "Submissions!A2:AO2" }), { status: 200 });
      }
      appendCount += 1;
      remoteHasRow = true;
      return new Response(
        JSON.stringify({ updates: { updatedRange: "Submissions!A2:AO2" } }),
        { status: 200 },
      );
    }) as typeof fetch;
    const retried = await syncSubmissionToGoogleSheet(body.id);
    assert.equal(retried.status, "synced");
    assert.equal(db.select().from(submissions).get()?.sheetSyncStatus, "synced");

    const session = await mintSessionCookie();
    assert.ok(session);
    const reviewedFields = {
      orgName: "Workflow Test Organization",
      title: "Workflow Test Internship Reviewed",
      description: "A safe integration fixture",
      category: "internship",
      city: "Durham",
      format: "in_person",
      applicationUrl: "https://example.test/apply",
      deadlineType: "rolling",
    };
    const approval = await reviewSubmission(
      new NextRequest(`http://localhost/api/admin/submissions/${body.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${ADMIN_COOKIE}=${session}`,
        },
        body: JSON.stringify({ action: "approve", fields: reviewedFields }),
      }),
      { params: Promise.resolve({ id: body.id }) },
    );
    const approvalBody = (await approval.json()) as {
      status: string;
      opportunityId: string;
      sheetSyncStatus: string;
    };
    assert.equal(approval.status, 200);
    assert.equal(approvalBody.status, "approved");
    assert.equal(approvalBody.sheetSyncStatus, "synced");
    assert.equal(appendCount, 1);
    assert.equal(updateCount, 1);
    assert.equal(
      updatedSheetValues?.[0]?.[SUBMISSION_SHEET_HEADERS.indexOf("title")],
      "Workflow Test Internship Reviewed",
    );
    assert.equal(db.select().from(opportunities).get()?.id, approvalBody.opportunityId);

    const publicSearch = searchOpportunities({ q: "Workflow Test Internship Reviewed" }, { limit: 12 });
    assert.equal(publicSearch.total, 1);
    assert.equal(publicSearch.results[0]?.id, approvalBody.opportunityId);
    assert.equal(
      logSearchEvent("keyword", "Workflow Test Internship", { category: "internship" }, 1),
      true,
    );
    const dashboard = computeAnalytics();
    assert.equal(dashboard.totals.searches30d, 1);
    assert.equal(
      dashboard.demandSupplyByCategory.find((row) => row.key === "internship")?.searches,
      1,
    );
  } finally {
    globalThis.fetch = previousFetch;
    GoogleAuth.prototype.getAccessToken = previousGetAccessToken;
    for (const key of envKeys) {
      const value = previousEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
