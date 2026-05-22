# Synthetic Healthcare-Like Demo Data

Entirely fictional medical-style pages for demonstrating Refract's claim-tracking and citation-churn analysis.

## Contents

- `fake-drug-x.md` — "Xanoleptin": narrative markdown with revision history and regulatory timeline
- `xanoleptin.jsonl` — 8 EvidenceEvent objects tracking claim softening, citation erosion, safety events, and COI editing across the drug's lifecycle
- `fake-guideline-y.md` — "WHO-2024-HTN": narrative markdown with three guideline versions and citation churn
- `who-htn.jsonl` — 7 EvidenceEvent objects tracking recommendation reversals, evidence-grade oscillation, and de-racialization of clinical algorithms

**All content is fictional.** Drug names, trial IDs, study authors, and guideline bodies are made up. Nothing here describes real medical products, trials, or patients. The pages are designed to look realistic enough to test Refract's diff and event-extraction pipeline — but obviously fictional so no one mistakes them for real medical guidance.
