import assert from "node:assert/strict";
import { test } from "node:test";
import { SPEC_QUOTES, normalizeWhitespace, specQuote, verifyAllSpecQuotes, verifySpecQuote } from "../src/spec-quotes.mjs";

test("normalizeWhitespace strips list markers, bold/italic emphasis, and collapses line wraps", () => {
  assert.equal(normalizeWhitespace("- **Bold rule.** Some\nwrapped   text."), "Bold rule. Some wrapped text.");
  assert.equal(normalizeWhitespace("1. A numbered *item* here."), "A numbered item here.");
});

test("every registered spec quote verifies against a body text containing it verbatim", () => {
  const body = "- **A rule.** With detail.";
  const result = verifySpecQuote({ id: "x", source: "economics", quote: "A rule. With detail." }, body);
  assert.equal(result.ok, true);
});

test("a quote missing from its cited body fails verification with a named reason", () => {
  const result = verifySpecQuote({ id: "missing-quote", source: "economics", quote: "Something never written." }, "unrelated text");
  assert.equal(result.ok, false);
  assert.match(result.reason, /missing-quote/u);
});

test("verifyAllSpecQuotes throws naming every failing quote when a source body is empty", () => {
  assert.throws(() => verifyAllSpecQuotes({ economics: "", governance: "" }), (error) => {
    for (const spec of SPEC_QUOTES) assert.match(error.message, new RegExp(spec.id, "u"));
    return true;
  });
});

test("specQuote resolves a registered id and throws on an unknown one", () => {
  const first = SPEC_QUOTES[0];
  assert.equal(specQuote(first.id).quote, first.quote);
  assert.throws(() => specQuote("no-such-quote-id"), /no-such-quote-id/u);
});

test("every registered quote id is unique", () => {
  const ids = SPEC_QUOTES.map((spec) => spec.id);
  assert.equal(new Set(ids).size, ids.length);
});
