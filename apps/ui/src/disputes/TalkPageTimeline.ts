import type { EvidenceEvent } from "../types.js";

interface TalkActivity {
	revisionId: number;
	timestamp: string;
	eventType: string;
	summary: string;
}

export class TalkPageTimeline {
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
		title.textContent = "Talk page activity";
		this.container.appendChild(title);

		const activities = this.computeActivities();

		if (activities.length === 0) {
			const empty = document.createElement("div");
			empty.style.cssText =
				"color:var(--text-dim);font-size:0.85rem;padding:1rem 0;";
			empty.textContent = "No talk page events found.";
			this.container.appendChild(empty);
			return;
		}

		const timeline = document.createElement("div");
		timeline.className = "timeline";

		for (const act of activities) {
			const item = document.createElement("div");
			item.className = "timeline-item";

			const typeLabel = document.createElement("div");
			typeLabel.className = "event-type";
			typeLabel.textContent = act.eventType.replace(/_/g, " ");
			item.appendChild(typeLabel);

			const summary = document.createElement("div");
			summary.className = "event-summary";
			summary.textContent = act.summary;
			item.appendChild(summary);

			const meta = document.createElement("div");
			meta.className = "event-meta";
			const ts = new Date(act.timestamp);
			meta.textContent = `${ts.toLocaleDateString()} ${ts.toLocaleTimeString()} · r${act.revisionId}`;
			item.appendChild(meta);

			timeline.appendChild(item);
		}

		this.container.appendChild(timeline);
	}

	private computeActivities(): TalkActivity[] {
		const talkTypes = new Set([
			"talk_page_correlated",
			"talk_thread_opened",
			"talk_thread_archived",
			"talk_reply_added",
		]);

		return this.events
			.filter((e) => talkTypes.has(e.eventType))
			.map((e) => ({
				revisionId: e.toRevisionId,
				timestamp: e.timestamp,
				eventType: e.eventType,
				summary:
					e.deterministicFacts.length > 0
						? e.deterministicFacts[0].fact
						: (e.modelInterpretation?.semanticChange ?? e.eventType),
			}));
	}
}
