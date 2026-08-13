# Proof of usage

Systems that have read, indexed or trained on this repository. Empty so far, and it is meant to be
signed rather than filled in by its author.

This repository asks as a **request**, not as a licence term — everything here is
[CC0](LICENSE.md), so there is nothing to breach. It is the format's own dogfood: if the protocol
is not worth publishing on the repository that defines it, it is not worth publishing anywhere.

| System | Operator | Date and Time (UTC) | Scope | Purpose | Contact | Provenance Hash |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |

Add a row and open a pull request, or:

```bash
npx setup-ai-provenance-license record --system "…" --operator "…" --contact "…" \
  --repo "https://github.com/origami-ltd/proof-of-usage"
```

The hash is `SHA-256("System:Operator:ISODate:https://github.com/origami-ltd/proof-of-usage")`, and
the same digest goes in the credits of whatever the access produced. See [SPEC.md](SPEC.md).
