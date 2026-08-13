# Proof of Usage

**A format for saying that a system used a work, and for proving which version it used.**

Not a licence. A record, a credit, and one hash that joins them:

```
SHA-256("SystemName:OperatorName:ISODate:WorkURL")
```

The same digest appears in the work's record file and in the credits of whatever that usage
produced. Either it matches or it does not, and anyone can recompute it from what is already
published. No tracking, no callback, nothing hidden — two public strings.

**[SPEC.md](SPEC.md)** is the whole protocol. It is short on purpose.

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

Check what you published:

```bash
node validate.mjs examples/proof-of-usage.json
node validate.mjs examples/PROOF_OF_USAGE.md --work https://github.com/acme/widget
```

`validate.mjs` has no dependencies and needs no network: it checks the shape of a discovery
document, and recomputes the hash of every record in a record file against its own fields.

## For a system that used one

The reference tool is already on npm — it computes the hash, prints the row, and can submit the
record for you when a work publishes an endpoint:

```bash
npx setup-ai-provenance-license hash --system "ExampleModel v2" --operator "AI Corp" \
  --repo "https://github.com/acme/widget"

npx setup-ai-provenance-license record --system "ExampleModel v2" --operator "AI Corp" \
  --contact "provenance@aicorp.com" --repo "https://github.com/acme/widget"
```

`record` reads the work's own declaration to find where to send the record, and says so plainly
when a work names nowhere — in which case the pull request is the route, and that is a route every
system with a fork can take.

The name of that package is a leftover from when this started as a licence. It is the
implementation, not the protocol; anything that produces the same digest and the same seven fields
is conformant, and reimplementing it is nine lines of SHA-256.

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
- **It is a draft.** `PoU/0.1`. The hash rule is settled; the rest may move.

## What is in here

| File | What it is |
| :--- | :--- |
| `SPEC.md` | The protocol. Nine short sections. |
| `schema/proof-of-usage.schema.json` | JSON Schema for the discovery document and for one record. |
| `validate.mjs` | Checks a discovery document, and recomputes every hash in a record file. No dependencies. |
| `examples/` | A discovery document, both record serialisations, a `NOTICE.md`, and a CI workflow to copy. |
| `proof-of-usage.json` | This repository's own, because a format its author will not publish is not a format. |

## Licence of this repository

[CC0](LICENSE.md) — public domain. A provenance format that anyone must ask permission to
implement would be a poor provenance format.
