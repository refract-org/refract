# Fandom Canon Intelligence

Fandom wikis are the de facto reference for fictional universes — Star Wars, Marvel, Warhammer 40k, Tolkien, and hundreds more. These wikis track canon across films, books, comics, games, and retcons.

## Problem

Canon is not settled. Fandom wikis reflect ongoing disputes: Did a retcon change the official timeline? Does Legends continuity still count? What does "canon" even mean for a given universe?

These questions matter to:
- **Game studios** licensing IP who need a single source of canon truth
- **Writers and narrative designers** who need to avoid contradiction
- **Fan communities** who want to track how their understanding shifts over time

Current approaches rely on forum consensus or wiki moderation. There is no systematic way to observe canon change as it happens.

## How Refract Applies

Refract treats fandom wiki pages as living documents with the same revision analysis it applies to any MediaWiki:

- **Canon change detection**: When a page shifts from one canon classification to another (e.g., "Legends" to "Canon")
- **Retcon tracking**: Before/after diff of a retconned event or character biography
- **Source hierarchy conflicts**: Which sources are cited, and do they contradict each other?
- **Interpretation shifts**: How fan understanding of a scene or event changes across revisions
- **Dispute mapping**: Which pages have active talk page debates about canon classification

## Example Scenario

The Wookieepedia page for "Order 66" has a section on Legends continuity that was rewritten three times in one week. Each rewrite cites different source priority rules. Refract flags:

- **Dispute present**: Active debate about whether Legends content should be separated or merged
- **High source churn**: Citations shifting between "canon" and "Legends" tags
- **Recently changed**: Core claim about survivor counts rewritten 48 hours ago

A narrative designer working on a new Star Wars project can see that the official canon around Order 66 survivors is actively contested — and decide to avoid that detail.

## Next Steps

- Identify the top 20 fandom wikis by edit volume and canon complexity
- Build a canon-change diff viewer that highlights classification shifts
- Partner with a game studio for a pilot — can Refract reduce canon errors in licensed content?
