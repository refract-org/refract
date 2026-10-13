# Walkthrough: wording and reference changes

This example uses two real, adjacent revision pairs from Wikipedia's Bitcoin
article. Refract detects a wording change in one pair and a removed reference
in the other. The pairs are analyzed separately; no event is inferred across
the intervening months.

## What you can inspect

```text
2010-03-18T20:03:27Z  sentence_modified
  Revisions: 345930425 → 350653695
  Before (excerpt): The longest proof-of-work chain…
  After  (excerpt): The longest proof-of-work block chain…

2010-06-21T17:29:07Z  citation_removed
  Revisions: 369361755 → 369393212
  Removed: <ref>[http://www.bitcoin.org/faq Bitcoin FAQ]</ref>
```

The sentence excerpts omit the unchanged remainder. The
[captured events](./examples/bitcoin-events.ndjson) include the complete matched
text, removed reference, timestamps, and revision IDs. They were computed from
[saved inputs](./examples/bitcoin-revisions.json) with the current checkout's
analyzers and event schema. The capture script also derives event IDs.

| Observation | Prior revision | Next revision |
|-------------|----------------|---------------|
| Wording changed | [345930425](https://en.wikipedia.org/w/index.php?oldid=345930425) | [350653695](https://en.wikipedia.org/w/index.php?oldid=350653695) |
| FAQ reference removed | [369361755](https://en.wikipedia.org/w/index.php?oldid=369361755) | [369393212](https://en.wikipedia.org/w/index.php?oldid=369393212) |

The article content is attributed to Wikipedia's Bitcoin contributors; the
revision links identify each captured version. A reference disappearing does
not establish why it was removed or whether it supported the passage.

## Reproduce with the CLI

These commands require network access and print NDJSON:

```bash
refract analyze "Bitcoin" --from 345930425 --to 350653695 --depth detailed --json > wording-events.ndjson
refract export "Bitcoin" --from 369361755 --to 369393212 --format ndjson > reference-events.ndjson
```

Each command can emit additional events for the pair. Select the observations
shown above by their type and text:

```bash
jq -c 'select(.eventType == "sentence_modified" and (.before | startswith("The longest proof-of-work chain")))' wording-events.ndjson
jq -c 'select(.eventType == "citation_removed" and (.before | contains("Bitcoin FAQ")))' reference-events.ndjson
```

## Reproduce without the wiki

From a source checkout with dependencies installed and packages built:

```bash
bun scripts/capture-bitcoin-example.ts --check
```

This reruns the analyzers against the saved revision pairs and checks the two
captured events. It makes no network calls. To regenerate the output, omit
`--check`. To fetch those pinned pairs again, add `--refresh`.

The [capture script](../scripts/capture-bitcoin-example.ts) specifies the pairs,
selection rules, and event-ID derivation. Preserved article inputs make this
example reproducible even if current page content or supplemental metadata
changes.

## Start with a fictional sample

For a walkthrough that also includes text disappearing and returning, use
[the offline recipe](./recipes.md#try-the-offline-walkthrough). Its inputs and
reference URL are fictional and marked as such in the exported events.

## Archived output

[bitcoin-quick-analysis.txt](./bitcoin-quick-analysis.txt) preserves a historical
v0.3.x run with 330 events across 20 revisions. It uses legacy event names and
classification behavior. It is not the expected output of the commands above.
