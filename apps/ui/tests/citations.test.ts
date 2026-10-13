import { beforeEach, describe, expect, it } from "vitest";
import { CitationChurnChart } from "../src/citations/CitationChurnChart.js";
import { SourceChangeTable } from "../src/citations/SourceChangeTable.js";
import type { EvidenceEvent } from "../src/types.js";

describe("CitationChurnChart", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement("div");
	});

	it("renders empty state when no citation events exist", () => {
		const chart = new CitationChurnChart(container);
		chart.setData([]);

		expect(container.textContent).toContain("No citation events found");
	});

	it("renders added/removed metrics and chart bars when citation events exist", () => {
		const chart = new CitationChurnChart(container);
		const events: EvidenceEvent[] = [
			{
				eventId: "c1",
				eventType: "citation_added",
				fromRevisionId: 10,
				toRevisionId: 11,
				timestamp: "2026-02-01T00:00:00Z",
				section: "References",
				before: "",
				after: "<ref>Source A</ref>",
				deterministicFacts: [],
				layer: "observed",
			},
			{
				eventId: "c2",
				eventType: "citation_removed",
				fromRevisionId: 11,
				toRevisionId: 12,
				timestamp: "2026-02-02T00:00:00Z",
				section: "References",
				before: "<ref>Source B</ref>",
				after: "",
				deterministicFacts: [],
				layer: "observed",
			},
		];

		chart.setData(events);
		expect(container.textContent).toContain("Citation churn");
		expect(container.textContent).toContain("Added");
		expect(container.textContent).toContain("Removed");
		expect(container.querySelectorAll(".bar-group").length).toBe(2);
		expect(container.querySelectorAll(".bar").length).toBe(6);
	});
});

describe("SourceChangeTable", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement("div");
	});

	it("renders empty state when no source events exist", () => {
		const table = new SourceChangeTable(container);
		table.setData([]);

		expect(container.textContent).toContain("No source/citation changes found");
	});

	it("renders table rows for citation modifications", () => {
		const table = new SourceChangeTable(container);
		const events: EvidenceEvent[] = [
			{
				eventId: "s1",
				eventType: "citation_replaced",
				fromRevisionId: 30,
				toRevisionId: 31,
				timestamp: "2026-04-10T10:00:00Z",
				section: "Outcomes",
				before: "doi:10.1001/old",
				after: "doi:10.1001/new",
				deterministicFacts: [
					{
						fact: "Updated DOI reference",
					},
				],
				layer: "observed",
			},
		];

		table.setData(events);
		const rows = container.querySelectorAll("tbody tr");
		expect(rows.length).toBe(1);
		expect(rows[0].textContent).toContain("Outcomes");
		expect(rows[0].textContent).toContain("Updated DOI reference");
	});
});
