# @refract-org/cli

CLI tool — provides the `refract` command (alias: `wikihistory`).

```bash
bun add @refract-org/cli
```

## Commands

| Command | Description |
|---------|-------------|
| `analyze <page>` | Full edit history analysis with configurable depth |
| `claim <page> --text "<text>"` | Track a specific claim across revisions |
| `export <page> --format <format>` | Export analysis as json, csv, ndjson, parquet, or html |
| `visualize <page>` | Print the evidence graph as a Mermaid or DOT diagram |
| `explore <page>` | Open the local web explorer (localhost:8899) |
| `watch <page>` | Poll for new edits and print their events until stopped |
| `cron <pages-file>` | One-shot re-observation of a list of pages, for a scheduler to run; exits 1 when there are new events |
| `diff --wiki-a <url> --wiki-b <url> <topic>` | Cross-wiki comparison of a topic |
| `eval` | Run evaluation harness against benchmark pages |
| `mcp` | Start Model Context Protocol server |

### Options

- `--depth brief|detailed|forensic` — analysis depth
- `--cache` — cache revisions in local SQLite (needs Bun and `@refract-org/persistence`, which is not published; from a source checkout only)
- `--from <revId>`, `--to <revId>` — scope to revision range
- `--pages-file <path>` — batch analyze multiple pages
- `--bundle` — export as signed evidence bundle with SHA-256 hash
- `--manifest` — export as replay manifest with Merkle tree of event hashes
- `--api <url>` — override MediaWiki API endpoint
- `--api-key <token>` — API key for private wiki auth
- `--interval <ms>` — poll interval for watch (default: 60000)

### Examples

```bash
refract analyze "COVID-19 pandemic" --depth detailed
refract claim "Theranos" --text "revolutionary blood testing"
refract export "Bitcoin" --format ndjson
refract export "Bitcoin" --bundle
refract export "Bitcoin" --manifest
refract diff --wiki-a https://starwars.fandom.com/api.php --wiki-b https://memory-alpha.fandom.com/api.php "energy weapons"
refract eval
```

[Refract](https://github.com/refract-org/refract) · [Docs](https://github.com/refract-org/refract-docs) · [npm](https://www.npmjs.com/package/@refract-org/cli)
