// The rays of the logo hunting for focus: behind the retina, in front of it,
// split onto it, then on it. The loop starts on the focused frame, which is the
// frame reduced motion holds.
const FOCUS = { x: 56, y: 24 };
const KEY_TIMES = "0;.14;.3;.38;.54;.62;.78;.86;1";
const EASING = Array(8).fill(".4 0 .2 1").join(";");
const RAYS = [
	{
		from: { x: 26, y: 12 },
		x: "56;56;63;63;36;36;50;50;56",
		y: "24;24;24;24;24;24;15;15;24",
	},
	{
		from: { x: 27, y: 24 },
		x: "56;56;63;63;36;36;54;54;56",
		y: "24;24;24;24;24;24;24;24;24",
	},
	{
		from: { x: 26, y: 36 },
		x: "56;56;63;63;36;36;50;50;56",
		y: "24;24;24;24;24;24;33;33;24",
	},
];

// A load that finishes faster than this shows nothing, instead of a flash.
const SHOW_AFTER_MS = 150;

function animate(attribute: string, values: string): string {
	return `<animate attributeName="${attribute}" values="${values}" keyTimes="${KEY_TIMES}" keySplines="${EASING}" calcMode="spline" dur="3.4s" repeatCount="indefinite"/>`;
}

function markup(moving: boolean): string {
	const rays = RAYS.map((ray) => {
		const line = moving ? animate("x2", ray.x) + animate("y2", ray.y) : "";
		const point = moving ? animate("cx", ray.x) + animate("cy", ray.y) : "";
		return `<line class="throbber-ray" x1="${ray.from.x}" y1="${ray.from.y}" x2="${FOCUS.x}" y2="${FOCUS.y}">${line}</line><circle class="throbber-point" cx="${FOCUS.x}" cy="${FOCUS.y}" r="3.6">${point}</circle>`;
	}).join("");
	return `<svg viewBox="14 0 54 48" aria-hidden="true"><path class="throbber-lens" d="M20 5Q28 24 20 43Q12 24 20 5z"/><path class="throbber-retina" d="M51 5Q61 24 51 43"/>${rays}</svg>`;
}

export class Throbber {
	private container: HTMLElement;
	private label: string;
	private element: HTMLElement | null = null;
	private timer: ReturnType<typeof setTimeout> | null = null;

	constructor(container: HTMLElement, label: string) {
		this.container = container;
		this.label = label;
	}

	start(): void {
		this.timer = setTimeout(() => this.render(), SHOW_AFTER_MS);
	}

	stop(): void {
		if (this.timer !== null) clearTimeout(this.timer);
		this.timer = null;
		this.element?.remove();
		this.element = null;
	}

	private render(): void {
		const reduced = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		const element = document.createElement("div");
		element.className = "throbber";
		element.setAttribute("role", "status");
		element.innerHTML = markup(!reduced);
		const text = document.createElement("span");
		text.textContent = this.label;
		element.appendChild(text);
		this.container.appendChild(element);
		this.element = element;
	}
}
