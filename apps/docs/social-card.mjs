// Renders the Open Graph card: the site name, the positioning line and the
// site address, in the colors of assets/style.css.
import { createRequire } from "node:module";
import { Resvg } from "@resvg/resvg-js";

const require = createRequire(import.meta.url);

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

// The site's font stack starts with system-ui, which resolves to the reader's
// operating-system face (SF Pro, Segoe UI); those cannot be redistributed in an
// image. Roboto is the stack's openly licensed face (OFL-1.1). Only these two
// files are loaded, never system fonts, so every machine renders the same PNG.
const FONT = {
	fontFiles: [
		require.resolve(
			"@expo-google-fonts/roboto/400Regular/Roboto_400Regular.ttf",
		),
		require.resolve("@expo-google-fonts/roboto/700Bold/Roboto_700Bold.ttf"),
	],
	loadSystemFonts: false,
	defaultFontFamily: "Roboto",
};

// Custom properties from assets/style.css.
const COLORS = {
	background: "#07090f", // --bg-deep
	brand: "#ffffff", // .brand
	text: "#e2e4ed", // --text
	muted: "#7c82a0", // --text-muted
	rule: "rgba(255, 255, 255, 0.12)", // --border-strong
};

// assets/brand/refract-logo.svg in its dark palette, with the box its ink fills.
const LOGO = {
	box: { x: 1, y: 4, width: 58, height: 40 },
	markup: `<path d="M2 12H16M2 24H16M2 36H16" fill="none" stroke="#fb923c" stroke-width="2" stroke-linecap="round"/><path d="M20 5Q28 24 20 43Q12 24 20 5z" fill="#7c8aff"/><path d="M51 5Q61 24 51 43" fill="none" stroke="#7c8aff" stroke-width="2" stroke-linecap="round"/><path d="M24 12 56 24M25 24H56M24 36 56 24" fill="none" stroke="#fb923c" stroke-width="2" stroke-linecap="round"/><circle cx="56" cy="24" r="2.6" fill="#fb923c"/>`,
};

const MARGIN = 80;
const TEXT_WIDTH = CARD_WIDTH - 2 * MARGIN;
const NAME = { size: 104, baseline: 196 };
const LINE = { size: 46, leading: 62, firstBaseline: 304 };
const FOOTER = {
	size: 28,
	baseline: CARD_HEIGHT - 72,
	rule: CARD_HEIGHT - 132,
};
export const MAX_LINES = Math.floor(
	(FOOTER.rule - LINE.firstBaseline) / LINE.leading,
);

function escapeXml(text) {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function text(content, { x, y, size, weight = 400, fill, spacing = 0 }) {
	return `<text x="${x}" y="${y}" font-family="Roboto" font-size="${size}" font-weight="${weight}" letter-spacing="${spacing}" fill="${fill}">${escapeXml(content)}</text>`;
}

function textWidth(content, size, weight = 400) {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH * 2}" height="${size * 2}">${text(content, { x: 0, y: size, size, weight, fill: "#000" })}</svg>`;
	return new Resvg(svg, { font: FONT }).getBBox()?.width ?? 0;
}

// Greedy word wrap, measured in the font the card is drawn in.
export function wrapText(content, size = LINE.size, maxWidth = TEXT_WIDTH) {
	const lines = [];
	let line = "";
	for (const word of content.trim().split(/\s+/)) {
		const candidate = line ? `${line} ${word}` : word;
		if (line && textWidth(candidate, size) > maxWidth) {
			lines.push(line);
			line = word;
		} else {
			line = candidate;
		}
	}
	if (line) lines.push(line);
	return lines;
}

export function socialCardSvg({ name, description, address }) {
	const lines = wrapText(description);
	if (lines.length > MAX_LINES) {
		throw new Error(
			`The social card fits ${MAX_LINES} lines of description; this one wraps to ${lines.length}: ${description}`,
		);
	}
	// The logo, sized to the cap height of the name.
	const capHeight = NAME.size * 0.711;
	const { box, markup } = LOGO;
	const scale = capHeight / box.height;
	const iconWidth = box.width * scale;
	const icon = `<g transform="translate(${MARGIN - box.x * scale} ${NAME.baseline - (box.y + box.height) * scale}) scale(${scale})">${markup}</g>`;
	const body = lines
		.map((line, i) =>
			text(line, {
				x: MARGIN,
				y: LINE.firstBaseline + i * LINE.leading,
				size: LINE.size,
				fill: COLORS.text,
			}),
		)
		.join("\n  ");
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${COLORS.background}"/>
  ${icon}
  ${text(name, { x: MARGIN + iconWidth + 28, y: NAME.baseline, size: NAME.size, weight: 700, fill: COLORS.brand, spacing: -0.02 * NAME.size })}
  ${body}
  <rect x="${MARGIN}" y="${FOOTER.rule}" width="${TEXT_WIDTH}" height="1" fill="${COLORS.rule}"/>
  ${text(address, { x: MARGIN, y: FOOTER.baseline, size: FOOTER.size, fill: COLORS.muted })}
</svg>`;
}

export function renderSocialCard(content) {
	return new Resvg(socialCardSvg(content), { font: FONT }).render().asPng();
}
