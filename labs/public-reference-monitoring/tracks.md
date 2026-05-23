# What Refract Tracks for Public Reference Monitoring

## Signal Types

| Signal | Description | Deterministic? |
|---|---|---|
| **Negative claim added** | A statement with negative framing introduced to the page | Yes (observed) |
| **Negative claim removed** | A previously negative statement deleted | Yes (observed) |
| **Controversy section** | Section marked as "Controversy", "Criticism", or equivalent | Yes (observed) |
| **Source quality downgrade** | Citation replaced with lower-quality source (e.g., blog → removed) | No (model_interpretation) |
| **Source fragility** | Claim with single source or single editor | Yes (observed) |
| **Revert presence** | Edit immediately reverted by another editor | Yes (observed) |
| **Dispute present** | Active talk page discussion about the subject | Yes (observed) |
| **High source churn** | Section where citations are frequently added/removed | Yes (observed) |
| **Editor network** | Editors who edit related pages about the same subject | No (model_interpretation) |

## Definitions

- **Stable**: No substantial changes to the core claims in 90+ days. No active dispute.
- **Contested**: Active talk page discussion, reverts, or conflicting edits about specific claims.
- **Recently changed**: Substantive addition or removal within the last 14 days.
- **Source-fragile**: A claim supported by a single citation or an editor with a conflict history.
- **High source churn**: A section where citations are replaced or removed at above-average frequency.

## Not Tracked

- Truth or accuracy of claims
- Sentiment scoring
- Editor identity or motivation
- Likelihood of future edits
