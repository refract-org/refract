# CLI command reference

All commands work with `wikihistory` as a backward-compatible alias (e.g., `wikihistory analyze`).

## `refract init`

Onboarding — runs a quick analysis and shows what Refract can do.

```bash
refract init
```

Fetches recent revisions of "Earth," runs the section differ, and prints next steps:
analyze, explore, claim, snapshot, monitor, mcp. No flags needed — a zero-config
first experience.

## `refract analyze`

Analyze full edit history of a page.

```bash
refract analyze [page] [options]
```

| Flag | Default | Description |
|---|---|---|
| `page` | required (positional) | Page title |
| `-d, --depth <d>` | `detailed` | Analysis depth: `brief`, `detailed`, `forensic`. See [depth levels](depth.md). |
| `--from <revId>` | — | Start revision ID |
| `--to <revId>` | — | End revision ID |
| `--since <ts>` | — | Analyze revisions from this ISO timestamp. The first revision in the window is not diffed against the one before it. |
| `-j, --json` | off | Print events as JSON, one per line (NDJSON), instead of the interactive view |
| `--brief-limit <n>` | `20` | Revisions read at `brief` depth: the latest N |
| `-c, --cache` | off | Cache revisions in SQLite (`~/.wikihistory/refract.db`). Needs Bun and `@refract-org/persistence`, which is only available from a source checkout. |
| `--pages-file <path>` | — | Batch file of page titles (one per line). Prints a total, not the events. |
| `--batch-concurrency <n>` | `4` | Pages analyzed at once with `--pages-file` |
| `--api <url>` | `en.wikipedia.org` | MediaWiki API base URL |
| `--cache-dir <path>` | `~/.wikihistory` | Cache directory path |
| `-r, --report` | off | Output `ObservationReport` instead of raw events |
| `--config <path>` | — | JSON file with analyzer config overrides |
| `--similarity <n>` | `0.8` | Sentence matching threshold (0–1) |
| `--revert-patterns <path>` | — | File of revert regex patterns |
| `--cluster-window <min>` | `60` | Edit cluster window in minutes |
| `--spike-factor <n>` | `3` | Talk activity spike multiplier |
| `--talk-window <days>` | `7/3` | Talk correlation window as "before/after" in days |
| `--section-rename <mode>` | `similarity` | Section rename detection: `exact`\|`similarity`\|`none` |

## `refract claim`

Track a specific claim across revisions.

```bash
refract claim <page> [options]
```

| Flag | Default | Description |
|---|---|---|
| `page` | required (positional) | Page title |
| `-t, --text <text>` | required | Claim text to track |
| `--limit <n>` | `50` | Revisions read: the latest N |
| `-c, --cache` | off | Cache revisions in SQLite |
| `--api <url>` | `en.wikipedia.org` | MediaWiki API base URL |

## `refract snapshot`

Reconstruct page state at a point in time.

```bash
refract snapshot <page> [options]
```

| Flag | Default | Description |
|---|---|---|
| `page` | required (positional) | Page title |
| `--at <date>` | today | Target date (ISO 8601, e.g. `2024-01-15`). Finds the closest revision at or before this date. |
| `-c, --cache` | off | Cache revisions in SQLite |
| `--api <url>` | `en.wikipedia.org` | MediaWiki API base URL |

Displays section list, plain text content, and metadata (revision ID, editor, size,
edit comment). Content is truncated at 2000 characters.

## `refract cron`

One-shot re-observation for cron scheduling.

```bash
refract cron <pages-file> [options]
```

| Flag | Default | Description |
|---|---|---|
| `pages-file` | required (positional) | Batch file of page titles (one per line) |
| `-i, --interval <hrs>` | from last observation | Lookback window in hours |
| `--notify-slack` | off | Send Slack notification on changes |
| `--notify-email` | off | Send email notification on changes |
| `--notify-webhook <u>` | — | Send generic webhook POST on changes |
| `--cache-dir <path>` | `~/.wikihistory` | Where each page's previous observation is kept; persist it between runs |
| `--api <url>` | `en.wikipedia.org` | MediaWiki API base URL |

Prints a per-page report and `Total new events: N`, and exits 1 when N > 0 — or on any
error. See [scheduled monitoring](cron.md) for the comparison, state and scheduling.

## `refract diff`

Cross-wiki comparison (2+ wikis).

```bash
refract diff <topic> [options]
```

| Flag | Default | Description |
|---|---|---|
| `topic` | required (positional) | Page title to compare across wikis |
| `--wiki-a <url>` | required | First wiki API URL |
| `--wiki-b <url>` | required | Second wiki API URL |
| `--wiki-c <url>` | optional | Third wiki API URL |
| `-d, --depth <d>` | `detailed` | Analysis depth. See [depth levels](depth.md) |

## `refract eval`

Run the evaluation harness.

```bash
refract eval [options]
```

| Flag | Default | Description |
|---|---|---|
| `--page <title>` | — | Run only for a specific page |
| `--ground-truth <path\|builtin>` | — | Validate against ground truth labels |

## `refract classify`

Classify a single observation boundary using an inference provider.

```bash
refract classify <boundary> --input '<json>'
```

| Boundary | What it decides | Default | Model question |
|----------|----------------|---------|----------------|
| `revert` | Is this edit comment a revert? | 6 regex patterns | "Does this comment indicate a revert?" |
| `sentence_similarity` | Are these two sentences the same claim? | Word-overlap ratio (0.8) | "Are these the same claim?" |
| `heuristic` | What kind of edit is this? | Size thresholds + comment patterns | "Classify this edit by type" |
| `template_signal` | What policy signal does this template represent? | Name-to-type lookup | "What signal does this template represent?" |
| `activity_spike` | Is this day's talk activity meaningful? | 3x moving average | "Is this a meaningful spike?" |

| Flag | Default | Description |
|------|---------|-------------|
| `--input <json>` | — | Input data as JSON string |
| `--api-key <key>` | env `REFRACT_INFERENCE_API_KEY` | API key for inference provider |
| `--endpoint <url>` | env `REFRACT_INFERENCE_ENDPOINT` | OpenAI-compatible endpoint (OpenAI, DeepSeek, Ollama, etc.) |
| `--model <name>` | `gpt-4o-mini` | Model name |

Each boundary's default is the mechanical heuristic. Pass an API key or set `REFRACT_INFERENCE_API_KEY` to call a model instead. Works with any OpenAI-compatible provider — DeepSeek, Ollama, Anthropic, Together, Anyscale, or local servers.

```bash
# OpenAI
refract classify revert --input '{"comment":"reverted vandalism"}'

# DeepSeek
refract classify revert --input '{"comment":"..."}' \
  --endpoint https://api.deepseek.com/v1/chat/completions \
  --model deepseek-chat

# Local Ollama
refract classify revert --input '{"comment":"..."}' \
  --endpoint http://localhost:11434/v1/chat/completions \
  --model llama3
```

The output includes `source: "model"` or `"default"` for auditability.

## `refract export`

Export analysis as structured data.

```bash
refract export <page> [options]
```

| Flag | Default | Description |
|---|---|---|
| `page` | required (positional) | Page title |
| `-f, --format <fmt>` | `json` | Output format: `json`, `csv`, `ndjson`, `html`, `parquet` |
| `--bundle` | off | Export as evidence bundle with a SHA-256 hash of its contents (not signed). See [bundle format](bundle-manifest.md). |
| `--manifest` | off | Export as replay manifest with all hashes. See [manifest format](bundle-manifest.md). |
| `--proof` | off | Export as self-contained verification bundle with Merkle inclusion proofs. |
| `--flatten` | off | Flatten nested fields into columns (`csv`) |
| `--similarity <n>` | `0.8` | Sentence matching threshold (0–1) |
| `--api <url>` | `en.wikipedia.org` | MediaWiki API base URL |

`export` analyzes at `detailed` depth: the page's full history, or the range that `--from`, `--to` or `--since` selects. With no events it
writes nothing to stdout (the notice goes to stderr), so an empty NDJSON file stays
empty.

## `refract verify`

Check a verification bundle's events, manifest hash, Merkle root and inclusion proofs, and optionally write the result as an HTML file. It rehashes each event and checks each proof against the manifest's root, which 0.5.17 and earlier did not. Nothing in a bundle is signed; see [what it checks](bundle-manifest.md#checking-a-bundle).

```bash
refract verify <bundle.json> [options]
```

| Flag | Default | Description |
|---|---|---|
| `bundlePath` | required (positional) | Path to verification bundle JSON file |
| `--html <outPath>` | — | Also write the result as an HTML file |

```bash
refract verify earth-proof.json
refract verify earth-proof.json --html receipt.html
```

## `refract delegation`

Write [STD-07](https://ethotechnics.org/standards/std-07-revisable-delegation-record)
discrepancy records for another system to read. Refract does not decide which change
matters: the operator states it, and none of the three required options has a default.

```bash
refract delegation <page> --subject <id> --expected <clause> --when <rule> [options]
```

| Flag | Default | Description |
|---|---|---|
| `page` | required (positional) | Page title |
| `--subject <id>` | required | What the receiving system calls the thing this is about |
| `--expected <clause>` | required | The assumption these changes would violate |
| `--when <rule>` | required | Which events count: `weakening`, `strengthening`, `direction-changed`, `citation-removed`, `any` |
| `-s, --section <name>` | — | Only events in this section |
| `-o, --out <file>` | stdout | Write the records to a file |

Exits 2 on missing or invalid input.

## `refract explore`

Start a local web explorer with timeline, evidence table, and diff viewer.

![refract explore web UI](explore-ui.svg)

```bash
refract explore <page> [options]
```

| Flag | Default | Description |
|---|---|---|
| `page` | required (positional) | Page title |
| `-p, --port <n>` | `8899` | Server port |
| `--no-open` | off | Don't open browser automatically |
| `-r, --report` | off | Output `ObservationReport` instead of raw events |
| `--similarity <n>` | `0.8` | Sentence matching threshold (0–1) |
| `--config <path>` | — | JSON file with analyzer config overrides |
| `--api <url>` | `en.wikipedia.org` | MediaWiki API base URL |

## `refract visualize`

Export evidence graph as a diagram.

```bash
refract visualize <page> [options]
```

| Flag | Default | Description |
|---|---|---|
| `page` | required (positional) | Page title |
| `-f, --format <fmt>` | `mermaid` | Output format: `mermaid`, `dot` |
| `--all` | off | Show all event types (default: claim events only) |
| `--api <url>` | `en.wikipedia.org` | MediaWiki API base URL |

## `refract watch`

Live polling daemon for new edits.

```bash
refract watch <page> [options]
```

| Flag | Default | Description |
|---|---|---|
| `page` | required (positional) | Page title |
| `-s, --section <name>` | — | Watch a specific section only |
| `-i, --interval <ms>` | `60000` | Poll interval in milliseconds |
| `--api <url>` | `en.wikipedia.org` | MediaWiki API base URL |

## `refract mcp`

Start MCP server for AI agent integration.

```bash
refract mcp
```

## `refract stream`

Live stream of Wikipedia edits via EventStreams. Connects to Wikimedia's real-time
edit feed and prints events as they happen.

```bash
refract stream [page] [options]
```

| Flag | Default | Description |
|---|---|---|
| `page` | optional | Page title to watch. Omit to stream all edits. |
| `--wiki <wiki>` | `enwiki` | Wiki to stream (e.g., `enwiki`, `dewiki`, `frwiki`) |

Filters out bot edits and non-main-namespace changes automatically. Press Ctrl+C
to stop.

```bash
# Watch all edits on English Wikipedia
refract stream

# Watch a specific page
refract stream "COVID-19"

# Watch German Wikipedia
refract stream "COVID-19" --wiki dewiki
```

The stream provides revision metadata (ID, user, comment, timestamp) but not full
revision content. Use `refract analyze` for full content analysis.

## Global options

These options apply to most commands:

| Flag | Description |
|---|---|
| `--api <url>` | MediaWiki API base URL (default: `en.wikipedia.org`) |
| `--cache-dir <path>` | Cache directory path (default: `~/.wikihistory`) |
| `--api-key <token>` | API key for bearer token auth |
| `--api-user <user>` | Username for basic auth |
| `--api-password <pass>` | Password for basic auth |

Client-credential headers (`X-OAuth-Client-Id`, `X-OAuth-Client-Secret`) come from the
`REFRACT_OAUTH_CLIENT_ID` and `REFRACT_OAUTH_CLIENT_SECRET` environment variables
(0.5.17+). Up to 0.5.7 they were read from `OAUTH_CLIENT_ID` and
`OAUTH_CLIENT_SECRET` and sent to whatever wiki was queried, Wikipedia included; do
not set those names for Refract.
