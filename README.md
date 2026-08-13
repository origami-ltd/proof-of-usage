# Proof of Usage

**A format for saying that a system used a work, and for proving which version it used.**

Not a licence. A record, a credit, and one hash that joins them:

```
SHA-256("SystemName:OperatorName:ISODate:WorkURL")
```

The same digest appears in the work's record file and in the credits of whatever that usage
produced. Either it matches or it does not, and anyone can recompute it from what is already
published. No tracking, no callback, nothing hidden — two public strings.

**[SPEC.md](SPEC.md)** is the whole protocol, `PoU/1.0`. It is short on purpose: seven fields, one
hash rule, two transports. A second implementation should take an afternoon, and if it disagrees
with this one, the spec says which of us is wrong.

```bash
# a system that used a work, recording that it did
npx proof-of-usage record --system "ExampleModel v2" --operator "AI Corp" \
  --contact "provenance@aicorp.com" --work "https://github.com/acme/widget"

# a work that wants records, publishing that it does
npx proof-of-usage init
```

`record` asks the work where its records go — `proof-of-usage.json` at the repository root, or
`/.well-known/proof-of-usage.json` on a site — and sends the record there. A work that publishes
nothing gets told, plainly, that the pull request is the route, because that transport needs no
server and every work supports it.

**It is already in use.** [MIT-PoU](https://github.com/origami-ltd/mit-proof-of-usage-license) is a
variant of the MIT licence that makes the record a condition rather than a request; it is filed
with SPDX as `MIT-PoU`, and the repositories under it publish this format. That licence is one
implementation of this protocol and not the protocol itself — which is the distinction this
repository exists to make.

## Why this is separate from a licence

The obvious way to ask for this is to add a condition to a licence. That works, and one such
licence exists — [MIT-PoU](https://github.com/origami-ltd/mit-proof-of-usage-license) — but it
carries a cost that has nothing to do with the idea: a licence with an added obligation is no
longer OSI open source, is incompatible with the GPL, and asks the world to move off MIT, which the
world will not do.

The format does not need any of that. It sits beside whatever licence a work already has:

| | |
| :--- | :--- |
| `MIT` + Proof of Usage | a `NOTICE.md` asking; the licence untouched, the project still open source |
| `Apache-2.0` + Proof of Usage | the same, and `NOTICE` is already a file Apache-2.0 knows about |
| `GPL-3.0` + Proof of Usage | as a request only — the GPL forbids added conditions, and a request is not one |
| Proprietary + Proof of Usage | nothing stops a closed work asking to be credited |
| `MIT-PoU` | the version where it is a condition rather than a request, for licensors who want that |

The protocol calls this the `basis` field: `"request"` or `"licence"`. The format is identical
either way. What changes is only what a refusal means.

## For a work that wants records

Copy [`examples/proof-of-usage.json`](examples/proof-of-usage.json) to the root of your repository
and fill in the URLs, then create the record file the discovery document points at —
[`examples/PROOF_OF_USAGE.md`](examples/PROOF_OF_USAGE.md) or
[`examples/proof-of-usage.jsonl`](examples/proof-of-usage.jsonl), whichever suits who is reading.
If the asking is a request rather than a licence term, [`examples/NOTICE.md`](examples/NOTICE.md)
is the wording.

Or let the tool write all three:

```bash
npx proof-of-usage init
```

Check what you published:

```bash
npx proof-of-usage verify --file proof-of-usage.json
npx proof-of-usage verify --file PROOF_OF_USAGE.md
```

`validate.mjs` has no dependencies and needs no network: it checks the shape of a discovery
document, and recomputes the hash of every record in a record file against its own fields.

## The commands

```bash
npx proof-of-usage hash    --system "…" --operator "…" --work "…"   # the digest
npx proof-of-usage row     --system "…" --operator "…" --contact "…"  # the table row
npx proof-of-usage record  --system "…" --operator "…" --contact "…"  # find where, send it
npx proof-of-usage verify  --file PROOF_OF_USAGE.md                   # every hash, recomputed
npx proof-of-usage init                                               # publish the format here
```

`--work` defaults to the git origin of the checkout you are standing in, `--date` to now,
`--scope` to the whole work and `--purpose` to training. `init` writes a discovery document, an
empty record file and — when the basis is a request rather than a licence term — a `NOTICE.md`
saying what is being asked and why refusing it breaches nothing.

```bash
npx proof-of-usage licence   # the MIT-PoU variant, where the record is a condition
```

The package is published as `setup-ai-provenance-license` — the name it had when this started as a
licence, and the name every repository already references. It installs `pou` and
`proof-of-usage` as commands as well, so a shell can call it by what it does rather than by where
it came from. Nothing about the name is privileged: anything producing the same digest from the
same four fields is conformant, and the spec settles disagreements, not this package.

## Where it needs to land to matter

The record file and the credit line work today between two people who both care. The protocol is
worth more the closer it gets to the places provenance is already recorded:

- **Model and dataset cards** — the `proof_of_usage` key of §3.2, next to the licence field that
  already lives there.
- **Training and crawling pipelines** — a record written when a corpus is assembled, not
  reconstructed afterwards from logs nobody kept.
- **Forges and hubs** — a discovery document read the way `robots.txt` and `LICENSE` are read.
- **CI** — a check on the record file, which is the one piece already implemented and shipping:
  [`examples/workflow.yml`](examples/workflow.yml) is the whole of it.

None of that requires anyone to change licence. That is the entire argument for keeping this
separate from one.

## Honest limits

- **It cannot tell whether a record is true.** Nothing can. It makes a claim specific, dated,
  addressed, and checkable against itself, which is more than exists now and less than proof.
- **It is unenforced by design.** No detection, no compulsion. A work asks in the place where the
  asking is on the record.
- **An unrecorded usage leaves no trace here.** This is an attendance list that people sign, not a
  camera at the door.
- **It is one format, not an industry.** `PoU/1.0` is settled and small enough to reimplement in an afternoon, which is the only reason a format like this ever spreads. Whether anyone else publishes one is not up to this repository.

## What is in here

| File | What it is |
| :--- | :--- |
| `SPEC.md` | The protocol, `PoU/1.0`. Nine short sections. |
| `bin/pou.mjs` | The reference tool: hash, row, record, verify, init. |
| `schema/proof-of-usage.schema.json` | JSON Schema for the discovery document and for one record. |
| `validate.mjs` | Checks a discovery document, and recomputes every hash in a record file. No dependencies. |
| `examples/` | A discovery document, both record serialisations, a `NOTICE.md`, and a CI workflow to copy. |
| `proof-of-usage.json` | This repository's own, because a format its author will not publish is not a format. |

## Licence of this repository

[CC0](LICENSE.md) — public domain. A provenance format that anyone must ask permission to
implement would be a poor provenance format.
