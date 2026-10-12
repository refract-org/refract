# Refract UI

Standalone visualization for the [Refract](https://github.com/refract-org/refract) observation engine.

Load a JSONL file of Refract events to see them as a timeline with word-level diffs, citation and revert charts, talk page activity, and a list of the fields the events carry. Everything runs in the browser; there is no backend.

## Quick start

```bash
bun install
bun run dev
```

Open `http://localhost:5173`. Sample data loads automatically. Drag a JSONL file onto the upload zone to inspect your own data.

### Using your own Refract data

```bash
refract export "Bitcoin" --format ndjson > bitcoin-events.jsonl
```

Then drag `bitcoin-events.jsonl` onto the Refract UI upload zone.

## What you'll see

**Timeline** — Every event, in the order the file lists them. Click an event to see the word-level diff of what changed. Filter by event type to narrow the view.

**Citations** — Bar chart of citation additions, removals, and replacements per revision, plus a table of every citation change.

**Model confidence** — The confidence score of each event on the `model_interpretation` layer.

**Disputes** — Revert clusters, events per day (with reverts), and talk page activity.

**Wording changes** — One card per sentence event (first seen, modified, removed, reintroduced), with the before and after text.

**Event schema** — Every top-level field in the loaded events, with its types and the share of events that have it.

**Export** — Download filtered data as JSON, JSONL, or CSV.

## Stack

- Vite + vanilla TypeScript
- No framework dependencies
- DOM-based rendering with CSS custom properties
- Loads nothing from other origins; an uploaded file is read in the browser and never sent anywhere

---

[Refract Engine](https://github.com/refract-org/refract) · [Docs](https://refract-org.github.io/refract-docs/) · [npm](https://www.npmjs.com/org/refract-org)
