#!/usr/bin/env node
// SPDX-License-Identifier: CC0-1.0
/**
 * Check what a work published.
 *
 *   node validate.mjs proof-of-usage.json
 *   node validate.mjs PROOF_OF_USAGE.md   [--work https://github.com/acme/widget]
 *   node validate.mjs proof-of-usage.jsonl [--work …]
 *
 * A discovery document is checked for shape. A record file is checked the only way records can be:
 * every hash is recomputed from the record's own four fields and compared with what was written.
 * That check needs no network, no server, and nobody's cooperation — which is the reason the hash
 * is defined the way it is.
 *
 * If --work is omitted for a record file, the discovery document beside it supplies the URL.
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, basename } from "node:path";

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith("--"));
const option = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};

/** SHA-256("system:operator:date:work"), lowercase hex. */
export function provenanceHash(system, operator, date, work) {
  const parts = [system, operator, date, work].map((v) => String(v ?? "").trim());
  if (parts.some((p) => !p)) {
    throw new Error("system, operator, date and work are all required");
  }
  return createHash("sha256").update(parts.join(":"), "utf8").digest("hex");
}

const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const digest = /^[0-9a-f]{64}$/;
const contactish = /^([^@\s]+@[^@\s]+\.[^@\s]+|https?:\/\/\S+)$/;

/** The problems with a discovery document, in reading order. Empty means it is fine. */
export function checkDiscovery(document) {
  const problems = [];
  const say = (what) => problems.push(what);

  if (!/^\d+\.\d+$/.test(document.pou ?? "")) say('pou: expected a version like "0.1"');
  if (!/^https?:\/\/\S+$/.test(document.work ?? "")) say("work: expected the work's canonical URL");
  if (document.work?.endsWith("/")) say("work: no trailing slash — it is hashed exactly as written");

  const record = document.record;
  if (!record || typeof record !== "object") {
    say("record: expected an object saying where the record file lives");
  } else {
    if (!record.path) say("record.path: expected a path within the work");
    if (record.format && !["markdown", "jsonl"].includes(record.format)) {
      say('record.format: expected "markdown" or "jsonl"');
    }
  }

  for (const transport of document.transports ?? []) {
    if (!["pull_request", "endpoint"].includes(transport.type)) {
      say(`transports: "${transport.type}" is not a transport this version defines`);
    }
    if (transport.type === "endpoint" && !/^https:\/\/\S+$/.test(transport.url ?? "")) {
      say("transports: an endpoint needs an https url");
    }
  }

  if (document.basis && !["request", "licence"].includes(document.basis)) {
    say('basis: expected "request" or "licence"');
  }
  if (document.contact && !contactish.test(document.contact)) {
    say("contact: expected an email address or a URL");
  }
  return problems;
}

/** Records read out of either serialisation, in file order. */
export function readRecords(text, format) {
  if (format === "jsonl") {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        try {
          return JSON.parse(line);
        } catch {
          return { broken: `line ${index + 1} is not JSON` };
        }
      });
  }

  const keys = ["system", "operator", "date", "scope", "purpose", "contact", "hash"];
  // Comments come out first: a record file that explains its own shape usually does it with a
  // sample row, and a sample row read as a record is a record of something that never happened.
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && !/^\|[\s:|-]+\|$/.test(line))
    .map((line) => line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()))
    .filter((cells) => cells.length === 7 && !/^system$/i.test(cells[0]))
    .map((cells) => Object.fromEntries(keys.map((key, i) => [key, cells[i].replace(/`/g, "")])));
}

/** One line per record: whether it agrees with itself, and where it does not. */
export function checkRecords(records, work) {
  return records.map((record) => {
    if (record.broken) return { ok: false, why: record.broken };

    const { system, operator, date, contact, hash } = record;
    const who = `${system} / ${operator} / ${date}`;
    if (!iso.test(date ?? "")) return { ok: false, who, why: `"${date}" is not ISO 8601` };
    if (!digest.test((hash ?? "").toLowerCase())) {
      return { ok: false, who, why: "the hash is not a lowercase SHA-256 hex digest" };
    }
    if (!contactish.test(contact ?? "")) {
      return { ok: false, who, why: `"${contact}" is not an address a question can be sent to` };
    }

    const expected = provenanceHash(system, operator, date, work);
    return hash.toLowerCase() === expected
      ? { ok: true, who }
      : { ok: false, who, why: `recorded ${hash}\n     expected ${expected}` };
  });
}

if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  if (!file || !existsSync(file)) {
    console.error(`usage: node validate.mjs <proof-of-usage.json | PROOF_OF_USAGE.md | *.jsonl> [--work URL]`);
    process.exit(2);
  }

  const text = readFileSync(file, "utf8");

  if (file.endsWith(".json") && !file.endsWith(".jsonl")) {
    let document;
    try {
      document = JSON.parse(text);
    } catch (error) {
      console.error(`not JSON: ${error.message}`);
      process.exit(1);
    }
    const problems = checkDiscovery(document);
    for (const problem of problems) console.log(`BAD  ${problem}`);
    console.log(problems.length ? `\n${problems.length} problem(s)` : "ok — discovery document");
    process.exit(problems.length ? 1 : 0);
  }

  // A record file needs the work's URL to check anything, and the discovery document beside it is
  // where that URL is declared. Guessing it from a remote would be guessing at the answer.
  let work = option("work");
  if (!work) {
    const beside = join(dirname(file), "proof-of-usage.json");
    if (existsSync(beside)) work = JSON.parse(readFileSync(beside, "utf8")).work;
  }
  if (!work) {
    console.error("no --work given and no proof-of-usage.json beside the record file");
    process.exit(2);
  }

  const results = checkRecords(readRecords(text, file.endsWith(".jsonl") ? "jsonl" : "markdown"), work);
  for (const result of results) {
    console.log(`${result.ok ? "ok  " : "BAD "} ${result.who ?? ""}${result.ok ? "" : `\n     ${result.why}`}`);
  }
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length} record(s) against ${work}, ${bad} that do not agree with themselves`);
  process.exit(bad ? 1 : 0);
}
