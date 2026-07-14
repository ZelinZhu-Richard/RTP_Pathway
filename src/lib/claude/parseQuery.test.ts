import assert from "node:assert/strict";
import test from "node:test";

import { fallbackParse } from "./parseQuery";

test("matches UNC as a standalone Chapel Hill synonym", () => {
  assert.equal(fallbackParse("Show me programs at UNC").city, "Chapel Hill");
});

test("does not match UNC inside lunch", () => {
  assert.equal(fallbackParse("Are there programs that provide lunch?").city, undefined);
});

test("matches Cary only as a complete word", () => {
  assert.equal(fallbackParse("Show me opportunities in Cary").city, "Cary");
  assert.equal(fallbackParse("This opportunity sounds scary").city, undefined);
});

test("matches multiword terms and preserves longest-term selection", () => {
  assert.equal(fallbackParse("I want a work experience opportunity").category, "internship");
});
