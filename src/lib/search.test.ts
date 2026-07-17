import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  filtersToSearchParams,
  hasActiveFilters,
  parseFilters,
  parsePagination,
} from "./search";

test("search filters and pagination round-trip through the canonical URL", () => {
  const params = filtersToSearchParams(
    {
      q: "  health program  ",
      keywords: ["public health", "mentorship"],
      category: "workshop_course",
      city: "Durham",
      grade: 10,
      schedule: "weekend",
      sort: "newest",
    },
    { page: 3, pageSize: 24 },
  );

  assert.deepEqual(parseFilters(params), {
    q: "health program",
    keywords: ["public health", "mentorship"],
    category: "workshop_course",
    format: undefined,
    cost: undefined,
    compensation: undefined,
    city: "Durham",
    grade: 10,
    schedule: "weekend",
    sort: "newest",
  });
  assert.deepEqual(parsePagination(params), { page: 3, pageSize: 24 });
  assert.deepEqual(params.getAll("keyword"), ["public health", "mentorship"]);
});

test("keyword URL params are normalized, deduplicated, and bounded", () => {
  const params = filtersToSearchParams({
    keywords: ["  Coding  ", "health\u0000care", "coding", "mentorship", "ignored"],
  });

  assert.deepEqual(params.getAll("keyword"), ["Coding", "health care", "mentorship"]);
  assert.deepEqual(parseFilters(params), {
    keywords: ["Coding", "health care", "mentorship"],
    category: undefined,
    format: undefined,
    cost: undefined,
    compensation: undefined,
    city: undefined,
    schedule: undefined,
  });
});

test("legacy comma-separated keyword links remain readable and canonicalize", () => {
  const filters = parseFilters(
    new URLSearchParams("keywords=robotics%2C+design%2Cr%2Crobotics%2Cignored"),
  );

  assert.deepEqual(filters.keywords, ["robotics", "design", "ignored"]);
  assert.equal(filtersToSearchParams(filters).toString(), "keyword=robotics&keyword=design&keyword=ignored");
});

test("pagination rejects invalid pages and caps page size", () => {
  assert.deepEqual(parsePagination(new URLSearchParams("page=-2&pageSize=0")), {
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  assert.deepEqual(parsePagination(new URLSearchParams("page=4&pageSize=999")), {
    page: 4,
    pageSize: MAX_PAGE_SIZE,
  });
});

test("invalid filter values are dropped and presentation-only sort is not demand", () => {
  const filters = parseFilters(new URLSearchParams("category=made_up&grade=99&sort=newest"));
  assert.deepEqual(filters, {
    category: undefined,
    format: undefined,
    cost: undefined,
    compensation: undefined,
    city: undefined,
    schedule: undefined,
    sort: "newest",
  });
  assert.equal(hasActiveFilters(filters), false);
});
