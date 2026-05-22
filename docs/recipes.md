# Recipes

Task-first guide. Find what you need by what you want to do, not by what
Refract calls it.

---

## Track a Specific Claim

**I want to know when a sentence first appeared, was removed, or reintroduced.**

```bash
refract claim "Bitcoin" --text "cryptocurrency"
```

Returns timeline of the claim across revisions. Example output:

```
[2009-03-08] sentence_first_seen: "Bitcoin is a cryptocurrency"
  Section: lead — rev 275832581→275832690
[2017-06-15] sentence_reintroduced: "Bitcoin is a cryptocurrency" 
  Section: lead — rev 456789012→456789013
```

## Cross-Wiki Comparison

**I want to compare how Wikipedia and Fandom cover the same topic.**

```bash
refract diff "Star Wars" \
  --wiki-a https://en.wikipedia.org/w/api.php \
  --wiki-b https://starwars.fandom.com/api.php
```

Example output:

```
Cross-Wiki Diff: "Star Wars"
  Wiki A: https://en.wikipedia.org/w/api.php
  Wiki B: https://starwars.fandom.com/api.php

── Overview ──
  Total events      340    217
  Sections           12      8
  Citations          87     34
  Reverts            23     5
```

---

## Private Wiki Access

**I want to analyze a corporate wiki behind authentication.**

```bash
# Bearer token
refract analyze "Internal Policy" --api https://corp.example.com/w/api.php --api-key "sk-..."

# Basic auth
refract analyze "Internal Policy" --api https://corp.example.com/w/api.php --api-user "user" --api-password "pass"

# OAuth2
OAUTH_CLIENT_ID="..." OAUTH_CLIENT_SECRET="..." \
  refract analyze "Internal Policy" --api https://corp.example.com/w/api.php
```

---

## MCP: AI Agent Integration

**I want Claude/Cursor/Copilot to call Refract deterministically.**

Add to your MCP client config:

```json
{
  "mcpServers": {
    "sequent": {
      "command": "bunx",
      "args": ["refract", "mcp"]
    }
  }
}
```

Then ask: "When did the Bitcoin article first call it a cryptocurrency?"

---

## Equivalent to WikiWho

**I used WikiWho for token authorship. How do I get claim provenance?**

```bash
# WikiWho: who wrote which token
# Refract: when did a claim appear, change, disappear
refract analyze "Bitcoin" --depth detailed | grep claim
```

---

## Observable Framework Data Loader

**I want to load Refract events into an Observable notebook.**

```typescript
// data-loader.ts — Observable Framework data loader
import { readFileSync } from "node:fs";

export interface RefractLoaderOptions {
  path: string;
  format?: "json" | "sqlite";
}

export class RefractLoader {
  private path: string;
  private format: "json" | "sqlite";

  constructor(options: RefractLoaderOptions) {
    this.path = options.path;
    this.format = options.format ?? (options.path.endsWith(".db") ? "sqlite" : "json");
  }

  async load(): Promise<Record<string, unknown>> {
    if (this.format === "json") {
      const raw = readFileSync(this.path, "utf-8");
      return JSON.parse(raw) as Record<string, unknown>;
    }

    const { Database } = await import("bun:sqlite");
    const db = new Database(this.path, { readonly: true });
    const events = db.query("SELECT * FROM evidence_events").all();
    const revisions = db.query("SELECT * FROM revisions").all();
    db.close();
    return { events, revisions };
  }
}

export function refractLoader(options: RefractLoaderOptions): RefractLoader {
  return new RefractLoader(options);
}
```

Usage in Observable:

```js
import { refractLoader } from "./data-loader.ts";
const data = refractLoader({ path: "./bitcoin-analysis.json" });
```

---

## Equivalent to ORES

**I used ORES for edit quality scores. How do I get deterministic classification?**

```bash
# ORES: ML score for "likely damaging"
# Refract: deterministic revert detection + policy signal classification
refract analyze "Bitcoin" --depth detailed | grep -E "revert|template"
```
