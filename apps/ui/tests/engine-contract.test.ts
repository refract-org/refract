import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImportUpload } from "../src/export/ImportUpload.js";
import { TimelineExport } from "../src/export/TimelineExport.js";
import { TimelineView } from "../src/timeline/TimelineView.js";
import type { EvidenceEvent } from "../src/types.js";
import { EVENT_TYPES } from "../src/types.js";

/**
 * The viewer against what the engine writes. The NDJSON under docs/examples is
 * engine output, and `bun run check:examples` fails when it no longer matches
 * the analyzers, so these files move with the engine. The viewer's own fixtures
 * cannot show drift: they are written to the viewer's idea of an event.
 */
const EXAMPLES = join(import.meta.dirname, "../../../docs/examples");
const captured = readdirSync(EXAMPLES).filter((f) => f.endsWith(".ndjson"));

async function importText(container: HTMLElement, text: string) {
	const onData = vi.fn<(events: EvidenceEvent[]) => void>();
	new ImportUpload(container, onData);
	const input = container.querySelector(
		'input[type="file"]',
	) as HTMLInputElement;
	const file = new File([text], "events.jsonl", {
		type: "application/jsonl",
	});
	Object.defineProperty(input, "files", { value: [file] });
	input.dispatchEvent(new Event("change"));
	await vi.waitFor(() =>
		expect(container.querySelector("#import-status")?.textContent).not.toBe(""),
	);
	return {
		events: onData.mock.calls[0]?.[0] ?? [],
		status: container.querySelector("#import-status")?.textContent ?? "",
	};
}

async function exportJsonl(
	container: HTMLElement,
	events: EvidenceEvent[],
): Promise<string> {
	let blob: Blob | undefined;
	const create = vi
		.spyOn(URL, "createObjectURL")
		.mockImplementation((b: Blob | MediaSource) => {
			blob = b as Blob;
			return "blob:engine-contract";
		});
	const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
	try {
		const exporter = new TimelineExport(container);
		exporter.setData(events);
		const select = container.querySelector("select") as HTMLSelectElement;
		select.value = "jsonl";
		(container.querySelector(".export-btn") as HTMLButtonElement).click();
		expect(blob).toBeDefined();
		return await (blob as Blob).text();
	} finally {
		create.mockRestore();
		revoke.mockRestore();
	}
}

describe("engine output through the viewer", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	it("has captured engine output to check against", () => {
		expect(captured.length).toBeGreaterThan(0);
	});

	it.each(captured)(
		"imports, lists and re-exports %s unchanged",
		async (name) => {
			const text = readFileSync(join(EXAMPLES, name), "utf-8");
			const original = text
				.split("\n")
				.filter((l) => l.trim())
				.map((l) => JSON.parse(l));

			const imported = await importText(container, text);
			expect(imported.status).toBe(`Imported ${original.length} events`);
			expect(imported.events).toEqual(original);

			const timeline = document.createElement("div");
			new TimelineView({ container: timeline }).setData(imported.events);
			expect(timeline.querySelectorAll(".timeline-item")).toHaveLength(
				original.length,
			);

			const exported = await exportJsonl(container, imported.events);
			expect(exported.split("\n").map((l) => JSON.parse(l))).toEqual(original);
		},
	);

	it("imports, lists and re-exports an event of every type the engine defines", async () => {
		const events = EVENT_TYPES.map((eventType, i) => ({
			eventType,
			fromRevisionId: 100 + i,
			toRevisionId: 101 + i,
			section: "Lead",
			before: `before ${eventType}`,
			after: `after ${eventType}`,
			deterministicFacts: [],
			layer: "observed",
			timestamp: "2026-01-01T00:00:00Z",
		}));

		const imported = await importText(
			container,
			events.map((e) => JSON.stringify(e)).join("\n"),
		);
		expect(imported.status).toBe(`Imported ${events.length} events`);

		const timeline = document.createElement("div");
		new TimelineView({ container: timeline }).setData(imported.events);
		for (const eventType of EVENT_TYPES) {
			expect(timeline.querySelector(`.event-${eventType}`)).not.toBeNull();
		}

		const exported = await exportJsonl(container, imported.events);
		expect(exported.split("\n").map((l) => JSON.parse(l))).toEqual(events);
	});
});
