// 1. Scroll Progress Bar fallback
if (!CSS.supports("animation-timeline", "scroll()")) {
	const progress = document.querySelector("#progress");
	if (progress) {
		window.addEventListener(
			"scroll",
			() => {
				const scrollable =
					document.documentElement.scrollHeight - window.innerHeight;
				const scrolled = window.scrollY;
				const progressPercentage = scrollable > 0 ? scrolled / scrollable : 0;
				progress.style.transform = `scaleX(${progressPercentage})`;
			},
			{ passive: true },
		);
	}
}

// 2. Scroll-Spy TOC highlighting
const links = document.querySelectorAll(".toc-link");
const headings = document.querySelectorAll(".content h2, .content h3");
let activeHeadingId = null;

if (links.length > 0 && headings.length > 0) {
	const observerOptions = {
		root: null,
		rootMargin: "0px 0px -60% 0px",
		threshold: 0,
	};

	const observer = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			if (entry.isIntersecting) {
				activeHeadingId = entry.target.id;
				updateActiveTocLink();
			}
		}
	}, observerOptions);

	headings.forEach((h) => {
		if (h.id) observer.observe(h);
	});

	function updateActiveTocLink() {
		if (!activeHeadingId) return;
		links.forEach((link) => {
			const href = link.getAttribute("href");
			if (href === `#${activeHeadingId}`) {
				link.classList.add("active");
			} else {
				link.classList.remove("active");
			}
		});
	}

	window.addEventListener(
		"scroll",
		() => {
			let current = "";
			for (const h of headings) {
				if (window.scrollY >= h.offsetTop - 120) {
					current = h.id;
				}
			}
			if (current && current !== activeHeadingId) {
				activeHeadingId = current;
				updateActiveTocLink();
			}
		},
		{ passive: true },
	);
}

// 3. Floating Copy Button on Code Blocks
document.querySelectorAll(".content pre").forEach((preBlock) => {
	const code = preBlock.querySelector("code");
	if (!code) return;

	const btn = document.createElement("button");
	btn.className = "copy-btn";
	btn.innerHTML =
		'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span>Copy</span>';

	btn.addEventListener("click", async () => {
		try {
			await navigator.clipboard.writeText(code.innerText);
			btn.classList.add("copied");
			btn.innerHTML =
				'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Copied</span>';
			setTimeout(() => {
				btn.classList.remove("copied");
				btn.innerHTML =
					'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span>Copy</span>';
			}, 2000);
		} catch (err) {
			console.error("Failed to copy text: ", err);
		}
	});

	preBlock.appendChild(btn);
});

// 4. Interactive Search
const backdrop = document.getElementById("search-modal-backdrop");
const trigger = document.getElementById("search-trigger");
const closeBtn = document.getElementById("search-modal-close");
const searchInput = document.getElementById("search-modal-input");
const resultsContainer = document.getElementById("search-modal-results");

let indexLoaded = false;
let searchData = [];
let selectedIndex = -1;
let currentResults = [];

// Base path retrieved from global config
const BASE = window.REFRACT_BASE || "/refract-docs/";

async function loadSearchIndex() {
	if (indexLoaded) return;
	try {
		const resp = await fetch(`${BASE}search-index.json`);
		searchData = await resp.json();
		indexLoaded = true;
	} catch (err) {
		console.error("Failed to load search index:", err);
	}
}

function openSearch() {
	if (!backdrop || !searchInput) return;
	backdrop.style.display = "flex";
	backdrop.offsetHeight; // Force layout reflow
	backdrop.classList.add("open");
	searchInput.focus();
	loadSearchIndex();
	document.body.style.overflow = "hidden";
}

function closeSearch() {
	if (!backdrop || !searchInput || !resultsContainer) return;
	backdrop.classList.remove("open");
	setTimeout(() => {
		backdrop.style.display = "none";
	}, 200);
	document.body.style.overflow = "";
	searchInput.value = "";
	resultsContainer.innerHTML =
		'<div class="search-no-results">Type something to search...</div>';
	currentResults = [];
	selectedIndex = -1;
}

trigger?.addEventListener("click", openSearch);
closeBtn?.addEventListener("click", closeSearch);
backdrop?.addEventListener("click", (e) => {
	if (e.target === backdrop) closeSearch();
});

window.addEventListener("keydown", (e) => {
	if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
		e.preventDefault();
		openSearch();
	} else if (
		e.key === "/" &&
		document.activeElement !== searchInput &&
		document.activeElement?.tagName !== "INPUT" &&
		document.activeElement?.tagName !== "TEXTAREA"
	) {
		e.preventDefault();
		openSearch();
	} else if (e.key === "Escape" && backdrop?.classList.contains("open")) {
		closeSearch();
	}
});

searchInput?.addEventListener("input", (e) => {
	const query = e.target.value.trim().toLowerCase();
	if (!query) {
		resultsContainer.innerHTML =
			'<div class="search-no-results">Type something to search...</div>';
		currentResults = [];
		selectedIndex = -1;
		return;
	}
	performSearch(query);
});

function performSearch(query) {
	if (!resultsContainer) return;
	const results = [];
	for (const page of searchData) {
		const titleMatch = page.title.toLowerCase().includes(query);
		const excerptMatch = page.excerpt.toLowerCase().includes(query);
		const matchedHeadings = page.headings.filter((h) =>
			h.text.toLowerCase().includes(query),
		);

		if (titleMatch || excerptMatch || matchedHeadings.length > 0) {
			results.push({
				page,
				titleMatch,
				excerptMatch,
				matchedHeadings,
			});
		}
	}

	if (results.length === 0) {
		resultsContainer.innerHTML = `<div class="search-no-results">No results found for "${escapeHtml(query)}"</div>`;
		currentResults = [];
		selectedIndex = -1;
		return;
	}

	currentResults = [];
	let html = "";
	for (const res of results) {
		html += '<div class="search-result-group">';
		html += `  <div class="search-result-group-title">${escapeHtml(res.page.title)}</div>`;

		const href = res.page.slug === "index" ? BASE : `${BASE}${res.page.slug}/`;
		const itemIndex = currentResults.length;
		currentResults.push({ href, title: res.page.title });

		html += `  <div class="search-result-item" data-index="${itemIndex}" data-href="${href}">`;
		html += `    <div class="search-result-item-title">${highlightText(res.page.title, query)}</div>`;
		if (res.page.excerpt) {
			html += `    <div class="search-result-item-excerpt">${highlightText(res.page.excerpt, query)}</div>`;
		}
		html += "  </div>";

		for (const h of res.matchedHeadings) {
			const hHref = `${href}#${h.id}`;
			const hIndex = currentResults.length;
			currentResults.push({
				href: hHref,
				title: `${res.page.title} > ${h.text}`,
			});

			html += `  <div class="search-result-item" data-index="${hIndex}" data-href="${hHref}">`;
			html +=
				'    <div class="search-result-item-title" style="padding-left: 12px; border-left: 1px solid var(--border); font-size: 0.78rem;">';
			html += `      <span style="color: var(--text-dim);">#</span> ${highlightText(h.text, query)}`;
			html += "    </div>";
			html += "  </div>";
		}
		html += "</div>";
	}

	resultsContainer.innerHTML = html;
	selectedIndex = 0;
	updateSelection();

	document.querySelectorAll(".search-result-item").forEach((item) => {
		item.addEventListener("click", () => {
			const href = item.getAttribute("data-href");
			if (href) window.location.href = href;
		});
	});
}

function updateSelection() {
	const items = document.querySelectorAll(".search-result-item");
	items.forEach((item, idx) => {
		if (idx === selectedIndex) {
			item.classList.add("selected");
			item.scrollIntoView({ block: "nearest" });
		} else {
			item.classList.remove("selected");
		}
	});
}

function escapeHtml(str) {
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightText(text, query) {
	const idx = text.toLowerCase().indexOf(query);
	if (idx === -1) return escapeHtml(text);
	const before = text.slice(0, idx);
	const match = text.slice(idx, idx + query.length);
	const after = text.slice(idx + query.length);
	return `${escapeHtml(before)}<mark>${escapeHtml(match)}</mark>${escapeHtml(after)}`;
}

searchInput?.addEventListener("keydown", (e) => {
	if (e.key === "ArrowDown") {
		e.preventDefault();
		if (currentResults.length > 0) {
			selectedIndex = (selectedIndex + 1) % currentResults.length;
			updateSelection();
		}
	} else if (e.key === "ArrowUp") {
		e.preventDefault();
		if (currentResults.length > 0) {
			selectedIndex =
				(selectedIndex - 1 + currentResults.length) % currentResults.length;
			updateSelection();
		}
	} else if (e.key === "Enter") {
		e.preventDefault();
		if (selectedIndex >= 0 && selectedIndex < currentResults.length) {
			window.location.href = currentResults[selectedIndex].href;
		}
	}
});
