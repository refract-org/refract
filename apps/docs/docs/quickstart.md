# Quick start

## Prerequisites

- [Node.js](https://nodejs.org) 20+ or [Bun](https://bun.sh) v1.2+ runtime
- Internet connection (for fetching revision data from Wikimedia)

See [installation](install.md) for all options (npx, npm, bun, Docker, from source).

## Install the CLI

**Zero install** (no download needed):

```bash
npx @refract-org/cli analyze "Earth" --depth brief
```

**Or install locally:**

```bash
bun add -g @refract-org/cli
refract analyze "Earth" --depth brief
```

(`wikihistory` also works as an alias.)

See [installation](install.md) for all options (bun, npm, Docker, from source).

## Your first analysis

```bash
refract analyze "Earth"
```

By default, this fetches up to 20 recent revisions of the Wikipedia page "Earth" and runs the standard detailed-depth analyzers (section changes, citation changes, revert detection, template changes). Use `--depth forensic` for all 26 event types. Use `--from` and `--to` to scope to a specific revision range.

Output is printed to stdout as structured JSON. Use `--report` to get a structured `ObservationReport` that groups events by claim with a lifecycle ledger. Use `--similarity <n>` to adjust the sentence matching threshold (default 0.8).

## View results in the web UI

```bash
refract explore "Earth"
```

Opens a local web server (default port 8899) with a timeline view, evidence table, and diff viewer — the most user-friendly way to browse results.

## Saving output

```bash
refract export "Earth" --format ndjson > earth-events.jsonl
```

Use `refract export` to format output as json, csv, ndjson, html, parquet, an evidence bundle with a SHA-256 hash (`--bundle`), or a replay manifest (`--manifest`). Add `--flatten` to produce flat column-oriented CSV suitable for analytical tools.

## Try it: trace a claim

Now find when a specific word first appeared and track how it changed:

```bash
refract claim "Earth" --text "climate" -c
```

Refract scans every revision for "climate," reports when it was first added, modified, or removed, and summarizes its status (STABLE, REMOVED, CONTESTED). Try a term you expect to be disputed — any word or phrase works.

## View the results visually

The standalone [Refract UI](tutorials/refract-ui.md) loads JSONL output and renders timelines, diffs, citation graphs, and event breakdowns. Export your analysis and drop the file into the browser:

```bash
refract export "Earth" --format ndjson > earth-events.jsonl
# then open http://localhost:5173 in Refract UI and drag the file in
```

See the [Refract UI tutorial](tutorials/refract-ui.md) for the full walkthrough.

## Classify events with a model

```bash
# Default: mechanical heuristic
refract classify revert --input '{"comment":"revert vandalism"}'

# With API key: uses configured model
refract classify revert --input '{"comment":"..."}' --model deepseek-chat
```

## Next steps

- [Concepts](concepts.md)
- [CLI reference](cli.md)
- [Analysis depth levels](depth.md)
- [Tutorial: Track Wikipedia changes](tutorials/wikipedia-history.md)
