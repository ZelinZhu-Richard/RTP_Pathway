import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { submissions } from "@/db/schema";
import { findDuplicates } from "@/lib/duplicates";
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
  const { submitterName, submitterEmail, fields, messyText, extractedFields } = parsed.data;

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
  db.insert(submissions)
    .values({
      id,
      source: "web_form",
      submitterName: submitterName ?? null,
      submitterEmail: submitterEmail ?? null,
      orgName: fields.orgName ?? null,
      rawFields: JSON.stringify(fields),
      messyText: messyText?.trim() || null,
      extractedFields: extractedFields ? JSON.stringify(extractedFields) : null,
      missingFields: JSON.stringify(missingFields),
      duplicateWarnings: JSON.stringify(duplicateWarnings),
      status: "pending",
    })
    .run();

  return NextResponse.json({ id, missingFields, duplicateWarnings, status: "pending" }, { status: 201 });
}
