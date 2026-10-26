# Refract gives mutable knowledge a memory

Refract records how public knowledge changes across available revision histories. Inspect changed wording, removed citations, and returned text with the source revisions behind each observation.

It is a temporal observability layer for knowledge. Its deterministic engine reconstructs events from revision traces; your review process decides what those changes mean.

<div class="hero-links">
  <a href="demo/" class="button primary">See a captured example</a>
  <a href="quickstart/" class="button secondary">Analyze a history</a>
  <a href="review/" class="button secondary">Review a watchlist</a>
</div>

## Start with one change

This bounded Wikipedia example compares two Bitcoin revisions from 2010 using the published CLI. It prints one event per line as NDJSON:

```bash
npx @refract-org/cli@0.5.17 analyze "Bitcoin" --from 369361755 --to 369393212 --depth detailed --json
```

Look for `citation_removed`, then inspect its `before`, `after`, and revision IDs. A removed reference is an observation; whether it changes your use of the source is a separate decision.

For repeated review, [review a watchlist](review.md) from a source build. Refract remembers the last revision you explicitly acknowledged. That command is unreleased in the npm version used above.

## What you receive

<div class="features-grid">
  <div class="feature-card">
    <h3>Changed text</h3>
    <p>Sentence observations include the wording before and after the transition.</p>
  </div>
  <div class="feature-card">
    <h3>Source changes</h3>
    <p>Citation events identify references added, removed, or replaced.</p>
  </div>
  <div class="feature-card">
    <h3>Revision context</h3>
    <p>Events carry revision identifiers, sections, timestamps, and analyzer provenance.</p>
  </div>
  <div class="feature-card">
    <h3>Repeatable observations</h3>
    <p>The same captured inputs, analyzer versions, and configuration produce the same observations. Export metadata can vary.</p>
  </div>
  <div class="feature-card">
    <h3>Files for your tools</h3>
    <p>Export NDJSON for a notebook, SQL query, browser viewer, or downstream review process.</p>
  </div>
  <div class="feature-card">
    <h3>Inspectable history</h3>
    <p>Follow the analyzed revision span. Hash verification checks record consistency; it does not establish complete coverage or authenticate a source.</p>
  </div>
</div>

## Choose a workflow

<div class="usecase-grid">
  <div class="usecase-card">
    <h3>Review sources you revisit</h3>
    <p>Inspect pending changes since your last acknowledgment. Keep fetched progress separate from reviewed progress.</p>
    <div class="usecase-steps"><a href="review/">Source-build review guide</a></div>
  </div>
  <div class="usecase-card">
    <h3>Inspect an earlier record</h3>
    <p>Find a revision at or before a date, or compare a bounded span of revisions.</p>
    <div class="usecase-steps"><a href="quickstart/">Quick start</a> · <a href="cli/#refract-snapshot">Snapshot command</a></div>
  </div>
  <div class="usecase-card">
    <h3>Use changes as data</h3>
    <p>Select events such as removed citations and inspect their source context in your own tools.</p>
    <div class="usecase-steps"><a href="integrations/">Data integrations</a> · <a href="mcp/">MCP access</a></div>
  </div>
</div>

## Scope

<div class="split-columns">
  <div class="column-card focus">
    <h4>Available revision histories</h4>
    <p>The CLI fetches Wikipedia and compatible MediaWiki histories. Library consumers can supply versioned text through the shared revision model.</p>
  </div>
  <div class="column-card out-of-scope">
    <h4>Observation limits</h4>
    <p>An arbitrary web URL does not supply a revision history. First observed means first in the analyzed range. Wording changes alone do not establish a dispute or whether a statement is supported.</p>
  </div>
</div>

## One repository, optional interfaces

| Interface | Use it for |
|-----------|------------|
| [CLI and libraries](sdk.md) | Fetch, compare, review, and export source histories; use the built-in explorer |
| [Browser viewer](visualizer.md) | Inspect an exported NDJSON event file locally |
| [Python adapter](python-sdk.md) | Call the CLI from notebooks and read events as dataclasses or DataFrames |

All three live in [the Refract repository](https://github.com/refract-org/refract). Event contracts and reproducible examples are maintained with the engine. The public [review](review.md) and [history-range](usage.md) pages are built directly from those core guides.

## License

The engine is AGPL-3.0. This site's original documentation is CC-BY-4.0; included core guides retain their source license. Built and maintained by [NextConsensus](https://nextconsensus.com).
