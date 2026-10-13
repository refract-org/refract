import { beforeEach, describe, expect, it } from "vitest";
import { CertaintyTimeline } from "../src/language/CertaintyTimeline.js";
import { WordingDiffCard } from "../src/language/WordingDiffCard.js";
import type { EvidenceEvent } from "../src/types.js";

describe("CertaintyTimeline", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement("div");
	});

	it("renders empty state when no events with confidence exist", () => {
		const timeline = new CertaintyTimeline(container);
		timeline.setData([]);

		expect(container.querySelector(".panel-title")?.textContent).toBe(
			"Model confidence",
		);
		expect(container.textContent).toContain(
			"No model interpretations with confidence scores found",
		);
	});

	it("renders dots and chart when events have modelInterpretation confidence", () => {
		const events: EvidenceEvent[] = [
			{
				eventId: "ev-1",
				eventType: "claim_strengthened",
				fromRevisionId: 100,
				toRevisionId: 101,
				timestamp: "2026-01-01T00:00:00Z",
				section: "Lead",
				before: "alleged to work",
				after: "proven to work",
				deterministicFacts: [],
				layer: "model_interpretation",
				modelInterpretation: {
					confidence: 0.85,
					summary: "Stronger language",
				},
			},
			{
				eventId: "ev-2",
				eventType: "claim_softened",
				fromRevisionId: 101,
				toRevisionId: 102,
				timestamp: "2026-01-02T00:00:00Z",
				section: "Lead",
				before: "proven to work",
				after: "suggested to work",
				deterministicFacts: [],
				layer: "model_interpretation",
				modelInterpretation: {
					confidence: 0.35,
					summary: "Hedged language",
				},
			},
		];

		const timeline = new CertaintyTimeline(container);
		timeline.setData(events);

		const chart = container.querySelector(".certainty-chart");
		expect(chart).not.toBeNull();

		const dots = container.querySelectorAll(".certainty-dot");
		expect(dots.length).toBe(2);
		expect(dots[0].className).toContain("high");
		expect(dots[1].className).toContain("low");
	});
});

describe("WordingDiffCard", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement("div");
	});

	it("renders empty state when no wording events exist", () => {
		const card = new WordingDiffCard(container);
		card.setData([]);

		expect(container.querySelector(".panel-title")?.textContent).toBe(
			"Wording changes",
		);
		expect(container.textContent).toContain("No wording-related events found");
	});

	it("renders cards with before and after diffs for sentence modifications", () => {
		const events: EvidenceEvent[] = [
			{
				eventId: "w-1",
				eventType: "sentence_modified",
				fromRevisionId: 200,
				toRevisionId: 201,
				timestamp: "2026-03-01T12:00:00Z",
				section: "Background",
				before: "The protocol was disputed.",
				after: "The protocol was established in 2024.",
				deterministicFacts: [
					{
						fact: "Clarified historical timing",
					},
				],
				layer: "observed",
			},
		];

		const card = new WordingDiffCard(container);
		card.setData(events);

		const cards = container.querySelectorAll(".card");
		expect(cards.length).toBe(1);

		const diffs = container.querySelectorAll(".card-diff");
		expect(diffs.length).toBe(2);
		expect(diffs[0].textContent).toContain("− The protocol was disputed.");
		expect(diffs[1].textContent).toContain(
			"+ The protocol was established in 2024.",
		);
	});
});
