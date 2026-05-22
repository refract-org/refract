# Legal Chronology: Public-Record Revision Tracking

## Problem

Legal research often requires establishing a timeline: when did a public record change? What did it say before? Who changed it, and why?

Wikipedia is one of the most referenced public sources in legal filings. Content on a Wikipedia page can shift between when a researcher views it and when a filing is submitted. Inconsistencies in public record timelines are discoverable.

## How Refract Applies

Refract provides a deterministic, auditable revision history:

- **Revision chronology**: Every edit to a page, ordered and attributed
- **Before/after diff**: Exact changes between any two revisions
- **Section-level tracking**: Which section changed, and how
- **Editor attribution**: Who made the change (by username or IP)
- **Talk page linkage**: Related discussion about the change

This is not interpretation. It is the raw revision record, structured for analysis.

## Example Scenario

A law firm is researching a regulatory timeline. The relevant Wikipedia page has a section on enforcement actions. During discovery, opposing counsel claims the page always said X. Refract shows:

- Revision 123: Original language — "No enforcement actions were taken."
- Revision 456 (3 months later): Changed to "Three enforcement actions were taken."
- Revision 789 (1 month later): Changed back to original language.
- Talk page reveals debate about source reliability.

The revision chronology is admissible as a public record. Refract surfaces the exact timeline — not a judgment about which version is accurate.

## Limitations

Refract can tell you *what changed* and *when*. It does not:
- Verify the truth of any claim
- Predict litigation outcomes
- Assess whether a change was proper or improper
- Serve as legal advice

## Next Steps

- Explore preservation of revision snapshots for evidentiary use
- Build a "citation freeze" feature that captures a page's state at a moment in time with proof
- Consult with legal researchers on signal format requirements
