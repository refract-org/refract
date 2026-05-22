# Refract Demo Data

Safe, publicly-sourced demo datasets for [Refract](https://github.com/refract-org/refract), the deterministic observation engine.

## What's here

| Directory | Source | Shows |
|---|---|---|
| `fandom/` | Fandom wikis (Star Wars, Marvel, Minecraft) | Canon disputes, retcons, version-driven changes in rich revision histories |
| `historical-wikipedia/` | Wikipedia public event/tech/policy pages | Citation churn, neutrality disputes, event-driven editing |
| `synthetic-healthcare-like/` | Entirely fictional medical-style pages | Claim lifecycle, citation replacement, dispute resolution — with no real patient or drug data |

## Rules

- **No real healthcare data.** The synthetic-healthcare-like directory uses made-up drug names (Xanoleptin), exaggerated language, and fictional trials so no one mistakes it for real medical information.
- **No living-person pages** as primary demos. All Fandom/Wikipedia content is from fictional universes or historical/technology topics.
- **All content** is either from public wikis or synthetically generated. Nothing proprietary.

These datasets feed Refract's eval harness. Point an eval config at `file://` paths in this repo to run deterministic analysis without hitting live APIs.

---

Built and maintained by [NextConsensus](https://nextconsensus.com).
