import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { rewriteCanonicalLink } from "../build.mjs";

describe("canonical core guides", () => {
	beforeAll(() =>
		execFileSync(process.execPath, ["build.mjs"], {
			cwd: resolve(__dirname, ".."),
		}),
	);

	it("publishes the review contract and its coverage limits from core", () => {
		const html = readFileSync(
			resolve(__dirname, "../dist/review/index.html"),
			"utf8",
		);
		expect(html).toContain("Review the sources you rely on");
		expect(html).toContain("Understand coverage and recovery");
		expect(html).toContain("An incomplete report cannot be acknowledged.");
		expect(html).toContain(
			"https://github.com/refract-org/refract/blob/main/docs/examples/review.json",
		);
		expect(
			readFileSync(resolve(__dirname, "../dist/core-onboarding.svg")),
		).toEqual(
			readFileSync(resolve(__dirname, "../../../docs/examples/onboarding.svg")),
		);
		const index = JSON.parse(
			readFileSync(resolve(__dirname, "../dist/search-index.json"), "utf8"),
		);
		expect(
			index.find((page: { slug: string }) => page.slug === "review").title,
		).toBe("Review the sources you rely on");
	});

	it("routes mapped guides locally and other source files to the repository", () => {
		expect(
			rewriteCanonicalLink(
				"./review.md#understand-coverage-and-recovery",
				"docs/usage.md",
			),
		).toBe("/refract/review/#understand-coverage-and-recovery");
		expect(
			rewriteCanonicalLink(
				"../packages/evidence-graph/src/schemas/revision.ts",
				"docs/usage.md",
			),
		).toBe(
			"https://github.com/refract-org/refract/blob/main/packages/evidence-graph/src/schemas/revision.ts",
		);
		expect(rewriteCanonicalLink("#local", "docs/review.md")).toBe("#local");
		expect(
			rewriteCanonicalLink("https://example.org/page", "docs/review.md"),
		).toBe("https://example.org/page");
	});
});
