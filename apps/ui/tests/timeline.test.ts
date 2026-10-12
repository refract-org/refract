import { beforeEach, describe, expect, it, vi } from "vitest";
import { DiffView } from "../src/timeline/DiffView.js";
import { EventFilter } from "../src/timeline/EventFilter.js";
import { TimelineView } from "../src/timeline/TimelineView.js";
import type { EventType, EvidenceEvent } from "../src/types.js";

describe("EventFilter", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement("div");
	});

	it("initializes with all types active and renders filter chips", () => {
		const allTypes: EventType[] = [
			"citation_added",
			"claim_first_seen",
			"revert_detected",
		];
		const onChange = vi.fn();
		const filter = new EventFilter({ container, allTypes, onChange });

		expect(filter.getActiveTypes().size).toBe(3);
		const chips = container.querySelectorAll(".filter-tag");
		expect(chips.length).toBe(3);
	});

	it("toggles a filter type and triggers onChange callback", () => {
		const allTypes: EventType[] = ["citation_added", "claim_first_seen"];
		const onChange = vi.fn();
		const filter = new EventFilter({ container, allTypes, onChange });

		filter.toggleType("citation_added");
		expect(filter.getActiveTypes().has("citation_added")).toBe(false);
		expect(onChange).toHaveBeenCalledWith(filter.getActiveTypes());
	});

	it("clears and selects all types", () => {
		const allTypes: EventType[] = ["citation_added", "claim_first_seen"];
		const onChange = vi.fn();
		const filter = new EventFilter({ container, allTypes, onChange });

		filter.clearAll();
		expect(filter.getActiveTypes().size).toBe(0);

		filter.selectAll();
		expect(filter.getActiveTypes().size).toBe(2);
	});
});

describe("TimelineView", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement("div");
	});

	it("renders empty state when no events exist", () => {
		const view = new TimelineView({ container });
		view.setData([]);

		expect(container.textContent).toContain(
			"No events match the current filter.",
		);
	});

	it("syncs selection and notifies onSelectEvent callback", () => {
		const onSelect = vi.fn();
		const view = new TimelineView({ container, onSelectEvent: onSelect });

		const events: EvidenceEvent[] = [
			{
				eventId: "evt-01",
				eventType: "claim_first_seen",
				fromRevisionId: 10,
				toRevisionId: 11,
				timestamp: "2026-05-01T00:00:00Z",
				section: "Lead",
				before: "",
				after: "Initial statement",
				deterministicFacts: [],
				layer: "observed",
			},
		];

		view.setData(events);
		expect(onSelect).toHaveBeenCalledWith(events[0]);
		expect(container.querySelectorAll(".timeline-item").length).toBe(1);
	});
});

describe("DiffView", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement("div");
	});

	it("renders empty prompt when no event is selected", () => {
		const diff = new DiffView(container);
		diff.clear();

		expect(container.textContent).toContain("No event selected.");
	});

	it("renders word-level diff and metadata for a selected event", () => {
		const diff = new DiffView(container);
		const event: EvidenceEvent = {
			eventId: "evt-diff",
			eventType: "sentence_modified",
			fromRevisionId: 50,
			toRevisionId: 51,
			timestamp: "2026-06-01T08:00:00Z",
			section: "Clinical efficacy",
			before: "Drug X was ineffective in trials.",
			after: "Drug X showed efficacy in phase 3 trials.",
			deterministicFacts: [
				{
					fact: "Trial outcome updated",
					detail: "primary endpoint met",
				},
			],
			layer: "observed",
		};

		diff.showDiff(event);
		expect(container.textContent).toContain("r50 → r51");
		expect(container.textContent).toContain("Clinical efficacy");
		expect(
			container.querySelectorAll(".diff-word-added, .diff-word-removed").length,
		).toBeGreaterThan(0);
	});
});
