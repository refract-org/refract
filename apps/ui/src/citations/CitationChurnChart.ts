import type { EvidenceEvent } from "../types.js";

interface ChurnData {
	revId: number;
	added: number;
	removed: number;
	replaced: number;
	label: string;
}

export class CitationChurnChart {
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
		title.textContent = "Citation churn";
		this.container.appendChild(title);

		const churnData = this.computeChurn();

		if (churnData.length === 0) {
			const empty = document.createElement("div");
			empty.style.cssText =
				"color:var(--text-dim);font-size:0.85rem;padding:1rem 0;";
			empty.textContent = "No citation events found.";
			this.container.appendChild(empty);
			return;
		}

		const maxVal = Math.max(
			...churnData.map((d) => Math.max(d.added, d.removed, d.replaced)),
			1,
		);

		const chart = document.createElement("div");
		chart.className = "bar-chart";

		for (const point of churnData) {
			const group = document.createElement("div");
			group.className = "bar-group";

			const addedBar = createBar(point.added, maxVal, "added");
			const removedBar = createBar(point.removed, maxVal, "removed");
			const replacedBar = createBar(point.replaced, maxVal, "replaced", true);

			group.appendChild(addedBar);
			group.appendChild(removedBar);
			group.appendChild(replacedBar);

			chart.appendChild(group);
		}

		this.container.appendChild(chart);

		const legend = document.createElement("div");
		legend.style.cssText =
			"display:flex;gap:1rem;font-size:0.75rem;color:var(--text-dim);margin-top:0.25rem;";

		const addLegend = createLegendItem("Added", "var(--green)");
		const remLegend = createLegendItem("Removed", "var(--red)");
		const repLegend = createLegendItem("Replaced", "var(--orange)");
		legend.append(addLegend, remLegend, repLegend);
		this.container.appendChild(legend);
	}

	private computeChurn(): ChurnData[] {
		const citationEvents = this.events.filter(
			(e) =>
				e.eventType === "citation_added" ||
				e.eventType === "citation_removed" ||
				e.eventType === "citation_replaced",
		);

		const grouped = new Map<number, ChurnData>();

		for (const event of citationEvents) {
			let entry = grouped.get(event.toRevisionId);
			if (!entry) {
				entry = {
					revId: event.toRevisionId,
					added: 0,
					removed: 0,
					replaced: 0,
					label: `r${event.toRevisionId}`,
				};
				grouped.set(event.toRevisionId, entry);
			}

			if (event.eventType === "citation_added") entry.added++;
			else if (event.eventType === "citation_removed") entry.removed++;
			else if (event.eventType === "citation_replaced") entry.replaced++;
		}

		return Array.from(grouped.values()).sort((a, b) => a.revId - b.revId);
	}
}

function createBar(
	value: number,
	max: number,
	cls: string,
	isReplaced = false,
): HTMLElement {
	const bar = document.createElement("div");
	bar.className = `bar ${cls}`;
	const pct = max > 0 ? (value / max) * 100 : 0;
	bar.style.height = `${Math.max(pct, value > 0 ? 3 : 0)}%`;
	if (isReplaced) {
		bar.style.background = "var(--orange)";
	}
	bar.title = `${cls}: ${value}`;
	return bar;
}

function createLegendItem(label: string, color: string): HTMLElement {
	const item = document.createElement("span");
	item.style.cssText = "display:flex;align-items:center;gap:0.3rem;";
	const dot = document.createElement("span");
	dot.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:2px;background:${color};`;
	item.appendChild(dot);
	item.appendChild(document.createTextNode(label));
	return item;
}
