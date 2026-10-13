# Use observations in your application

Start with the artifact you need: a local file, a library result, or an agent
tool response. The [review-feed recipe](./recipes.md#build-a-review-feed) shows
an end-to-end NDJSON workflow with captured output.

## Use a single library adapter

Install the packages your adapter needs:

```bash
bun add @refract-org/evidence-graph @refract-org/ingestion @refract-org/analyzers
```

Keep Refract imports in one file so consumers have one place to change during an
upgrade:

```typescript
// refract-adapter.ts
import { annotateEvents, buildRevisionEvents } from "@refract-org/analyzers";
import type { EvidenceEvent, Revision } from "@refract-org/evidence-graph";
import { MediaWikiClient } from "@refract-org/ingestion";

export { annotateEvents, buildRevisionEvents, MediaWikiClient };
export type { EvidenceEvent, Revision };
```

Your application supplies the revision inputs and receives observations:

```typescript
import { annotateEvents, buildRevisionEvents } from "./refract-adapter.js";
import type { Revision } from "./refract-adapter.js";

// Populate this from your versioned source, in chronological order.
export function observationsFor(revisions: Revision[]) {
  return annotateEvents(buildRevisionEvents(revisions, { depth: "detailed" }));
}
```

`buildRevisionEvents` compares supplied revisions; it does not fetch data.
`annotateEvents` adds the event schema version and deterministic enrichment
fields. The CLI separately fetches talk-page and page-log metadata. Library
consumers must supply or process that metadata when they need those observations.

See the [saved Bitcoin revision pairs](./examples/bitcoin-revisions.json) for
complete input objects and the [capture script](../scripts/capture-bitcoin-example.ts)
for an executable example. Analyze its pairs separately so the gap between them
does not become an invented transition.

## Query an exported event file

Native NDJSON uses camelCase fields such as `eventType` and `fromRevisionId`.
Flattened CSV uses names such as `event_type` and `from_revision_id`; choose one
format and inspect its fields before writing queries.

For a downloaded copy of the [fictional sample](./examples/sample-events.ndjson),
this Python snippet selects reference removals:

```python
import json

with open("sample-events.ndjson") as source:
    removals = [
        event for line in source if line.strip()
        if (event := json.loads(line))["eventType"] == "citation_removed"
    ]
for event in removals:
    print(event["timestamp"], event["before"])
```

A SQL engine with a JSON reader can query the same file. For DuckDB, use the
native field name:

```sql
SELECT eventType, count(*) AS events
FROM read_json_auto('sample-events.ndjson', format='newline_delimited')
GROUP BY eventType;
```

CSV without `--flatten` truncates the before/after text to 200 characters. Use
NDJSON when your application needs the complete exported text and nested facts.

## Add history to retrieval or a review queue

Keep the current text alongside its captured revision ID. Store observations
with their revision range and extraction settings. When your application finds
a relevant change, link the reader to the input revisions and show the changed
text or removed reference.

Your application supplies claim linking, review criteria, and any ranking or
notification rules. A changed sentence or removed reference is an observation;
it does not by itself establish that a retrieved passage should be rejected.

## Scheduled observation

`refract cron` performs a re-observation run over a page list and lookback
window. Use your scheduler to run it repeatedly. Delivery to a queue, storage
system, or review service belongs in your integration. Observation is bounded
by polling and source availability; this is not a continuous stream of every
external action.

## Agent tools

Use the [MCP setup](./mcp.md) to let an agent request page histories. Ask it to
report the revision range, observed text, and source revision IDs alongside its
explanation. Keep the tool observations and the agent's interpretation distinct.

## Reproduction

Preserve revision inputs, supporting metadata, analyzer versions, and
configuration when you need to reconstruct a result. A verification bundle
checks its internal hash and proof consistency; it does not fetch the source or
rerun the analyzers. [Verification scope](../ARCHITECTURE.md#replay-and-verification)
describes what the checks establish.

## Consume saved source reviews

Use `review --pages-file pages.txt --format json` when your application needs a
persistent review baseline. The report includes source identity, full changed
text, revision links, coverage, inputs, and analyzer version. Deduplicate entries
by `entryId`; native `eventId` remains the analyzer's observation hash. Filters
produce a separate view while the saved report retains every entry.

Fetching leaves revisions pending. Acknowledgment by saved `reportId` advances
only the inspected endpoint, so later edits remain for the next review. See the
[review contract and examples](./review.md#inspect-changes-with-context).
