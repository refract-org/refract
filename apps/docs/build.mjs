import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import { CARD_HEIGHT, CARD_WIDTH, renderSocialCard } from "./social-card.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = join(__dirname, "docs");
const DIST_DIR = join(__dirname, "dist");
const ASSETS_DIR = join(__dirname, "assets");
const BASE = process.env.BASE || "/refract-docs/";
// Absolute address of the published site. Canonical URLs, og:url, JSON-LD
// and the sitemap point here even when BASE is overridden for a local build.
const SITE_URL = (
	process.env.SITE_URL || "https://refract-org.github.io/refract-docs/"
).replace(/\/?$/, "/");
const SITE_NAME = "Refract";
const SITE_DESCRIPTION =
	"A deterministic observation engine for revision histories. It reads a page's edits and emits a typed event for each change.";
const SOURCE_REPOSITORY = "https://github.com/refract-org/refract";
// One Open Graph card for every page, rendered at build time from the name
// and description above.
const SOCIAL_CARD_FILE = "social-card.png";
const SOCIAL_CARD_ALT = `${SITE_NAME}. ${SITE_DESCRIPTION}`;

function assetVersion() {
	if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 12);
	try {
		return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
			cwd: __dirname,
			encoding: "utf-8",
		})
			.trim()
			.replace(/[^\w.-]/g, "");
	} catch {
		return "dev";
	}
}

const ASSET_VERSION = assetVersion();

let NAV = [];

function resolveTitle(slug, fallback = basename(slug)) {
	for (const item of NAV) {
		if (item.slug === slug) return item.title;
		if (item.children) {
			for (const child of item.children) {
				if (child.slug === slug) return child.title;
			}
		}
	}
	return fallback;
}

// GitHub Pages serves dist/<slug>/index.html at <slug>/ and 301-redirects the
// slash-less form, so the trailing-slash URL is the one to link and canonicalize.
function slugHref(slug, base = BASE) {
	return slug === "index" ? base : `${base}${slug}/`;
}

// Safe in HTML attribute values and in XML text alike.
function escapeMarkup(text) {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function structuredData(title, description, slug) {
	const url = slugHref(slug, SITE_URL);
	const website = {
		"@type": "WebSite",
		"@id": `${SITE_URL}#website`,
		name: SITE_NAME,
		url: SITE_URL,
	};
	if (slug === "index") {
		return {
			"@context": "https://schema.org",
			"@graph": [
				{
					...website,
					description,
					inLanguage: "en",
					about: { "@id": `${SITE_URL}#source` },
				},
				{
					"@type": "SoftwareSourceCode",
					"@id": `${SITE_URL}#source`,
					name: SITE_NAME,
					codeRepository: SOURCE_REPOSITORY,
				},
			],
		};
	}
	return {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "TechArticle",
				"@id": `${url}#article`,
				headline: title,
				description,
				url,
				mainEntityOfPage: url,
				inLanguage: "en",
				isPartOf: website,
			},
			{
				"@type": "BreadcrumbList",
				itemListElement: [
					{
						"@type": "ListItem",
						position: 1,
						name: resolveTitle("index"),
						item: SITE_URL,
					},
					{
						"@type": "ListItem",
						position: 2,
						name: resolveTitle(slug, title),
						item: url,
					},
				],
			},
		],
	};
}

function renderSeoHead(title, description, slug) {
	const url = escapeMarkup(slugHref(slug, SITE_URL));
	// "<" is escaped so no title can close the script element early.
	const jsonLd = JSON.stringify(
		structuredData(title, description, slug),
	).replace(/</g, "\\u003c");
	return `<link rel="canonical" href="${url}">
  <meta property="og:type" content="${slug === "index" ? "website" : "article"}">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:title" content="${escapeMarkup(title)}">
  <meta property="og:description" content="${escapeMarkup(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${escapeMarkup(`${SITE_URL}${SOCIAL_CARD_FILE}`)}">
  <meta property="og:image:width" content="${CARD_WIDTH}">
  <meta property="og:image:height" content="${CARD_HEIGHT}">
  <meta property="og:image:alt" content="${escapeMarkup(SOCIAL_CARD_ALT)}">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${jsonLd}</script>`;
}

function renderSitemap(slugs) {
	const urls = slugs.map((slug) => slugHref(slug, SITE_URL)).sort();
	const entries = urls
		.map((url) => `  <url><loc>${escapeMarkup(url)}</loc></url>`)
		.join("\n");
	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

function renderNav(currentSlug) {
	function link(item) {
		const isActive = item.slug === currentSlug;
		const cls = isActive ? "nav-link active" : "nav-link";
		return `<a href="${slugHref(item.slug)}" class="${cls}">${item.title}</a>`;
	}

	let html = "";
	for (const item of NAV) {
		if (item.children) {
			const parentActive = item.children.some((c) => c.slug === currentSlug);
			html += `<div class="nav-section">${item.title}</div>`;
			html += `<div class="nav-group${parentActive ? " open" : ""}">`;
			for (const child of item.children) {
				html += link(child);
			}
			html += "</div>";
		} else {
			html += link(item);
		}
	}
	return html;
}

function plainText(tokens, skipTypes = []) {
	return tokens
		.map((token) => {
			if (skipTypes.includes(token.type)) return "";
			if (token.tokens) return plainText(token.tokens, skipTypes);
			return token.text ?? token.raw ?? "";
		})
		.join("");
}

// Inline text of a heading or paragraph with markdown, HTML tags and images
// removed and whitespace collapsed.
function inlineText(tokens) {
	return plainText(tokens, ["html", "image"]).replace(/\s+/g, " ").trim();
}

function pageTitle(tokens, slug) {
	const h1 = tokens.find((t) => t.type === "heading" && t.depth === 1);
	return h1 ? inlineText(h1.tokens) : resolveTitle(slug);
}

const DESCRIPTION_LENGTH = 155;

function truncateAtWord(text, max) {
	if (text.length <= max) return text;
	const cut = text.slice(0, max + 1);
	const end = cut.lastIndexOf(" ");
	return `${cut.slice(0, end > 0 ? end : max).replace(/[\s,;:—–-]+$/, "")}…`;
}

// A paragraph can stand in for the page when it is prose that ends a sentence.
// That rules out lead-ins to the next block ("Use environment variables
// instead:"), bold-label callouts ("**Note**: …", glossary-style
// "**Term** — …"), parenthetical asides, "See [page]" pointers and images.
function isSummaryParagraph(token, text) {
	if (!/[.!?]["'”’)]*$/.test(text)) return false;
	if (/^\(.*\)$/.test(text)) return false;
	const [first, second] = token.tokens;
	if (
		first?.type === "strong" &&
		second &&
		(/:$/.test(first.text) || /^\s*[:—–]|^\s+-\s/.test(second.raw))
	) {
		return false;
	}
	return !(/^See\s/.test(text) && token.tokens.some((t) => t.type === "link"));
}

// The first prose paragraph after the H1, trimmed for a meta description.
// Only top-level paragraphs count, so lists, tables, code blocks, blockquotes
// and HTML blocks are skipped. Returns "" when the page has none.
function pageSummary(tokens) {
	const h1 = tokens.findIndex((t) => t.type === "heading" && t.depth === 1);
	for (const token of tokens.slice(h1 + 1)) {
		if (token.type !== "paragraph") continue;
		const text = inlineText(token.tokens);
		if (isSummaryParagraph(token, text)) {
			return truncateAtWord(text, DESCRIPTION_LENGTH);
		}
	}
	return "";
}

function slugifyHeading(text) {
	return text
		.toLowerCase()
		.trim()
		.replace(/[`]/g, "")
		.replace(/[^\w\s-]/g, "")
		.replace(/\s/g, "-");
}

// A title that already leads with the name doesn't repeat it as a suffix.
function documentTitle(title) {
	return title.startsWith(SITE_NAME) ? title : `${title} — ${SITE_NAME}`;
}

function wrapHTML(title, description, content, currentSlug, headings = []) {
	let tocHtml = "";
	if (headings.length > 0) {
		tocHtml += `<div class="toc-title">On this page</div>`;
		tocHtml += `<div class="toc-links">`;
		for (const h of headings) {
			const cls = h.depth === 3 ? "toc-link depth-3" : "toc-link";
			tocHtml += `<a href="#${h.id}" class="${cls}">${h.text}</a>`;
		}
		tocHtml += `</div>`;
	}
	const hasToc = headings.length > 0;
	const tocStyle = hasToc ? "" : ' style="display: none;"';

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeMarkup(documentTitle(title))}</title>
  <link rel="stylesheet" href="${BASE}style.css?v=${ASSET_VERSION}">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><style>path{fill:%2307090f}@media (prefers-color-scheme:dark){path{fill:%23e2e4ed}}</style><path d='M8 2 15 14H1z'/></svg>">
  <meta name="description" content="${escapeMarkup(description)}">
  ${renderSeoHead(title, description, currentSlug)}
</head>
<body>
  <div id="progress" aria-hidden="true"></div>
  <input type="checkbox" id="menu-toggle" class="menu-toggle">
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-header">
        <a href="${BASE}" class="brand">Refract</a>
        <p class="tagline">A deterministic observation engine<br>for revision histories.</p>
        <div class="sidebar-search">
          <button class="search-trigger" id="search-trigger" aria-label="Search documentation">
            <svg class="search-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span>Search docs...</span>
            <kbd class="search-shortcut">/</kbd>
          </button>
        </div>
      </div>
      <nav class="sidebar-nav">
        ${renderNav(currentSlug)}
      </nav>
      <div class="sidebar-footer">
        <a href="https://github.com/refract-org/refract" class="sidebar-link">GitHub</a>
        <a href="https://www.npmjs.com/org/refract-org" class="sidebar-link">npm packages</a>
      </div>
    </aside>
    <label for="menu-toggle" class="menu-overlay"></label>
    <div class="content-container">
      <main class="content">
        <label for="menu-toggle" class="menu-btn" aria-label="Toggle menu">
          <span></span><span></span><span></span>
        </label>
        ${content}
      </main>
      <aside class="toc-sidebar" aria-label="Table of Contents"${tocStyle}>
        ${tocHtml}
      </aside>
    </div>
  </div>

  <!-- Search Modal -->
  <div class="search-modal-backdrop" id="search-modal-backdrop">
    <div class="search-modal">
      <div class="search-modal-header">
        <div class="search-modal-input-wrapper">
          <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" class="search-modal-input" id="search-modal-input" placeholder="Search documentation..." autocomplete="off">
        </div>
        <button class="search-modal-close" id="search-modal-close">ESC</button>
      </div>
      <div class="search-modal-results" id="search-modal-results">
        <div class="search-no-results">Type something to search...</div>
      </div>
      <div class="search-modal-footer">
        <span><kbd>↑↓</kbd> Navigate</span>
        <span><kbd>Enter</kbd> Select</span>
        <span><kbd>Esc</kbd> Close</span>
      </div>
    </div>
  </div>

  <script>
    // 1. Scroll Progress Bar fallback
    if (!CSS.supports('animation-timeline', 'scroll()')) {
      const progress = document.querySelector('#progress');
      if (progress) {
        window.addEventListener('scroll', () => {
          const scrollable = document.documentElement.scrollHeight - window.innerHeight;
          const scrolled = window.scrollY;
          const progressPercentage = scrollable > 0 ? (scrolled / scrollable) : 0;
          progress.style.transform = 'scaleX(' + progressPercentage + ')';
        }, { passive: true });
      }
    }

    // 2. Scroll-Spy TOC highlighting
    const links = document.querySelectorAll('.toc-link');
    const headings = document.querySelectorAll('.content h2, .content h3');
    let activeHeadingId = null;

    if (links.length > 0 && headings.length > 0) {
      const observerOptions = {
        root: null,
        rootMargin: '0px 0px -60% 0px',
        threshold: 0
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
          const href = link.getAttribute('href');
          if (href === '#' + activeHeadingId) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        });
      }

      window.addEventListener('scroll', () => {
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
      }, { passive: true });
    }

    // 3. Floating Copy Button on Code Blocks
    document.querySelectorAll('.content pre').forEach((preBlock) => {
      const code = preBlock.querySelector('code');
      if (!code) return;
      
      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span>Copy</span>';
      
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(code.innerText);
          btn.classList.add('copied');
          btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Copied</span>';
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span>Copy</span>';
          }, 2000);
        } catch (err) {
          console.error('Failed to copy text: ', err);
        }
      });
      
      preBlock.appendChild(btn);
    });

    // 4. Interactive Search
    const backdrop = document.getElementById('search-modal-backdrop');
    const trigger = document.getElementById('search-trigger');
    const closeBtn = document.getElementById('search-modal-close');
    const searchInput = document.getElementById('search-modal-input');
    const resultsContainer = document.getElementById('search-modal-results');
    
    let indexLoaded = false;
    let searchData = [];
    let selectedIndex = -1;
    let currentResults = [];

    async function loadSearchIndex() {
      if (indexLoaded) return;
      try {
        const resp = await fetch('${BASE}search-index.json');
        searchData = await resp.json();
        indexLoaded = true;
      } catch (err) {
        console.error('Failed to load search index:', err);
      }
    }

    function openSearch() {
      backdrop.style.display = 'flex';
      backdrop.offsetHeight;
      backdrop.classList.add('open');
      searchInput.focus();
      loadSearchIndex();
      document.body.style.overflow = 'hidden';
    }

    function closeSearch() {
      backdrop.classList.remove('open');
      setTimeout(() => {
        backdrop.style.display = 'none';
      }, 200);
      document.body.style.overflow = '';
      searchInput.value = '';
      resultsContainer.innerHTML = '<div class="search-no-results">Type something to search...</div>';
      currentResults = [];
      selectedIndex = -1;
    }

    trigger?.addEventListener('click', openSearch);
    closeBtn?.addEventListener('click', closeSearch);
    backdrop?.addEventListener('click', (e) => {
      if (e.target === backdrop) closeSearch();
    });

    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearch();
      } else if (e.key === '/' && document.activeElement !== searchInput && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        openSearch();
      } else if (e.key === 'Escape' && backdrop.classList.contains('open')) {
        closeSearch();
      }
    });

    searchInput?.addEventListener('input', (e) => {
      const query = e.target.value.trim().toLowerCase();
      if (!query) {
        resultsContainer.innerHTML = '<div class="search-no-results">Type something to search...</div>';
        currentResults = [];
        selectedIndex = -1;
        return;
      }
      performSearch(query);
    });

    function performSearch(query) {
      const results = [];
      for (const page of searchData) {
        const titleMatch = page.title.toLowerCase().includes(query);
        const excerptMatch = page.excerpt.toLowerCase().includes(query);
        const matchedHeadings = page.headings.filter(h => h.text.toLowerCase().includes(query));
        
        if (titleMatch || excerptMatch || matchedHeadings.length > 0) {
          results.push({
            page,
            titleMatch,
            excerptMatch,
            matchedHeadings
          });
        }
      }
      
      if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="search-no-results">No results found for "' + escapeHtml(query) + '"</div>';
        currentResults = [];
        selectedIndex = -1;
        return;
      }
      
      currentResults = [];
      let html = '';
      for (const res of results) {
        html += '<div class="search-result-group">';
        html += '  <div class="search-result-group-title">' + escapeHtml(res.page.title) + '</div>';
        
        const href = res.page.slug === 'index' ? '${BASE}' : '${BASE}' + res.page.slug + '/';
        const itemIndex = currentResults.length;
        currentResults.push({ href, title: res.page.title });
        
        html += '  <div class="search-result-item" data-index="' + itemIndex + '" data-href="' + href + '">';
        html += '    <div class="search-result-item-title">' + highlightText(res.page.title, query) + '</div>';
        if (res.page.excerpt) {
          html += '    <div class="search-result-item-excerpt">' + highlightText(res.page.excerpt, query) + '</div>';
        }
        html += '  </div>';
        
        for (const h of res.matchedHeadings) {
          const hHref = href + '#' + h.id;
          const hIndex = currentResults.length;
          currentResults.push({ href: hHref, title: res.page.title + ' > ' + h.text });
          
          html += '  <div class="search-result-item" data-index="' + hIndex + '" data-href="' + hHref + '">';
          html += '    <div class="search-result-item-title" style="padding-left: 12px; border-left: 1px solid var(--border); font-size: 0.78rem;">';
          html += '      <span style="color: var(--text-dim);">#</span> ' + highlightText(h.text, query);
          html += '    </div>';
          html += '  </div>';
        }
        html += '</div>';
      }
      
      resultsContainer.innerHTML = html;
      selectedIndex = 0;
      updateSelection();
      
      document.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
          const href = item.getAttribute('data-href');
          window.location.href = href;
        });
      });
    }

    function updateSelection() {
      const items = document.querySelectorAll('.search-result-item');
      items.forEach((item, idx) => {
        if (idx === selectedIndex) {
          item.classList.add('selected');
          item.scrollIntoView({ block: 'nearest' });
        } else {
          item.classList.remove('selected');
        }
      });
    }

    function escapeHtml(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function highlightText(text, query) {
      const idx = text.toLowerCase().indexOf(query);
      if (idx === -1) return escapeHtml(text);
      const before = text.slice(0, idx);
      const match = text.slice(idx, idx + query.length);
      const after = text.slice(idx + query.length);
      return escapeHtml(before) + '<mark>' + escapeHtml(match) + '</mark>' + escapeHtml(after);
    }

    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentResults.length > 0) {
          selectedIndex = (selectedIndex + 1) % currentResults.length;
          updateSelection();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentResults.length > 0) {
          selectedIndex = (selectedIndex - 1 + currentResults.length) % currentResults.length;
          updateSelection();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < currentResults.length) {
          window.location.href = currentResults[selectedIndex].href;
        }
      }
    });
  </script>
</body>
</html>`;
}

// Resolves a markdown link against the source file's directory. A link to a
// page (`cli.md`, `cli`, `./cli/`, `../index.md`) becomes the page's
// trailing-slash URL, so it never 301-redirects. A path whose last segment has
// a file extension (`.svg`, `.png`, `.ipynb`) is an asset and keeps its form.
export function rewriteLink(href, sourceDir = "") {
	if (!href) return href;
	if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith("#")) return href;

	const [, rawPath = "", suffix = ""] = href.match(/^([^?#]*)([?#].*)?$/) ?? [];
	if (!rawPath) return href;

	const path = posix
		.normalize(
			rawPath.startsWith("/") ? rawPath : posix.join("/", sourceDir, rawPath),
		)
		.replace(/^\/+|\/+$/g, "");
	if (posix.extname(path) && !path.endsWith(".md")) {
		return `${BASE}${path}${suffix}`;
	}
	const slug = path.replace(/\.md$/, "").replace(/(^|\/)index$/, "");
	return `${slugHref(slug || "index")}${suffix}`;
}

async function collectFiles(dir, base = "") {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = [];
	const assets = [];
	for (const entry of entries) {
		const fp = join(dir, entry.name);
		const rel = base ? `${base}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			const res = await collectFiles(fp, rel);
			files.push(...res.files);
			assets.push(...res.assets);
		} else if (entry.name.endsWith(".md")) {
			files.push({ path: fp, slug: rel.replace(/\.md$/, "") });
		} else {
			assets.push({ path: fp, rel });
		}
	}
	return { files, assets };
}

async function build() {
	NAV = JSON.parse(await readFile(join(DOCS_DIR, "nav.json"), "utf-8"));

	await rm(DIST_DIR, { recursive: true, force: true });
	await mkdir(DIST_DIR, { recursive: true });

	const { files, assets } = await collectFiles(DOCS_DIR);

	const searchIndex = [];
	const fallbackPages = [];
	const renderer = new marked.Renderer();
	let currentSourceDir = "";
	let currentHeadingCounts = new Map();
	let currentHeadings = [];

	renderer.link = ({ href, title, text }) => {
		const h = rewriteLink(href, currentSourceDir);
		const t = title ? ` title="${title}"` : "";
		return `<a href="${h}"${t}>${text}</a>`;
	};
	renderer.image = ({ href, title, text }) => {
		const h = rewriteLink(href, currentSourceDir);
		const t = title ? ` title="${title}"` : "";
		return `<img src="${h}" alt="${text}"${t}>`;
	};
	// A table wider than the column scrolls inside this box, so a narrow
	// screen never has to scroll the whole page sideways to read it.
	const renderTable = renderer.table;
	renderer.table = function (token) {
		return `<div class="table-scroll">${renderTable.call(this, token)}</div>\n`;
	};
	renderer.heading = function ({ tokens, depth }) {
		const text = this.parser.parseInline(tokens);
		const baseSlug = slugifyHeading(plainText(tokens));
		const count = currentHeadingCounts.get(baseSlug) ?? 0;
		currentHeadingCounts.set(baseSlug, count + 1);
		const slug = count === 0 ? baseSlug : `${baseSlug}-${count}`;
		if (depth === 2 || depth === 3) {
			currentHeadings.push({ text: plainText(tokens), id: slug, depth });
		}
		return `<h${depth} id="${slug}">${text}</h${depth}>`;
	};

	marked.use({ gfm: true, breaks: false });

	for (const file of files) {
		const raw = await readFile(file.path, "utf-8");
		currentSourceDir = dirname(file.slug);
		if (currentSourceDir === ".") currentSourceDir = "";
		currentHeadingCounts = new Map();
		currentHeadings = [];
		const body = marked.parse(raw, { renderer });
		const tokens = marked.lexer(raw);
		const title = pageTitle(tokens, file.slug);
		// The home page keeps the site-wide positioning line.
		const summary = file.slug === "index" ? "" : pageSummary(tokens);
		if (file.slug !== "index" && !summary) fallbackPages.push(file.slug);
		const description = summary || SITE_DESCRIPTION;
		const html = wrapHTML(title, description, body, file.slug, currentHeadings);

		if (file.slug === "index") {
			await writeFile(join(DIST_DIR, "index.html"), html);
		} else {
			const outDir = join(DIST_DIR, file.slug);
			await mkdir(outDir, { recursive: true });
			await writeFile(join(outDir, "index.html"), html);
		}

		searchIndex.push({
			title,
			slug: file.slug,
			excerpt: description,
			headings: currentHeadings.map((h) => ({ text: h.text, id: h.id })),
		});
	}

	await writeFile(
		join(DIST_DIR, "search-index.json"),
		JSON.stringify(searchIndex, null, 2),
	);
	// No <lastmod>: the deploy checkout is shallow, so git history cannot date
	// individual pages there.
	await writeFile(
		join(DIST_DIR, "sitemap.xml"),
		renderSitemap(files.map((file) => file.slug)),
	);
	await writeFile(
		join(DIST_DIR, SOCIAL_CARD_FILE),
		renderSocialCard({
			name: SITE_NAME,
			description: SITE_DESCRIPTION,
			address: SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, ""),
		}),
	);

	for (const asset of assets) {
		const dest = join(DIST_DIR, asset.rel);
		await mkdir(dirname(dest), { recursive: true });
		await cp(asset.path, dest);
	}

	await cp(ASSETS_DIR, DIST_DIR, { recursive: true });
	console.log(
		`Built ${files.length} pages and copied ${assets.length} assets to dist/`,
	);
	if (fallbackPages.length > 0) {
		console.log(
			`No prose paragraph to describe, so these pages use the site description: ${fallbackPages.sort().join(", ")}`,
		);
	}
}

// Build only when run as a script, so tests can import rewriteLink. Both sides
// are real paths, so a symlinked checkout still builds.
if (
	process.argv[1] &&
	realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	build().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
