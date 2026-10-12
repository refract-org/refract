# Contributing to Refract documentation

Documentation changes are contributions. This page covers conventions, structure,
and process for improving Refract docs.

## What to contribute

| Contribution | Example |
|-------------|---------|
| Fix a typo or stale reference | Package names, env vars, URLs |
| Improve a tutorial | Add a real walkthrough with actual output |
| Add a diagram | SVG diagrams in `assets/` |
| Add a new page | New use case, integration guide, or reference |
| Improve the build system | build.mjs, CSS, rendering |

## Repository structure

```
refract-docs/
├── docs/               # Markdown source (one .md per page)
│   ├── tutorials/      # Tutorial pages
│   └── ...
├── assets/             # Static assets (SVGs, CSS)
├── build.mjs           # Static site builder
├── dist/               # Built output (gitignored, CI-only)
└── package.json
```

## Page conventions

### File naming
- Lowercase, hyphenated: `frontier-use-cases.md`, `bundle-manifest.md`
- Tutorials go in `docs/tutorials/`

### Front matter
No YAML front matter needed. The first `# Heading` in the file becomes the page
title. The page slug is the filename minus `.md`.

### Tone
- Technical, neutral, precise. No marketing language.
- One idea per paragraph. One sentence per idea when possible.
- Use `Refract` (capital R) as the project name.
- Reference packages as `@refract-org/<name>`.
- Reference the CLI as `refract` (`wikihistory` is mentioned once as an alias).

### Code blocks
Use fenced code blocks with language tags:

```markdown
\`\`\`bash
refract analyze "Earth" --depth detailed
\`\`\`

\`\`\`python
import pandas as pd
\`\`\`
```

### Links
Use relative links to other docs pages:

```markdown
[Concepts](../concepts.md)
[CLI reference](../cli.md)
```

External links use full URLs.

### Diagrams
SVG diagrams go in `assets/`. Reference them with a relative path:

```markdown
![Architecture data flow](architecture-flow.svg)
```

The build script copies `assets/` into `dist/` so relative paths work.

## Adding a new page

1. Create `docs/<slug>.md` with the page content
2. Add the page to the `NAV` array in `build.mjs`:
   ```javascript
   {
     title: 'Appendix',
     slug: null,
     children: [
       // ... existing entries ...
       { title: 'Your New Page', slug: 'your-new-page' },
     ],
   },
   ```
3. Run `npm run build` to verify
4. Open a PR

## Diagram style

All diagrams use consistent styling:
- **Font**: System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`)
- **Colors**: Tailwind gray scale for text (`#111827` for headings, `#4b5563` for body)
- **Layer colors**: Blue for deterministic (`#2563eb`, `#1d4ed8`), green for ground truth (`#059669`, `#047857`), purple for downstream/model (`#7c3aed`, `#6d28d9`)
- **Card style**: White background, rounded corners (rx="8"), subtle shadow via `<filter>`
- **Dimensions**: Match existing diagram widths (720px or 760px for wider diagrams)

## Tutorial checklist

A good tutorial:
- [ ] Has a clear goal statement
- [ ] Shows commands the user can copy-paste and run
- [ ] Shows expected output for each step
- [ ] Explains how to interpret what the user sees
- [ ] Includes troubleshooting for common problems
- [ ] Links to next steps

## Build and preview

```bash
npm run build        # Build static site to dist/
```

The site is plain HTML — open `dist/index.html` in a browser, or serve with any static
file server:

```bash
npx serve dist
```

## Review process

- PRs to `main` trigger CI build (see `.github/workflows/ci.yml`)
- Merged PRs deploy to GitHub Pages automatically (see `.github/workflows/deploy.yml`)
- Documentation PRs follow the same [code of conduct](https://github.com/refract-org/refract/blob/main/.github/CODE_OF_CONDUCT.md) as code PRs
