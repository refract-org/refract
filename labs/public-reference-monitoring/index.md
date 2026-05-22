# Public Reference Monitoring

Brands, institutions, and public figures are mentioned — and often challenged — on Wikipedia constantly. A negative claim appears, a controversy section is rewritten, or a source quality downgrade triggers a chain of edits.

## Problem

Organizations monitor social media and news for brand mentions. They largely ignore Wikipedia, assuming it is too slow-moving or too chaotic to track. But Wikipedia edits are neither — they are structured, attributed, and auditable. When a negative claim survives on a Wikipedia page, it propagates to every downstream consumer: search snippets, voice assistants, knowledge panels, and LLM training data.

Current monitoring tools treat Wikipedia as a firehose: "someone edited the page." They miss the signal — was a claim added, removed, or contested? Did the source quality change? Was there a revert war?

## How Refract Applies

Refract's analyzers detect:

- **Negative claims**: Addition or removal of critical statements, with before/after diff
- **Controversy moves**: Sections being rewritten, split, or removed due to dispute
- **Source quality changes**: Citation added, removed, or replaced; source domain shifts
- **Revert activity**: Frequency and participants in revert wars
- **Section-level churn**: Which sections change most and by whom

## Example Scenario

A pharmaceutical company discovers that a paragraph about a past litigation was added to their Wikipedia page. The addition cites a single news article. Refract flags:

- **New negative claim**: Added 3 days ago
- **Source-fragile**: Single source, single editor, no corroboration
- **High source churn**: Editor who added it has history of adding contested claims across multiple pages

The company can assess whether to engage the article's talk page, provide better sources, or let the article stabilize — based on signal, not panic.

## Next Steps

- Define a signal schema specific to entity monitoring
- Build a dashboard that surfaces negative claim additions per entity
- Integrate with existing social media monitoring workflows
