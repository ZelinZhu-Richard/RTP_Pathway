import assert from "node:assert/strict";
import test from "node:test";

import { ListingFieldsSchema, SubmissionBodySchema } from "./submissionSchema";

const URL_FIELDS = ["applicationUrl", "sourceUrl"] as const;
const PLACEHOLDERS = ["N/A", "NA", "TBD", "unknown", "none", "?", "-", "--"];

test("rejects placeholder values in URL fields", () => {
  for (const field of URL_FIELDS) {
    for (const placeholder of PLACEHOLDERS) {
      const result = ListingFieldsSchema.safeParse({ [field]: `  ${placeholder}  ` });
      assert.equal(result.success, false, `${field} accepted ${placeholder}`);
    }
  }
});

test("rejects placeholders with an explicit HTTP(S) prefix", () => {
  for (const field of URL_FIELDS) {
    for (const value of ["https://N/A", "http://na", "HTTPS://TBD/", "https://Unknown/"]) {
      const result = ListingFieldsSchema.safeParse({ [field]: value });
      assert.equal(result.success, false, `${field} accepted ${value}`);
    }
  }
});

test("keeps blank URL fields optional", () => {
  const parsed = ListingFieldsSchema.parse({ applicationUrl: "   ", sourceUrl: "" });
  assert.equal(parsed.applicationUrl, undefined);
  assert.equal(parsed.sourceUrl, undefined);
});

test("prefixes valid bare domains and preserves valid HTTPS URLs", () => {
  const parsed = ListingFieldsSchema.parse({
    applicationUrl: "example.org/apply",
    sourceUrl: "  https://example.org/source?q=1  ",
  });

  assert.equal(parsed.applicationUrl, "https://example.org/apply");
  assert.equal(parsed.sourceUrl, "https://example.org/source?q=1");
});

test("does not confuse real domains with placeholder tokens", () => {
  const parsed = ListingFieldsSchema.parse({
    applicationUrl: "none.com",
    sourceUrl: "unknown.org/program",
  });

  assert.equal(parsed.applicationUrl, "https://none.com");
  assert.equal(parsed.sourceUrl, "https://unknown.org/program");
});

test("continues to reject unsafe URL schemes", () => {
  for (const field of URL_FIELDS) {
    for (const value of ["javascript:alert(1)", "ftp://example.org/file"]) {
      const result = ListingFieldsSchema.safeParse({ [field]: value });
      assert.equal(result.success, false, `${field} accepted ${value}`);
    }
  }
});

test("strips client-claimed extraction metadata from public submissions", () => {
  const parsed = SubmissionBodySchema.parse({
    fields: { title: "Validated title" },
    extractedFields: { title: "Client-claimed AI title", assumptions: ["untrusted"] },
  });

  assert.equal("extractedFields" in parsed, false);
});
