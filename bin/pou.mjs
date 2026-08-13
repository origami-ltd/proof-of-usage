#!/usr/bin/env node
// SPDX-License-Identifier: CC0-1.0
/**
 * proof-of-usage — the reference implementation of PoU/1.0.
 *
 *   hash     the provenance digest for one access
 *   row      the same access as a table row, ready to paste
 *   record   find where a work takes records, and send one
 *   verify   recompute every hash in a record file against its own fields
 *   init     publish the protocol on a work you keep
 *
 * Nothing here is privileged. The digest is nine lines of SHA-256 and the file formats are two
 * paragraphs of the spec; a second implementation by someone who has never seen this file should
 * agree with it exactly, and if it does not, one of the two is wrong and the spec says which.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { checkDiscovery, checkRecords, provenanceHash, readRecords } from "../validate.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const argv = process.argv.slice(2);
const command = argv[0] && !argv[0].startsWith("-") ? argv[0] : "help";
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};

const quiet = (cmd) => {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
};

const HELP = `proof-of-usage — record that a system used a work, and prove which version

  npx proof-of-usage <command> [options]

  hash     print the provenance digest for one access
  row      print the record as a table row
  record   send a record where the work says to send it
  verify   check a record file, or a discovery document
  init     write proof-of-usage.json, PROOF_OF_USAGE.md and NOTICE.md here

Fields
  --system    Model, product or agent, with version        required
  --operator  The organisation or person running it        required
  --contact   An address a question can be sent to         required to record
  --scope     Files, paths, or "whole repository"          default: whole repository
  --purpose   training, retrieval, inference, …            default: training
  --date      ISO 8601                                     default: now
  --work      The work being recorded                      default: this checkout's git origin

Other
  --endpoint  Skip discovery and post the record here
  --dry-run   Say what would be sent, send nothing
  --file      Which file to verify

  https://github.com/origami-ltd/proof-of-usage — the specification, PoU/1.0`;

/** The canonical URL of the work: what was asked for, or what this checkout's origin says. */
function workUrl() {
  const given = opt("work") ?? opt("repo");
  if (given) return given.replace(/\/+$/, "");
  const origin = quiet("git config --get remote.origin.url");
  return origin
    ? origin.replace(/^git@github\.com:/, "https://github.com/").replace(/\.git$/, "").replace(/\/+$/, "")
    : "";
}

function access() {
  return {
    system: opt("system"),
    operator: opt("operator"),
    date: opt("date") ?? new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    scope: opt("scope") ?? opt("what") ?? "whole repository",
    purpose: opt("purpose") ?? "training",
    contact: opt("contact"),
    work: workUrl(),
  };
}

function digestOf(record) {
  try {
    return provenanceHash(record.system, record.operator, record.date, record.work);
  } catch (error) {
    console.error(`${error.message}\n\n${HELP}`);
    process.exit(2);
  }
}

const rowOf = (r, hash) =>
  `| ${r.system} | ${r.operator} | ${r.date} | ${r.scope} | ${r.purpose} | ${r.contact ?? "you@example.com"} | \`${hash}\` |`;

/**
 * Where a work takes records, asked of the work itself rather than assumed.
 *
 * The discovery document first, at the root of the repository and then at the site's well-known
 * path. Failing both, the endpoint line some licences carry — that predates the discovery document
 * and there are repositories in the wild still saying it that way.
 */
async function discover(work) {
  const get = (url) => fetch(url).then((r) => (r.ok ? r.text() : "")).catch(() => "");
  const slug = work.replace(/^https:\/\/github\.com\//, "");
  const candidates = [];

  if (slug !== work) {
    candidates.push(`https://raw.githubusercontent.com/${slug}/HEAD/proof-of-usage.json`);
  } else {
    candidates.push(`${work.replace(/\/+$/, "")}/.well-known/proof-of-usage.json`);
  }

  for (const url of candidates) {
    const body = await get(url);
    if (!body) continue;
    try {
      const document = JSON.parse(body);
      const problems = checkDiscovery(document);
      if (problems.length) {
        console.error(`the discovery document at ${url} has problems:\n  ${problems.join("\n  ")}`);
      }
      return document;
    } catch {
      /* not JSON; fall through to the next candidate */
    }
  }

  if (slug !== work) {
    const licence = await get(`https://raw.githubusercontent.com/${slug}/HEAD/LICENSE.md`);
    const endpoint = licence.match(/PROVENANCE ENDPOINT:\s*(https?:\/\/\S+)/i)?.[1];
    if (endpoint) {
      return { work, transports: [{ type: "endpoint", url: endpoint }], legacy: true };
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ commands */
if (flags.has("--help") || flags.has("-h") || command === "help") {
  console.log(HELP);
  process.exit(0);
}

if (command === "hash" || command === "row") {
  const record = access();
  const hash = digestOf(record);
  console.log(command === "row" ? rowOf(record, hash) : hash);
  process.exit(0);
}

if (command === "verify") {
  const file = opt("file") ?? argv[1] ?? join(root, "PROOF_OF_USAGE.md");
  if (!existsSync(file)) {
    console.error(`no ${file}`);
    process.exit(2);
  }
  const text = readFileSync(file, "utf8");

  if (file.endsWith(".json") && !file.endsWith(".jsonl")) {
    const problems = checkDiscovery(JSON.parse(text));
    for (const problem of problems) console.log(`BAD  ${problem}`);
    console.log(problems.length ? `\n${problems.length} problem(s)` : "ok — discovery document");
    process.exit(problems.length ? 1 : 0);
  }

  let work = opt("work") ?? opt("repo");
  if (!work) {
    const beside = join(dirname(file), "proof-of-usage.json");
    work = existsSync(beside) ? JSON.parse(readFileSync(beside, "utf8")).work : workUrl();
  }
  if (!work) {
    console.error("no --work, no proof-of-usage.json beside the file, and no git origin to borrow");
    process.exit(2);
  }

  const results = checkRecords(readRecords(text, file.endsWith(".jsonl") ? "jsonl" : "markdown"), work);
  for (const r of results) console.log(`${r.ok ? "ok  " : "BAD "} ${r.who ?? ""}${r.ok ? "" : `\n     ${r.why}`}`);
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length} record(s) against ${work}, ${bad} that do not agree with themselves`);
  process.exit(bad ? 1 : 0);
}

if (command === "record") {
  const record = access();
  if (!record.work) {
    console.error(`no --work given and no git origin here to borrow one from\n\n${HELP}`);
    process.exit(2);
  }
  const hash = digestOf(record);
  console.log(rowOf(record, hash));

  const document = opt("endpoint") ? undefined : await discover(record.work);
  const endpoint =
    opt("endpoint") ?? document?.transports?.find((t) => t.type === "endpoint")?.url;

  if (!endpoint) {
    console.log(`
${record.work} takes records by pull request${document ? "" : " (it publishes no proof-of-usage.json, so that is the assumption)"}:
fork it, add the row above to its record file, and open the pull request. Nothing else is needed,
and this is the transport every work supports.

Then put the credit where the product credits things:
  Includes material from ${record.work}
  Proof of usage: ${hash}`);
    process.exit(0);
  }

  if (flags.has("--dry-run")) {
    console.log(`\nwould POST to ${endpoint}`);
    process.exit(0);
  }

  const answer = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...record, repo: record.work, hash }),
  })
    .then((r) => r.json().then((body) => ({ ok: r.ok, body })))
    .catch((error) => ({ ok: false, body: { error: error.message } }));

  if (!answer.ok) {
    console.error(`\n${endpoint} refused it: ${answer.body?.error ?? "no reason given"}
The row above is still the record — open the pull request yourself.`);
    process.exit(1);
  }

  console.log(
    answer.body.alreadyRecorded
      ? `\nalready recorded: ${answer.body.record}`
      : `\npull request opened: ${answer.body.pullRequest}`,
  );
  console.log(`\nHalf one done. Half two, whenever the product ships:
  Includes material from ${record.work}
  Proof of usage: ${hash}`);
  process.exit(0);
}

if (command === "init") {
  const work = workUrl();
  if (!work) {
    console.error("run this inside a checkout with a git origin, or pass --work");
    process.exit(2);
  }
  const basis = opt("basis") ?? "request";
  const branch = opt("branch") ?? "proof-of-usage";
  const endpoint = opt("endpoint");

  const discovery = {
    pou: "1.0",
    work,
    record: { path: "PROOF_OF_USAGE.md", branch, format: "markdown" },
    transports: [
      { type: "pull_request" },
      ...(endpoint ? [{ type: "endpoint", url: endpoint }] : []),
    ],
    ...(opt("contact") ? { contact: opt("contact") } : {}),
    basis,
  };

  const record = `# Proof of usage

Systems that have read, indexed or trained on this work. One record per access, newest at the
bottom. The hash is \`SHA-256("System:Operator:ISODate:${work}")\` and the same digest goes in the
credits of whatever the access produced — [Proof of Usage
PoU/1.0](https://github.com/origami-ltd/proof-of-usage).

| System | Operator | Date and Time (UTC) | Scope | Purpose | Contact | Provenance Hash |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |

<!-- A row looks like this, with the digest of its own four fields in backticks:

     | ExampleModel v2 | AI Corp | 2026-08-12T14:30:00Z | whole repository | training | ai@corp.com | \`<hash>\` |

     It sits in a comment because a sample row inside the table is a record of something that never
     happened, and any tool checking this file would rightly call it a mismatch. -->
`;

  const notice = readFileSync(join(here, "..", "examples", "NOTICE.md"), "utf8")
    .replaceAll("https://github.com/acme/widget", work)
    .replaceAll("acme/widget", work.replace(/^https?:\/\//, ""));

  const files = [
    ["proof-of-usage.json", `${JSON.stringify(discovery, null, 2)}\n`],
    ["PROOF_OF_USAGE.md", record],
    ...(basis === "request" ? [["NOTICE.md", notice]] : []),
  ];

  for (const [name, body] of files) {
    const path = join(root, name);
    if (existsSync(path) && !flags.has("--force")) {
      console.log(`skipped ${name}: already here (--force to replace it)`);
      continue;
    }
    if (flags.has("--dry-run")) {
      console.log(`would write ${name}`);
      continue;
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
    console.log(`wrote ${name}`);
  }

  console.log(`
Two things left:

  1. Put the record file on the branch it names, if it is not the default one:
       git switch --orphan ${branch} && git add PROOF_OF_USAGE.md && git commit -m "Start the record"

  2. If this is a site as well as a repository, serve the same discovery document at
     /.well-known/proof-of-usage.json — a crawler that never touches the repository finds it there.

basis is "${basis}": ${basis === "request" ? "a NOTICE, which changes nothing about your licence and keeps the project open source." : "a term of your licence, which is a decision with costs — see the MIT-PoU repository before relying on it."}`);
  process.exit(0);
}

console.error(`unknown command "${command}"\n\n${HELP}`);
process.exit(2);
