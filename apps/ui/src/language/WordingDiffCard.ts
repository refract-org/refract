import type { EvidenceEvent } from "../types.js";

interface WordingChange {
	revisionId: number;
	timestamp: string;
	section: string;
	eventType: string;
	before: string;
	after: string;
	summary: string;
}

export class WordingDiffCard {
	private container: HTMLElement;
	private events: EvidenceEvent[] = [];

	constructor(container: HTMLElement) {
		this.container = container;
	}

	setData(events: EvidenceEvent[]): void {
		this.events = events;
		this.render();
	}

	render(): void {
		this.container.innerHTML = "";

		const title = document.createElement("div");
		title.className = "panel-title";
		title.textContent = "Wording changes";
		this.container.appendChild(title);

		const changes = this.computeChanges();

		if (changes.length === 0) {
			const empty = document.createElement("div");
			empty.style.cssText =
				"color:var(--text-dim);font-size:0.85rem;padding:1rem 0;";
			empty.textContent = "No wording-related events found.";
			this.container.appendChild(empty);
			return;
		}

		const grid = document.createElement("div");
		grid.className = "card-grid";

		for (const ch of changes) {
			const card = document.createElement("div");
			card.className = "card";

			const label = document.createElement("div");
			label.className = "card-label";
			const ts = new Date(ch.timestamp);
			label.textContent = `r${ch.revisionId} · ${ts.toLocaleDateString()} · ${ch.section}`;
			card.appendChild(label);

			const body = document.createElement("div");
			body.className = "card-body";
			body.textContent = ch.summary;
			card.appendChild(body);

			// A sentence seen for the first time has no "before" and a removed
			// one has no "after"; each printed an empty − or + line.
			if (ch.before !== ch.after) {
				if (ch.before.trim()) {
					const beforeEl = document.createElement("div");
					beforeEl.className = "card-diff";
					beforeEl.style.cssText +=
						";border-left:3px solid var(--red);margin-bottom:2px;";
					beforeEl.textContent = `− ${ch.before}`;
					card.appendChild(beforeEl);
				}

				if (ch.after.trim()) {
					const afterEl = document.createElement("div");
					afterEl.className = "card-diff";
					afterEl.style.cssText += ";border-left:3px solid var(--green);";
					afterEl.textContent = `+ ${ch.after}`;
					card.appendChild(afterEl);
				}
			}

			grid.appendChild(card);
		}

		this.container.appendChild(grid);
	}

	private computeChanges(): WordingChange[] {
		const wordingTypes = new Set([
			"sentence_modified",
			"sentence_first_seen",
			"sentence_removed",
			"sentence_reintroduced",
		]);

		const wordingEvents = this.events.filter((e) =>
			wordingTypes.has(e.eventType),
		);

		return wordingEvents.map((e) => ({
			revisionId: e.toRevisionId,
			timestamp: e.timestamp,
			section: e.section,
			eventType: e.eventType,
			before: e.before,
			after: e.after,
			summary:
				e.deterministicFacts.length > 0
					? e.deterministicFacts[0].fact
					: e.eventType.replace(/_/g, " "),
		}));
	}
}
