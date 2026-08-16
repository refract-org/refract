# @refract-org/ingestion

Wikimedia API adapters — revision fetching, diffing, rate limiting.

```bash
bun add @refract-org/ingestion
```

## Exports

### Interfaces

- `RevisionFetcher` — fetch revisions by page title
- `RevisionSource` — async iterable revision stream
- `DiffFetcher` — fetch diff between two revisions

### Classes

- `MediaWikiClient` — Wikipedia REST API client with pagination and error handling
- `RateLimiter` — configurable request throttling

```ts
import { MediaWikiClient, RateLimiter } from "@refract-org/ingestion";
import type { RevisionFetcher, RevisionOptions } from "@refract-org/ingestion";
```

[Refract](https://github.com/refract-org/refract) · [Docs](https://github.com/refract-org/refract-docs) · [npm](https://www.npmjs.com/package/@refract-org/ingestion)
