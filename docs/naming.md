# Naming conventions

## The split explained

| Name | What it is | Why |
|------|-----------|-----|
| **Refract** | The project | Latin for "change" — the engine observes change |
| **refract-org** | GitHub organization | npm scope matching; chosen for consistency with the project name |
| **`@refract-org/*`** | npm package scope | All lowercase by npm convention |
| **`refract`** / **`wikihistory`** | CLI commands | `refract` is the primary name; `wikihistory` works as an alias |

## Why both `refract` and `wikihistory`?

`refract` is the primary command name. `wikihistory` works as an alias for backward compatibility — users with scripts or muscle memory using the original name won't break on upgrade. When you type `refract analyze "Bitcoin"`, the meaning is self-evident: refract the revision history of Bitcoin.

## Package paths

```bash
# Install the CLI
bun add -g @refract-org/cli

# Run it
refract analyze "Earth"

# Import from packages
import { sectionDiffer } from "@refract-org/analyzers";
import type { EvidenceEvent } from "@refract-org/evidence-graph";
```

## In code

- Use `Refract` (capital R) as the project name in prose
- Use `@refract-org/<name>` when referencing packages
- Use `refract` as the primary CLI command name; `wikihistory` is an alias

## In shell

```bash
refract --version    # prints the installed CLI version
which refract        # points to @refract-org/cli binary
```

## Semantic Enrichment Types (v0.5.0+)

| Type | Values |
|------|--------|
| `EditMagnitude` | `"minor"`, `"moderate"`, `"major"` |
| `ContentChange` | `"introduction"`, `"removal"`, `"expansion"`, `"compression"`, `"refinement"`, `"rewrite"` |
| `CertaintyProfile` | `{ high: number, medium: number, low: number, hedging: number }` |
| `DirectionSignal` | `"strengthening"`, `"weakening"`, `"neutral"` |
| `QuantitativeFinding` | `{ type: string, value: string, raw: string }` |

All fields are optional on `EvidenceEvent`. Existing consumers ignore them.
