import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SchemaViewer } from "../src/export/SchemaViewer.js";
import { TimelineExport } from "../src/export/TimelineExport.js";
import type { EvidenceEvent } from "../src/types.js";

describe("TimelineExport", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	it("renders format selector and export button", () => {
		new TimelineExport(container);

		const select = container.querySelector("select");
		expect(select).not.toBeNull();
		expect(select?.children.length).toBe(3);

		const button = container.querySelector(".export-btn");
		expect(button).not.toBeNull();
		expect(button?.textContent).toBe("Export");
	});

	it("displays message when exporting with empty events", () => {
		new TimelineExport(container);
		const button = container.querySelector(".export-btn") as HTMLButtonElement;
		button.click();

		const status = container.querySelector("#export-status");
		expect(status?.textContent).toBe("No data to export.");
	});
});

describe("SchemaViewer", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement("div");
	});

	it("renders empty state when no events are provided", () => {
		const viewer = new SchemaViewer(container);
		viewer.setData([]);

		expect(container.textContent).toContain("Upload data to inspect schema");
	});

	it("analyzes fields and types across events", () => {
		const viewer = new SchemaViewer(container);
		const events: EvidenceEvent[] = [
			{
				eventId: "e1",
				eventType: "claim_first_seen",
				fromRevisionId: 10,
				toRevisionId: 11,
				timestamp: "2026-01-01T00:00:00Z",
				section: "Lead",
				before: "",
				after: "Text",
				deterministicFacts: [],
				layer: "observed",
			},
		];

		viewer.setData(events as unknown as Record<string, unknown>[]);

		const keys = container.querySelectorAll(".schema-key");
		expect(keys.length).toBeGreaterThan(0);
		expect(container.textContent).toContain("1 events");
	});
});
