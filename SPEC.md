# Proof of Usage — specification

**Version `PoU/0.1`.** Draft. The hash rule and the field names are what everything else depends
on; those are settled. The rest may still move.

A *record* says that a system used a work. A *credit* says that a product was built with it. The
two are joined by a hash either side can recompute, and that join is the whole protocol. Everything
below is detail about where the two halves are written and how they are checked.

This is not a licence. See [README.md](README.md) for what that distinction buys.

---

## 1. The record

Seven fields. No more, because a form nobody fills in records nothing.

| Field | Key | Meaning |
| :--- | :--- | :--- |
| System | `system` | Model, product or agent, with version |
| Operator | `operator` | The organisation or person running it |
| Date | `date` | When the access happened, ISO 8601 with timezone |
| Scope | `scope` | What was read — files, paths, "whole repository", "whole site" |
| Purpose | `purpose` | `training`, `fine-tuning`, `retrieval`, `inference`, `code-generation`, `evaluation`, or a phrase where none of those fits |
| Contact | `contact` | An address a question can be sent to — email or URL |
| Hash | `hash` | The provenance hash, §2 |

`system`, `operator`, `date` and `contact` are required and non-empty. `scope` defaults to the
whole work, `purpose` to `training` — the two defaults are the common case and their absence must
not be a reason to record nothing.

One record per access. A system that read the same work repeatedly for the same purpose may write
one record covering the period.

## 2. The provenance hash

```
hash = SHA-256( system ":" operator ":" date ":" work )
```

Four fields, each trimmed of leading and trailing whitespace, joined by a single colon `:`,
encoded as UTF-8, written in lowercase hexadecimal. `work` is the canonical URL of the thing that
was used (§3.1). The ISO date contains colons of its own; the string is built by joining and is
never parsed back apart.

```
"ExampleModel v2:AI Corp:2026-08-12T14:30:00Z:https://github.com/acme/widget"
→ 471e3dc7467c3c9f83be8199e5ed76b2635a0aefc86b2e3679ffc836fc9c741c
```

`contact` and `scope` are deliberately outside the input: a change of address or a more precise
description of what was read must not invalidate a hash already published on a product that
shipped.

**A record whose hash does not match its own four fields is not a record.** That check is the only
verification this protocol defines, it needs no server, and anyone can run it.

## 3. The two halves

### 3.1 The record, in the work

The work publishes a record file. Two serialisations, both valid, chosen by whoever keeps the work:

**Markdown** — `PROOF_OF_USAGE.md`, one table row per record, in the field order of §1, hash in
backticks. Readable by a person looking at a repository.

```
| ExampleModel v2 | AI Corp | 2026-08-12T14:30:00Z | whole repository | training | ai@corp.com | `471e3d…` |
```

**JSON Lines** — `proof-of-usage.jsonl`, one object per line, keys from §1. Readable by a machine
without a Markdown parser.

```json
{"system":"ExampleModel v2","operator":"AI Corp","date":"2026-08-12T14:30:00Z","scope":"whole repository","purpose":"training","contact":"ai@corp.com","hash":"471e3d…"}
```

The canonical URL of the work — the `work` in §2 — is the address the record file belongs to: the
repository URL for a repository, the dataset or model URL on a hub, the site's origin for a site.
It is declared explicitly in the discovery document (§4) so that nothing has to be guessed.

### 3.2 The credit, in the product

Whatever the usage produced names the work where that product already credits things: credits
screen, about page, acknowledgements, model card, dataset card, documentation. The line carries
the work and the same hash.

```
Includes material from acme/widget — https://github.com/acme/widget
Proof of usage: 471e3dc7467c3c9f83be8199e5ed76b2635a0aefc86b2e3679ffc836fc9c741c
```

In a model card or dataset card with YAML front matter, the machine-readable form:

```yaml
proof_of_usage:
  - work: https://github.com/acme/widget
    hash: 471e3dc7467c3c9f83be8199e5ed76b2635a0aefc86b2e3679ffc836fc9c741c
```

A reader who finds one half can check it against the other. That is the point of the hash and the
reason it is computed from fields both sides already have.

## 4. Discovery

A work that wants records publishes `proof-of-usage.json` at its root, and a site serves the same
document at `/.well-known/proof-of-usage.json`.

```json
{
  "pou": "0.1",
  "work": "https://github.com/acme/widget",
  "record": { "path": "PROOF_OF_USAGE.md", "branch": "proof-of-usage", "format": "markdown" },
  "transports": [
    { "type": "pull_request" },
    { "type": "endpoint", "url": "https://acme.com/api/proof-of-usage" }
  ],
  "contact": "provenance@acme.com",
  "basis": "request"
}
```

`basis` says what the asking rests on: `"request"` (a NOTICE — the ordinary case, and the one that
keeps a work OSI open source) or `"licence"` (a term of the licence the work is under). It changes
nothing about the format and everything about what a refusal means.

Absent a discovery document, a `PROOF_OF_USAGE.md` at the root of a work is itself the invitation,
and the pull request transport is assumed.

## 5. Transports

### 5.1 Pull request — the default

Fork, add the record to the record file on the branch named in discovery, open a pull request.
Nothing is written to the work until a maintainer merges. This transport needs no server, and a
work that publishes only this is fully conformant.

### 5.2 Endpoint — for systems that cannot open one

A system with no credentials, no fork, or a connector that may read a repository but not create a
branch in it, POSTs the record to the endpoint the work declares, and the endpoint opens the pull
request on its behalf.

```http
POST /api/proof-of-usage
Content-Type: application/json

{"system":"…","operator":"…","date":"…","work":"…","scope":"…","purpose":"…","contact":"…","hash":"…"}
```

`hash` is optional on submission. If present it must match §2 or the request is refused: the
endpoint corrects nothing, because the digest the submitter carries into its credits has to be the
digest that lands in the record.

| Status | Meaning |
| :--- | :--- |
| `201` | Pull request opened. Body carries its URL. |
| `200` | Already recorded. Body carries where. |
| `400` | Malformed record, or a hash that disagrees with its own fields. |
| `403` | The endpoint does not act for that work. |
| `404` | The work has no record file to add to. |
| `413` | Too large to be a record. |
| `502` | The forge refused. |
| `503` | The endpoint has no credentials to act with. |

An endpoint is conformant if it:

- opens a pull request and performs no other write — commits in its own fork, never in the work;
- recomputes the hash from the fields submitted rather than trusting one;
- answers a repeat of the same record with the pull request that already carries it;
- acts only for works whose discovery document names that endpoint;
- keeps no store of submissions beyond the ordinary server log of the request — and says so, since
  a system that asks a host to act for it announces itself to that host, and that log is evidence
  of the visit whether or not the record was accepted.

**Submission is complete when the endpoint answers**, not when the request is sent. A request that
went unanswered recorded nothing.

## 6. Verification

Two checks, both mechanical, neither requiring anyone's cooperation:

1. **Self-consistency.** Recompute §2 from the record's own four fields. Mismatch means the record
   is void. A CI job on the record file is the natural place for this.
2. **Both ends.** Take the hash from a published credit and look for it in the work's record file,
   or the reverse. Present in both: the two halves agree. Present in one: the other half is
   missing, and which one is missing says who owes what.

Neither check can tell whether a record is *true* — that a system really did read the work, or
that it read what it says. Nothing can, and the protocol does not pretend otherwise. What it
provides is a claim that is specific, dated, addressed and checkable against itself.

## 7. Declaring conformance

- In a repository: the discovery document of §4.
- In a model or dataset card: the `proof_of_usage` key of §3.2.
- In prose, where a version matters: `Proof of Usage PoU/0.1`.

## 8. Versioning

`PoU/0.1` is a draft, and drafts move. The hash rule of §2 will not change without a major
version, because a digest that means one thing in a record and another in a credit is worse than
no digest. Field names may gain optional companions; the seven of §1 will not be renamed.

## 9. What this is not

It is not a licence, and it grants and withholds nothing. It can sit beside any licence — MIT,
Apache-2.0, GPL-3.0, CC-BY, a proprietary EULA — as a request in a `NOTICE`, which is what `basis:
"request"` means and what keeps a work open source under every definition that word has.

A licensor who wants the record to be a *condition* rather than a request writes that into their
own licence and sets `basis: "licence"`. That is one implementation of this protocol and not the
protocol itself; it carries the costs of any added condition, and those costs are the licensor's
to weigh, not this document's to argue.
