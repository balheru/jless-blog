# Repository Developer and Agent Onboarding Guide

This document defines the structural architecture, development workflow, testing configurations, and deployment pipelines for the `jless-blog` repository.

## 1. Project Architecture and Design Goals

The repository implements a terminal-themed blog inspired by Text User Interface (TUI) JSON viewers like `jless` and `less`. It is built to achieve:
- **Keyboard-first navigation**: Complete interface traversal and control via Vim-style keybindings, alongside mouse interaction support.
- **Terminal aesthetic**: Typography uses JetBrains Mono and styling uses a One Dark derived color palette without non-essential graphical decorations.
- **State-driven rendering**: UI components derive their presentation from a single source of truth in memory. There are no direct DOM manipulations or cached selectors for visibility.
- **Static routing**: Articles render as static, SEO-indexable pages under `/posts/[slug]/` compiled at build time.

### Tech Stack
- **Framework**: Astro 6 (configured for static site generation)
- **UI Architecture**: Svelte 5 (using reactive runes for component-level state and effects)
- **Styling**: Vanilla CSS (defined in `src/styles/global.css` using custom properties)
- **Search**: Pagefind (compiled post-build to index static HTML files)
- **Unit Testing**: Vitest
- **End-to-End Testing**: Playwright
- **Hosting / Deployments**: Cloudflare Pages / Wrangler

---

## 2. Codebase Structure and Key Modules

### Directory Layout
- `src/content/posts/`: Contains source Markdown files (`.md`) representing blog posts.
- `src/content.config.ts`: Defines the validation schema for post frontmatter.
- `src/lib/treeModel.ts`: Implements the JSON flattening, navigation, and visibility logic.
- `src/lib/site.ts`: Implements site configuration, post sorting, and date tree aggregation logic.
- `src/components/`: Svelte components for individual panes, headers, overlays, and footers.
- `src/pages/`: Astro entrypoints for routing (`index.astro` and `posts/[slug].astro`).
- `src/styles/global.css`: Core design system variables and layout rules.
- `tests/`: Playwright end-to-end integration tests.

### Tree Flattening Model (`src/lib/treeModel.ts`)
The homepage represents JSON data using a flattened line structure rather than nested DOM elements. This prevents DOM synchronization errors.
- **Data Model**: The `flatten` function takes a JSON object and flattens it recursively into an array of `Line` objects. Each `Line` stores:
  - `id`: Unique identifier containing the dot-path and line kind.
  - `path`: The dot-separated path of the node in the JSON hierarchy (e.g., `root.years.2026`).
  - `ancestors`: Array of parent paths leading to this node.
  - `depth`: Indentation depth level.
  - `kind`: `'opening'` (e.g., `{`), `'leaf'` (value), or `'closing'` (e.g., `}`).
- **Visibility derivation**: A line is visible if and only if none of its ancestor paths are present in the set of collapsed nodes. Closing lines also require their own path to be expanded.
- **Navigation calculations**:
  - Sibling jumps (`J` / `K`): Computes the next or previous node that shares the same parent path and depth level.
  - Depth jumps (`w` / `b`): Jumps to the next or previous line that has a different depth level.

### Svelte 5 Reactivity (`src/components/JlessApp.svelte`)
- State variables are declared using Svelte 5 runes (`$state`).
- Derived computations (like filtering posts based on dates-pane selections or searching text) use `$derived`.
- Synchronous adjustments (such as resetting selections or clearing buffers) use `$effect` combined with `untrack` to prevent cycle loops.

### SVG 3D Graph Node Projection (`src/components/GraphPane.svelte`)
The graph pane renders a rotating 3D network model of posts and tags using SVG.
- **BFS Shell Layout**: The active post is fixed at the origin $(0, 0, 0)$. Other nodes are assigned to concentric spheres (shells) based on their shortest path distance (calculated via Breadth-First Search) from the active post.
- **3D Projection**: Node coordinates are calculated in 3D space and rotated continuously around the Y-axis and tilted on the X-axis. The 3D coordinates $(x, y, z)$ are projected onto the 2D SVG canvas $(X_{svg}, Y_{svg})$ using orthographic projection formulas.
- **Visual Depth Cueing**: Radius size and opacity of nodes/links scale relative to their depth coordinate ($z$) to simulate perspective. The active post's text label is omitted for layout clarity, while prominent tag/post labels are rendered based on opacity thresholds.

### Sidenotes and Collisions (`src/pages/posts/[slug].astro`)
Standard Markdown footnotes are parsed client-side inside the browser and moved into the margins.
- **HTML Footnotes Transformation**: The client script queries for elements matching GFM footnotes (which use the `data-footnote-ref` attribute for references and `data-footnote-backref` for back-links). It extracts the footnote list item contents, strips backreference links, and compiles a container element with the class `sidenote`.
- **Directional Margins**: Sidenotes are directed to either the left or right margin depending on their content prefixes:
  - If a footnote starts with `L:` or `left:`, it is assigned `sidenote-left` and aligned in the left margin.
  - If a footnote starts with `R:` or `right:`, or has no prefix, it is assigned `sidenote-right` and aligned in the right margin.
  - The prefix matches are case-insensitive and are stripped from the final displayed text.
- **Anti-Overlap Collision Resolution**:
  - The script collects left and right sidenotes separately and resets their styles.
  - It sorts them vertically based on their natural layout offset (`offsetTop`).
  - It iterates through the sorted list, checking if a sidenote's top coordinate is higher than the bottom coordinate of the previous sidenote. If so, it adjusts the sidenote's style (`style.top`) to equal `lastBottom + 12px` (providing a 12px margin gap) and updates the tracking boundary.
- **Responsive Fallback**:
  - On viewports $\ge 1200\text{px}$, sidenotes are positioned absolutely in the left or right margins of the article container.
  - On viewports $< 1200\text{px}$, CSS overrides sidenote styles, collapsing them into block elements styled with left-hand borders inline below their reference paragraphs.

---

## 3. Keyboard Bindings Reference

The interface operates under four distinct modes:
1. **NORMAL**: Navigation of the three-pane homepage tree.
2. **SEARCH**: Text query entry.
3. **HELP**: Keyboard shortcut reference overlay.
4. **PAGER**: Article reading view.

### NORMAL Mode Keybindings
- `j` / `ArrowDown`: Move selection down by one visible line.
- `k` / `ArrowUp`: Move selection up by one visible line.
- `J`: Jump to next sibling node at same level.
- `K`: Jump to previous sibling node at same level.
- `w`: Jump forward to next line at a different depth.
- `b`: Jump backward to previous line at a different depth.
- `g g`: Jump to the first visible line in the pane (key buffer displays `g`).
- `G`: Jump to the last visible line in the pane.
- `Space` / `Enter`: Toggle the collapse/expand state of the selected container line.
- `h` / `ArrowLeft`: Collapse expanded containers, jump to the opening container line from a closing line, or jump to the parent container line from a leaf node.
- `l` / `ArrowRight`: Expand collapsed containers, or jump to the first child of an expanded container.
- `c`: Collapse the selected container node along with all its immediate sibling nodes.
- `Tab` / `Shift-Tab`: Switch active focus between columns (`dates` $\to$ `posts` $\to$ `metadata` $\to$ `dates`).
- `Enter` / `o` (on a post leaf line in the posts pane): Open the post in the reader page.
- `f`: Set a tag filter based on the string value of the selected leaf line.
- `/`: Open the search bar.
- `n` / `N`: Focus the next or previous search match.
- `?`: Toggle the Help overlay.
- `Esc`: Clear tag filters (takes priority) or clear search query and highlights.

---

## 4. Development Workflow

### Requirements
- Node.js 22.12.0 or higher
- npm 10 or higher

### Installation
Install project dependencies locally:
```bash
npm install
```

### Dev Commands
- **Start Development Server**:
  Starts Astro's dev server. Pagefind indexing is not run on the development server, meaning body content search is unavailable in this mode.
  ```bash
  npm run dev
  ```
- **Build Production Artifacts**:
  Compiles the Astro static site into `./dist/` and runs the Pagefind compiler to index the generated HTML.
  ```bash
  npm run build
  ```
- **Preview Production Build**:
  Serves the static files from the `./dist/` directory on a local port.
  ```bash
  npm run preview
  ```

---

## 5. Testing Suite

The repository mandates passing both unit and end-to-end tests prior to branch integration.

### Unit Testing (Vitest)
Unit tests cover pure model functions, tree model flattening, visibility derivations, and jump target calculations. They are defined in `src/**/*.test.ts`.
```bash
npm run test
```

### End-to-End Testing (Playwright)
E2E tests verify complete page flows, keybinding responses, layout configurations, search overrides, Pagefind operations, and sidenote stacking behavior.
*Note: You must build the production site before running E2E tests, as the Playwright configuration targets the preview server.*
```bash
npm run build
npm run test:e2e
```
The Playwright configuration is defined in `playwright.config.ts`. It runs on port `4321` using headless Chromium.

---

## 6. Article Processing and Publishing Pipeline

### Post Content Schema
Articles are stored as Markdown files under `src/content/posts/`. Each file must define frontmatter validating against the Zod schema in `src/content.config.ts`:
```yaml
title: string          # The article title
date: YYYY-MM-DD       # Publication date format
author: string         # Author metadata
tags: string[]         # Array of tags, minimum 1 entry
summary: string        # Short article summary used for SEO and preview
pinned: boolean        # (Optional) If true, forces the post to the top of the posts list
```

### Automated Sync Workflow (`.github/workflows/publish.yml`)
1. **Source Repository**: Blog posts are written and stored inside the Obsidian vault repository at `balheru/claude-collab` under the `Blog/` folder.
2. **Repository Dispatch**: When changes are committed to the vault, it sends a `repository_dispatch` event of type `vault-updated` to this repository.
3. **Checkout and Sync**:
   - The GitHub Action checks out the `main` branch.
   - It clones the vault repository (`balheru/claude-collab`) using a secure `VAULT_SYNC_TOKEN`.
   - It performs a sparse-checkout of the `Blog/` folder and copies all markdown files recursively into `src/content/posts/`.
   - It configures the Git user to `vault-sync`, stages the updated posts, commits them, and pushes them back to `main`.
4. **Build and Validation**:
   - Installs dependencies using `npm ci`.
   - Runs unit tests (`npm test`).
   - Builds the application (`npm run build`), producing the static HTML and compiling the Pagefind index.
   - Runs Playwright E2E tests (`npm run test:e2e`).
5. **Deployment**:
   - If all tests pass, the action uses `cloudflare/wrangler-action` to upload the static `./dist/` directory to Cloudflare Pages.
   - The site is served publicly under the custom domain configured in `wrangler.jsonc` (`blog.thenightside.xyz`).

---

## 7. Development Guidelines and Git Workflow

### Branch Rules
- Development should occur in feature branches branched from `main`.
- Pull Requests are configured to default to **Squash and Merge** to maintain a linear commit history on `main`.
- Head branches are configured to be automatically deleted upon Pull Request merge.
