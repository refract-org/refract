# Tutorial: Cross-wiki comparison with `refract diff`

## Goal

Compare how the same topic is covered across two or more MediaWiki instances — different
language Wikipedias, competing Fandom wikis, or independent vs. official wikis — and
detect where they diverge.

## Why cross-wiki comparison matters

The same topic framed differently across wikis reveals editorial perspective, regional
bias in sourcing, canon disputes in fictional universes, and institutional differences
in how knowledge is maintained. Refract can detect these divergences mechanically.

## Steps

### 1. Compare two Wikipedia language editions

```bash
refract diff "Douglas_Adams" \
  --wiki-a https://en.wikipedia.org/w/api.php \
  --wiki-b https://de.wikipedia.org/w/api.php \
  --depth detailed
```

Refract fetches both pages, runs the full deterministic pipeline on each, and produces
a side-by-side diff of section structure, citations, categories, and sentence changes.

### 2. Compare competing Fandom wikis

```bash
refract diff "Darth_Vader" \
  --wiki-a https://starwars.fandom.com/api.php \
  --wiki-b https://clone-wars.fandom.com/api.php \
  --depth forensic
```

Forensic depth enables edit cluster and talk page correlation on both wikis — showing
not just what differs, but how contested the differences are.

### 3. Compare three wikis at once

```bash
refract diff "climate_change" \
  --wiki-a https://en.wikipedia.org/w/api.php \
  --wiki-b https://de.wikipedia.org/w/api.php \
  --wiki-c https://fr.wikipedia.org/w/api.php \
  --depth detailed
```

### 4. Export the comparison

```bash
refract diff "Bitcoin" \
  --wiki-a https://en.wikipedia.org/w/api.php \
  --wiki-b https://simple.wikipedia.org/w/api.php \
  --depth detailed > diff-output.jsonl
```

## Reading the output

`refract diff` produces events with a `wiki` property tagging which wiki the event
came from:

```json
{
  "eventType": "citation_added",
  "wiki": "b",
  "wikiUrl": "https://simple.wikipedia.org/w/api.php",
  "fromRevisionId": 100,
  "toRevisionId": 101,
  "section": "History",
  "before": "",
  "after": "<ref>{{cite web |title=Bitcoin.org...}}</ref>",
  "timestamp": "2024-01-15T10:00:00Z",
  "deterministicFacts": [
    {
      "fact": "Citation added only on wiki B, absent on wiki A",
      "provenance": { "analyzer": "cross-wiki-differ", "version": "0.5.1" }
    }
  ]
}
```

Key signals:
- **Event present on one wiki but not the other** → content divergence
- **Same section, different content** → framing divergence
- **Different categories** → classification divergence (canon vs. non-canon, different rating systems)
- **Different citation sources** → evidence base divergence (English-language sources vs. local sources)

## Use cases

### Detecting canon divergence (Fandom)

When two Fandom wikis cover the same fictional universe with different canon policies,
`refract diff` catches the moment of divergence:

```
Wiki A: category_removed "Canon characters" at rev 1234
Wiki B: no corresponding event

→ Wiki A reclassified canon. Wiki B didn't. Canon divergence detected.
```

### Detecting framing divergence (Wikipedia)

The same topic across English and German Wikipedia often differs in what's emphasized:

```
Wiki A: citation_added (section "Regulation") — SEC filing from 2023
Wiki B: citation_added (section "Regulierung") — BaFin statement from 2023

→ Each wiki uses locally-relevant primary sources. The evidence base is jurisdiction-specific.
```

### Detecting editorial depth divergence

Simple Wikipedia vs. English Wikipedia shows how a topic is explained at different
complexity levels:

```
Wiki A (English): 340 events, 26 revisions, forensic depth
Wiki B (Simple): 45 events, 8 revisions, detailed depth

→ Simple Wikipedia has fewer events, fewer citations, fewer contested claims.
→ The complexity difference is measurable from the event stream alone.
```

## Troubleshooting

- **One wiki returns no results**: Verify the page title is exact — different wikis
  may use different naming conventions (e.g., "Douglas_Adams" vs. "Douglas Adams").
  Try the page title on each wiki individually first with `refract analyze`.
- **Rate limits when hitting 3+ wikis**: Use `-c` on each individual analyze call
  to cache results, then run `refract diff` with cached data.
- **Custom API endpoints**: Any MediaWiki instance works. For private wikis, pass
  auth credentials with `--api-key`, `--api-user`, or `--api-password`.

## Next steps

- [Track Wikipedia changes](wikipedia-history.md)
- [Monitor citation churn](citation-churn.md)
- [Build a dispute timeline](dispute-timeline.md)
