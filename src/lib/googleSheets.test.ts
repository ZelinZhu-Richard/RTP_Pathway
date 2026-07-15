import assert from "node:assert/strict";
import test from "node:test";
import { GoogleAuth } from "google-auth-library";
import { initializeGoogleSheet, runWithGoogleSheetsTimeout } from "./googleSheets";
import { SUBMISSION_SHEET_HEADERS } from "./googleSheetsPayload";

const ENV_KEYS = [
  "GOOGLE_SHEETS_SYNC_ENABLED",
  "GOOGLE_SHEETS_SPREADSHEET_ID",
  "GOOGLE_SHEETS_TAB",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
] as const;

function configureSheets() {
  process.env.GOOGLE_SHEETS_SYNC_ENABLED = "true";
  process.env.GOOGLE_SHEETS_SPREADSHEET_ID = "spreadsheet-test";
  process.env.GOOGLE_SHEETS_TAB = "Submissions";
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "service@example.test";
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "test-private-key-material-that-must-not-leak";
}

async function withMocks(
  fetchMock: typeof fetch,
  run: () => Promise<void>,
): Promise<void> {
  const previousEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  const previousFetch = globalThis.fetch;
  const previousGetAccessToken = GoogleAuth.prototype.getAccessToken;
  configureSheets();
  globalThis.fetch = fetchMock;
  GoogleAuth.prototype.getAccessToken = async () => "test-access-token";
  try {
    await run();
  } finally {
    globalThis.fetch = previousFetch;
    GoogleAuth.prototype.getAccessToken = previousGetAccessToken;
    for (const key of ENV_KEYS) {
      const value = previousEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("Sheet setup initializes an empty header with RAW values and validates it on retry", async () => {
  const calls: { url: string; method: string; body: string | null }[] = [];
  await withMocks(
    (async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? init.body : null,
      });
      if ((init?.method ?? "GET") === "GET") {
        return new Response(JSON.stringify({ values: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({ updatedRange: "Submissions!A1:AO1" }), { status: 200 });
    }) as typeof fetch,
    async () => {
      const result = await initializeGoogleSheet();
      assert.equal(result.ok, true);
      assert.equal(result.outcome, "initialized");
    },
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[1].method, "PUT");
  assert.match(calls[1].url, /valueInputOption=RAW/);
  assert.deepEqual(JSON.parse(calls[1].body ?? "{}").values[0], [...SUBMISSION_SHEET_HEADERS]);

  let callCount = 0;
  await withMocks(
    (async () => {
      callCount += 1;
      return new Response(JSON.stringify({ values: [[...SUBMISSION_SHEET_HEADERS]] }), { status: 200 });
    }) as typeof fetch,
    async () => {
      const result = await initializeGoogleSheet();
      assert.equal(result.ok, true);
      assert.equal(result.outcome, "validated");
    },
  );
  assert.equal(callCount, 1);
});

test("Sheet setup fails closed on a header mismatch and retryable Google errors", async () => {
  await withMocks(
    (async () => new Response(JSON.stringify({ values: [["submission_id", "old_schema"]] }), { status: 200 })) as typeof fetch,
    async () => {
      const result = await initializeGoogleSheet();
      assert.equal(result.ok, false);
      assert.equal(result.outcome, "failed");
      assert.match(result.error ?? "", /^schema_mismatch:/);
    },
  );

  for (const status of [429, 500]) {
    await withMocks(
      (async () =>
        new Response(JSON.stringify({ error: { status: "UNAVAILABLE", message: "temporary failure" } }), {
          status,
        })) as typeof fetch,
      async () => {
        const result = await initializeGoogleSheet();
        assert.equal(result.ok, false);
        assert.match(result.error ?? "", new RegExp(`^google_${status}:`));
      },
    );
  }
});

test("Sheet setup is disabled without contacting Google", async () => {
  const previous = process.env.GOOGLE_SHEETS_SYNC_ENABLED;
  process.env.GOOGLE_SHEETS_SYNC_ENABLED = "false";
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("fetch should not be called");
  }) as typeof fetch;
  try {
    const result = await initializeGoogleSheet();
    assert.equal(result.outcome, "disabled");
  } finally {
    globalThis.fetch = previousFetch;
    if (previous === undefined) delete process.env.GOOGLE_SHEETS_SYNC_ENABLED;
    else process.env.GOOGLE_SHEETS_SYNC_ENABLED = previous;
  }
});

test("Google Sheets requests abort at the bounded timeout", async () => {
  let aborted = false;
  await assert.rejects(
    runWithGoogleSheetsTimeout((currentSignal) => {
      currentSignal.addEventListener("abort", () => {
        aborted = true;
      });
      return new Promise<never>(() => undefined);
    }, 10),
    /did not respond within 5 seconds/,
  );
  assert.equal(aborted, true);
});
