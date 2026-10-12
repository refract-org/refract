import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { beforeAll, describe, expect, it } from "vitest";

const ROOT_DIR = resolve(__dirname, "..");
const DOCS_DIR = join(ROOT_DIR, "docs");
const DIST_DIR = join(ROOT_DIR, "dist");
const execFileAsync = promisify(execFile);

async function findMarkdownFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const filePath = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await findMarkdownFiles(filePath)));
		} else if (entry.name.endsWith(".md")) {
			files.push(filePath);
		}
	}
	return files;
}

function slugForDoc(filePath: string): string {
	return filePath
		.slice(DOCS_DIR.length + 1)
		.replaceAll("\\", "/")
		.replace(/\.md$/, "");
}

function renderedPathForSlug(slug: string): string {
	return slug === "index"
		? join(DIST_DIR, "index.html")
		: join(DIST_DIR, slug, "index.html");
}

function extractCliCommands(cliMarkdown: string): string[] {
	return Array.from(cliMarkdown.matchAll(/^## `refract ([^`\s]+)`$/gm))
		.map((match) => match[1])
		.sort();
}

function extractEventTypes(eventsMarkdown: string): string[] {
	return Array.from(eventsMarkdown.matchAll(/^\| `([a-z][a-z0-9_]+)` \|/gm))
		.map((match) => match[1])
		.sort();
}

describe("docs claim audit e2e", () => {
	beforeAll(async () => {
		await execFileAsync(process.execPath, ["build.mjs"], { cwd: ROOT_DIR });
	});

	it("renders every source markdown document into the built site", async () => {
		const markdownFiles = await findMarkdownFiles(DOCS_DIR);
		const missingPages = markdownFiles
			.map((filePath) => slugForDoc(filePath))
			.filter((slug) => !existsSync(renderedPathForSlug(slug)));

		expect(missingPages).toEqual([]);
	});

	it("renders every pipe table as a table, not as pipe text", async () => {
		// A delimiter row with more cells than its header row (|---|---|---|---|
		// under three headings) is not a GFM table, so the page prints the
		// whole table as a paragraph of pipes.
		const delimiterRow = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|?\s*$/m;
		const pagesWithPipeText: string[] = [];
		for (const filePath of await findMarkdownFiles(DOCS_DIR)) {
			const slug = slugForDoc(filePath);
			const html = await readFile(renderedPathForSlug(slug), "utf-8");
			for (const [, paragraph] of html.matchAll(/<p>([\s\S]*?)<\/p>/g)) {
				if (delimiterRow.test(paragraph)) {
					pagesWithPipeText.push(`${slug}: ${paragraph.split("\n")[0]}`);
				}
			}
		}

		expect(pagesWithPipeText).toEqual([]);
	});

	it("keeps the search index in sync with rendered documentation pages", async () => {
		const markdownSlugs = (await findMarkdownFiles(DOCS_DIR))
			.map((filePath) => slugForDoc(filePath))
			.sort();
		const searchIndex = JSON.parse(
			await readFile(join(DIST_DIR, "search-index.json"), "utf-8"),
		) as Array<{ slug: string }>;
		const indexedSlugs = searchIndex.map((entry) => entry.slug).sort();

		expect(indexedSlugs).toEqual(markdownSlugs);
	});

	it("keeps rendered landing-page claims in sync with homepage source", async () => {
		const html = await readFile(join(DIST_DIR, "index.html"), "utf-8");
		const css = await readFile(join(DIST_DIR, "style.css"), "utf-8");

		expect(html.match(/class="feature-card"/g) ?? []).toHaveLength(6);
		expect(html.match(/class="usecase-card"/g) ?? []).toHaveLength(6);
		expect(html.match(/class="column-card /g) ?? []).toHaveLength(2);
		expect(css).toContain(".features-grid");
		expect(css).toContain("grid-template-columns");
		expect(css).toContain(".usecase-grid");
		expect(css).toContain(".split-columns");
	});

	it("backs numeric CLI command claims with the CLI reference", async () => {
		const sdkMarkdown = await readFile(join(DOCS_DIR, "sdk.md"), "utf-8");
		const cliMarkdown = await readFile(join(DOCS_DIR, "cli.md"), "utf-8");
		const cliCommands = extractCliCommands(cliMarkdown);
		const commandCountClaim = sdkMarkdown.match(/CLI tool \((\d+) commands:/);

		expect(commandCountClaim?.[1]).toBe(String(cliCommands.length));
		for (const command of cliCommands) {
			expect(sdkMarkdown).toContain(command);
		}
	});

	it("backs the 26 event-type claim with the event taxonomy", async () => {
		const eventsMarkdown = await readFile(join(DOCS_DIR, "events.md"), "utf-8");
		const eventTypes = extractEventTypes(eventsMarkdown);

		expect(new Set(eventTypes).size).toBe(26);
		expect(eventTypes).toHaveLength(26);
	});

	it("keeps primary naming claims consistent across docs", async () => {
		const checkedFiles = [
			...(await findMarkdownFiles(DOCS_DIR)),
			join(ROOT_DIR, "README.md"),
			join(ROOT_DIR, "package.json"),
		];
		const violations: string[] = [];

		for (const filePath of checkedFiles) {
			const content = await readFile(filePath, "utf-8");
			if (/\bVaria\b/.test(content)) {
				violations.push(`${filePath}: references legacy project name Varia`);
			}
			for (const block of content.matchAll(
				/```(?:bash|sh|shell)?\n([\s\S]*?)```/g,
			)) {
				for (const line of block[1].split("\n")) {
					if (/^\s*(?:\$\s*)?wikihistory\b/.test(line)) {
						violations.push(
							`${filePath}: uses wikihistory as an executable command`,
						);
					}
				}
			}
		}

		expect(
			violations.map((violation) => violation.replace(`${ROOT_DIR}/`, "")),
		).toEqual([]);
	});
});
