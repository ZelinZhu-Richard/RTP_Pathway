import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { submissions } from "@/db/schema";
import { findDuplicates } from "@/lib/duplicates";
import { isGoogleSheetsSyncEnabled, syncSubmissionToGoogleSheet } from "@/lib/googleSheets";
import { SubmissionBodySchema, missingListingFields } from "@/lib/submissionSchema";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = SubmissionBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid submission", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 400 },
    );
  }
  const { submitterName, submitterEmail, fields, messyText } = parsed.data;

  if (!fields.orgName && !fields.title && !messyText?.trim()) {
    return NextResponse.json(
      { error: "Provide at least an organization, a title, or a program description." },
      { status: 400 },
    );
  }

  const missingFields = missingListingFields(fields);
  const duplicateWarnings = findDuplicates({
    title: fields.title,
    orgName: fields.orgName,
    applicationUrl: fields.applicationUrl,
  });

  const id = randomUUID();
  const initialSheetSyncStatus = isGoogleSheetsSyncEnabled() ? "pending" : "disabled";
  db.insert(submissions)
    .values({
      id,
      source: "web_form",
      submitterName: submitterName ?? null,
      submitterEmail: submitterEmail ?? null,
      orgName: fields.orgName ?? null,
      rawFields: JSON.stringify(fields),
      messyText: messyText?.trim() || null,
      missingFields: JSON.stringify(missingFields),
      duplicateWarnings: JSON.stringify(duplicateWarnings),
      status: "pending",
      sheetSyncStatus: initialSheetSyncStatus,
    })
    .run();

  // SQLite is authoritative: it has committed before this bounded network
  // attempt, and a Google outage must never turn a saved submission into a
  // public-facing failure.
  let sheetSyncStatus = initialSheetSyncStatus;
  try {
    sheetSyncStatus = (await syncSubmissionToGoogleSheet(id)).status;
  } catch {
    // The integration records expected failures itself. Preserve the local
    // success even if an unexpected integration error escapes.
  }

  return NextResponse.json(
    { id, missingFields, duplicateWarnings, status: "pending", sheetSyncStatus },
    { status: 201 },
  );
}
