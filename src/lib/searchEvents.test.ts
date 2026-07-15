import assert from "node:assert/strict";
import test from "node:test";
import { analyticsFilters, sanitizeQueryText, SearchEventRequestSchema } from "./searchEvents";

test("query logging redacts direct identifiers and control characters", () => {
  const sanitized = sanitizeQueryText(
    "Email me\nstudent@example.com or call (919) 555-1212; details at https://example.com/private",
  );
  assert.equal(sanitized, "Email me [email] or call [phone]; details at [link]");
});

test("analytics filters omit free text and presentation state", () => {
  assert.deepEqual(
    analyticsFilters({
      q: "student name",
      keywords: ["health"],
      category: "internship",
      city: "Durham",
      grade: 10,
      sort: "newest",
    }),
    { category: "internship", city: "Durham", grade: 10 },
  );
});

test("public search-event contract rejects unknown or invalid dimensions", () => {
  assert.equal(
    SearchEventRequestSchema.safeParse({
      filters: { category: "not-a-category" },
    }).success,
    false,
  );
  assert.equal(
    SearchEventRequestSchema.safeParse({
      filters: { category: "internship", userId: "do-not-store" },
    }).success,
    false,
  );
  assert.equal(
    SearchEventRequestSchema.safeParse({
      mode: "nl",
      queryText: "spoofed label",
      filters: { category: "internship" },
    }).success,
    false,
  );
});
