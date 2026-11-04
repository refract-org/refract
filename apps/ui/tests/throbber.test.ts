import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Throbber } from "../src/brand/Throbber.js";
import { ImportUpload } from "../src/export/ImportUpload.js";

describe("Throbber", () => {
	let container: HTMLElement;

	beforeEach(() => {
		vi.useFakeTimers();
		container = document.createElement("div");
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("shows nothing for a load that finishes quickly", () => {
		const throbber = new Throbber(container, "Reading");
		throbber.start();
		vi.advanceTimersByTime(149);
		expect(container.children).toHaveLength(0);
		throbber.stop();
		vi.advanceTimersByTime(1000);
		expect(container.children).toHaveLength(0);
	});

	it("announces its label once shown and is gone when stopped", () => {
		const throbber = new Throbber(container, "Reading");
		throbber.start();
		vi.advanceTimersByTime(150);
		const status = container.querySelector('[role="status"]');
		expect(status?.textContent).toBe("Reading");
		expect(status?.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
			"true",
		);
		throbber.stop();
		expect(container.children).toHaveLength(0);
	});

	it("animates every ray and point with well-formed keyframes", () => {
		const throbber = new Throbber(container, "Reading");
		throbber.start();
		vi.advanceTimersByTime(150);
		const animations = [...container.querySelectorAll("animate")];
		expect(animations).toHaveLength(12);
		// A browser drops a mismatched animation without an error.
		for (const animation of animations) {
			const count = (name: string) =>
				animation.getAttribute(name)?.split(";").length;
			expect(count("values")).toBe(count("keyTimes"));
			expect(count("keySplines")).toBe((count("keyTimes") ?? 0) - 1);
		}
	});

	it("holds the focused frame under reduced motion", () => {
		vi.spyOn(window, "matchMedia").mockReturnValue({
			matches: true,
		} as MediaQueryList);
		const throbber = new Throbber(container, "Reading");
		throbber.start();
		vi.advanceTimersByTime(150);
		expect(container.querySelectorAll("animate")).toHaveLength(0);
		const rays = [...container.querySelectorAll("line")];
		expect(rays).toHaveLength(3);
		for (const ray of rays) {
			expect(ray.getAttribute("x2")).toBe("56");
			expect(ray.getAttribute("y2")).toBe("24");
		}
		expect(container.textContent).toBe("Reading");
	});
});

describe("ImportUpload loading state", () => {
	const sampleEvent = readFileSync(
		join(import.meta.dirname, "../public/sample-data.jsonl"),
		"utf8",
	).split("\n")[0];
	type Internals = { handleFile(file: File): Promise<void> };

	afterEach(() => {
		document.body.innerHTML = "";
		vi.useRealTimers();
	});

	function mount(onData = vi.fn()) {
		const container = document.createElement("div");
		document.body.appendChild(container);
		const upload = new ImportUpload(container, onData);
		return {
			upload: upload as unknown as Internals,
			onData,
			status: document.getElementById("import-status") as HTMLElement,
		};
	}

	it("shows the throbber during a slow read and replaces it with the result", async () => {
		vi.useFakeTimers();
		const { upload, status } = mount();
		let finishRead: (text: string) => void = () => {};
		const file = {
			name: "events.jsonl",
			text: () => new Promise<string>((resolve) => (finishRead = resolve)),
		} as unknown as File;

		const done = upload.handleFile(file);
		vi.advanceTimersByTime(150);
		expect(status.querySelector('[role="status"]')?.textContent).toBe(
			"Reading events.jsonl",
		);

		finishRead(sampleEvent);
		await done;
		expect(status.querySelector('[role="status"]')).toBeNull();
		expect(status.textContent).toBe("Imported 1 events");
	});

	it("clears the throbber when the read fails", async () => {
		vi.useFakeTimers();
		const { upload, status } = mount();
		const file = {
			name: "events.jsonl",
			text: () => Promise.reject(new Error("unreadable")),
		} as unknown as File;
		await upload.handleFile(file);
		vi.advanceTimersByTime(1000);
		expect(status.querySelector('[role="status"]')).toBeNull();
		expect(status.textContent).toContain("unreadable");
	});

	it("imports every line of a file long enough to yield during the parse", async () => {
		const { upload, onData, status } = mount();
		const lines = Array(4500).fill(sampleEvent).join("\n");
		const file = {
			name: "events.jsonl",
			text: () => Promise.resolve(lines),
		} as unknown as File;
		await upload.handleFile(file);
		expect(onData.mock.calls[0]?.[0]).toHaveLength(4500);
		expect(status.textContent).toBe("Imported 4500 events");
	});
});
