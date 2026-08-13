import assert from "node:assert/strict";
import test from "node:test";

import { checkDiscovery, checkRecords, provenanceHash, readRecords } from "./validate.mjs";

// node --test validate.test.mjs

const work = "https://github.com/acme/widget";
const example = "471e3dc7467c3c9f83be8199e5ed76b2635a0aefc86b2e3679ffc836fc9c741c";

test("the hash is the one in the spec", () => {
  assert.equal(provenanceHash("ExampleModel v2", "AI Corp", "2026-08-12T14:30:00Z", work), example);
});

test("whitespace around a field does not change the digest", () => {
  assert.equal(provenanceHash("  ExampleModel v2 ", "AI Corp\t", " 2026-08-12T14:30:00Z", work), example);
});

test("both serialisations read to the same record", () => {
  const markdown = [
    "| System | Operator | Date and Time (UTC) | Scope | Purpose | Contact | Provenance Hash |",
    "| :--- | :--- | :--- | :--- | :--- | :--- | :--- |",
    `| ExampleModel v2 | AI Corp | 2026-08-12T14:30:00Z | whole repository | training | ai@corp.com | \`${example}\` |`,
  ].join("\n");
  const jsonl = JSON.stringify({
    system: "ExampleModel v2", operator: "AI Corp", date: "2026-08-12T14:30:00Z",
    scope: "whole repository", purpose: "training", contact: "ai@corp.com", hash: example,
  });

  const [fromMarkdown] = readRecords(markdown, "markdown");
  const [fromJsonl] = readRecords(jsonl, "jsonl");
  assert.deepEqual(fromMarkdown, fromJsonl);
  assert.deepEqual(checkRecords([fromMarkdown], work), [
    { ok: true, who: "ExampleModel v2 / AI Corp / 2026-08-12T14:30:00Z" },
  ]);
});

test("a record that does not agree with its own fields is refused", () => {
  const record = {
    system: "ExampleModel v2", operator: "Someone Else", date: "2026-08-12T14:30:00Z",
    contact: "ai@corp.com", hash: example,
  };
  const [result] = checkRecords([record], work);
  assert.equal(result.ok, false);
  assert.match(result.why, /expected [0-9a-f]{64}/);
});

test("the same record against a different work is a different record", () => {
  const [result] = checkRecords(
    [{ system: "ExampleModel v2", operator: "AI Corp", date: "2026-08-12T14:30:00Z",
       contact: "ai@corp.com", hash: example }],
    "https://github.com/acme/other",
  );
  assert.equal(result.ok, false);
});

test("a date without a timezone is not ISO 8601 enough to hash", () => {
  const [result] = checkRecords(
    [{ system: "M", operator: "O", date: "2026-08-12 14:30", contact: "a@b.com", hash: example }],
    work,
  );
  assert.match(result.why, /not ISO 8601/);
});

test("a discovery document is checked for the things that break the hash", () => {
  assert.deepEqual(checkDiscovery({ pou: "0.1", work, record: { path: "PROOF_OF_USAGE.md" } }), []);

  const problems = checkDiscovery({
    pou: "one", work: `${work}/`, record: { path: "R.md", format: "yaml" },
    transports: [{ type: "endpoint" }], basis: "vibes",
  });
  assert.equal(problems.length, 5);
  assert.ok(problems.some((p) => p.includes("trailing slash")));
  assert.ok(problems.some((p) => p.includes("endpoint needs an https url")));
});
