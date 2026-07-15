import { loadEnvConfig } from "@next/env";
import { and, asc, eq, inArray } from "drizzle-orm";

async function main() {
  loadEnvConfig(process.cwd());

  // Load config consumers only after Next has populated process.env.
  const { initializeGoogleSheet, syncSubmissionToGoogleSheet } = await import("../src/lib/googleSheets");
  const setup = await initializeGoogleSheet();
  if (!setup.ok) {
    console.error(`Google Sheets retry stopped: ${setup.error ?? "configuration validation failed"}`);
    process.exitCode = 1;
    return;
  }

  const [{ db }, { submissions }] = await Promise.all([
    import("../src/db/client"),
    import("../src/db/schema"),
  ]);

  const queued = db
    .select({ id: submissions.id })
    .from(submissions)
    .where(
      and(
        eq(submissions.source, "web_form"),
        inArray(submissions.sheetSyncStatus, ["pending", "failed"]),
      ),
    )
    .orderBy(asc(submissions.createdAt))
    .all();

  let synced = 0;
  let failed = 0;
  for (const submission of queued) {
    const result = await syncSubmissionToGoogleSheet(submission.id);
    if (result.status === "synced") synced += 1;
    else failed += 1;
  }

  console.log(`Google Sheets retry complete: ${synced} synced, ${failed} failed, ${queued.length} attempted.`);
  if (failed > 0) process.exitCode = 1;
}

void main().catch(() => {
  // Detailed sanitized errors are persisted for admins; do not dump secrets.
  console.error("Google Sheets retry failed unexpectedly.");
  process.exitCode = 1;
});
