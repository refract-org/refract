import type { EventType, EvidenceEvent } from "../types.js";

export interface TimelineViewOptions {
	container: HTMLElement;
	/** Called with the selected event, or null when no event is listed. */
	onSelectEvent?: (event: EvidenceEvent | null) => void;
}

export class TimelineView {
	private container: HTMLElement;
	private events: EvidenceEvent[] = [];
	private filtered: EvidenceEvent[] = [];
	// Held by reference: eventId is optional in the schema, and filtering keeps
	// the same objects.
	private selected: EvidenceEvent | null = null;
	private onSelectEvent?: (event: EvidenceEvent | null) => void;

	constructor(opts: TimelineViewOptions) {
		this.container = opts.container;
		this.onSelectEvent = opts.onSelectEvent;
	}

	setData(events: EvidenceEvent[]): void {
		this.events = events;
		this.filtered = [...events];
		this.syncSelection();
		this.render();
	}

	applyFilter(filtered: EvidenceEvent[]): void {
		this.filtered = filtered;
		this.syncSelection();
		this.render();
	}

	selectEvent(eventId: string | null): void {
		this.selected =
			this.filtered.find(
				(e) => e.eventId !== undefined && e.eventId === eventId,
			) ?? null;
		this.render();
		this.onSelectEvent?.(this.selected);
	}

	/**
	 * Keep the selected event while it is still listed; otherwise select the
	 * first listed one, so the diff panel shows a change instead of opening
	 * empty. The first listed event is the one at the top of this panel, next
	 * to the diff it fills.
	 */
	private syncSelection(): void {
		if (this.selected && this.filtered.includes(this.selected)) return;
		this.selected = this.filtered[0] ?? null;
		this.onSelectEvent?.(this.selected);
	}

	render(): void {
		this.container.innerHTML = "";

		const title = document.createElement("div");
		title.className = "panel-title";
		title.textContent = "Revision timeline";
		this.container.appendChild(title);

		const count = document.createElement("div");
		count.style.cssText =
			"font-size:0.75rem;color:var(--text-dim);margin-bottom:0.5rem;";
		count.textContent = `${this.filtered.length} of ${this.events.length} events`;
		this.container.appendChild(count);

		if (this.filtered.length === 0) {
			const empty = document.createElement("div");
			empty.style.cssText =
				"padding:1rem 0;color:var(--text-dim);font-size:0.85rem;";
			empty.textContent = "No events match the current filter.";
			this.container.appendChild(empty);
			return;
		}

		const timeline = document.createElement("div");
		timeline.className = "timeline";

		for (const event of this.filtered) {
			const item = document.createElement("div");
			item.className = `timeline-item event-${event.eventType}`;
			if (event === this.selected) {
				item.classList.add("selected");
			}

			const typeLabel = document.createElement("div");
			typeLabel.className = "event-type";
			typeLabel.textContent = formatEventType(event.eventType);
			item.appendChild(typeLabel);

			const summary = document.createElement("div");
			summary.className = "event-summary";
			summary.textContent = summarizeEvent(event);
			item.appendChild(summary);

			const meta = document.createElement("div");
			meta.className = "event-meta";
			const ts = new Date(event.timestamp);
			meta.textContent = `${ts.toLocaleDateString()} ${ts.toLocaleTimeString()} · r${event.fromRevisionId} → r${event.toRevisionId}`;
			if (event.section) {
				meta.textContent += ` · ${event.section}`;
			}
			item.appendChild(meta);

			item.addEventListener("click", () => {
				this.selected = event;
				this.render();
				this.onSelectEvent?.(event);
			});

			timeline.appendChild(item);
		}

		this.container.appendChild(timeline);
	}
}

function formatEventType(type: EventType): string {
	const words = type.replace(/_/g, " ");
	return words.charAt(0).toUpperCase() + words.slice(1);
}

function summarizeEvent(event: EvidenceEvent): string {
	if (event.deterministicFacts.length > 0) {
		return event.deterministicFacts[0].fact;
	}
	if (event.modelInterpretation) {
		return event.modelInterpretation.semanticChange;
	}
	return `${formatEventType(event.eventType)} in ${event.section}`;
}
