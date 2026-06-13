# jless-blog — Design Specification

A developer-centric blog that behaves like a terminal JSON viewer (inspired by
`jless` and `less`): the post index is presented as a navigable, foldable JSON
tree driven entirely by vim-style keybindings, with a rendered article reader.
This document extracts the complete feature set of the original single-file
prototype (`prototype/index.html`) and specifies the production rewrite
(Astro 6 + Svelte 5 + TypeScript).

## 1. Goals

- Keyboard-first: every interaction reachable without a mouse; mouse works too.
- Zero-clutter terminal aesthetic: One Dark palette, monospace, no decoration
  that a TUI could not render.
- Correct-by-construction interactivity: UI state (selection, folds, search,
  mode) is data; the DOM is a render of it. No imperative DOM caches.
- Real URLs: every post is a static, SEO-indexable page.

## 2. Visual design

### 2.1 Palette (One Dark derived)

| Token             | Value     | Use                                        |
|-------------------|-----------|--------------------------------------------|
| bg                | `#1e1e24` | App background, panes                      |
| bg-deep           | `#18181c` | Reader pane background                     |
| bg-deeper         | `#111115` | Code block background                      |
| chrome            | `#16161a` | Pane headers, footer                       |
| border            | `#282c34` | Pane borders, separators, kbd background   |
| border-soft       | `#3e4451` | kbd borders, scrollbar hover               |
| fg                | `#abb2bf` | Body text, brackets, commas                |
| fg-dim            | `#5c6370` | Muted text, null values, hints             |
| fg-gutter         | `#8c96a8` | Line numbers, fold arrows                  |
| accent            | `#61afef` | Active pane border, headers, cursor, links |
| key               | `#e06c75` | JSON keys, inline code                     |
| string            | `#98c379` | JSON strings, tags, confirm hints          |
| number            | `#d19a66` | JSON numbers and booleans                  |
| search            | `#e5c07b` | Search prompt, match highlight, indicators |
| purple            | `#c678dd` | Help section accent                        |
| cyan              | `#56b6c2` | Help section accent                        |
| selection         | `#2c313c` | Selected line (active pane)                |
| selection-passive | `#242831` | Selected line (inactive pane)              |
| hover             | `#23272e` | Line hover                                 |

### 2.2 Typography

- UI and tree: JetBrains Mono 400/500/700.
- Reader body: system sans stack; headings and meta in JetBrains Mono.
- Tree font size 0.9rem, line-height 1.6; chrome text 0.75-0.8rem uppercase
  with letter-spacing on pane headers.

### 2.3 Chrome

- Pane headers: dark strip, uppercase accent-colored title.
- Footer status bar: full-width, 34px, chrome background, top border.
- Thin custom scrollbars (8px, border-colored thumb).
- Selected line in the active pane shows a blinking block cursor `▋` (1s
  step-end) after the content; inactive panes show a passive highlight only.

## 3. Content model

### 3.1 Post

Markdown file in `src/content/posts/` with frontmatter:

```yaml
title: string          # required
date: YYYY-MM-DD       # required
author: string         # required
tags: string[]         # required, >= 1
summary: string        # required, one sentence
pinned: boolean        # optional, default false
```

Slug = filename. Body = markdown: headings (h1-h3), paragraphs, unordered
lists, bold/italic, inline code, fenced code blocks with language, links,
blockquotes.

### 3.2 Derived data (computed at build time)

- **Posts index**: array of `{ slug, title, date, author, tags, summary }`,
  pinned first, then date descending.
- **Dates tree**: `{ pinned: slug[], recent: slug[10 newest non-pinned],
  years: { [year]: { [MonthName]: "N posts" } } }`, years and months sorted
  descending.
- **Metadata**: `{ name, version, description, author: { alias, git,
  specialty } }` from a site constants module.

### 3.3 Content

Posts are authored markdown under `src/content/posts/`, one file per post,
validated against the frontmatter schema in `src/content.config.ts`. The site
launched with a single hand-written post; earlier development used a seeded
generator (`scripts/generate-posts.mjs`), removed once real content landed.

## 4. Layout

```
+---------------------------+--------------------+--------------------------+
| DATES (25% w, 50% h)      |                    |                          |
|---------------------------| POSTS (35% w)      | READER (flex)            |
| METADATA (25% w, 50% h)   |                    |                          |
+---------------------------+--------------------+--------------------------+
| status bar                                                                |
+---------------------------------------------------------------------------+
```

- Pane minimum widths: left column 200px, posts 250px, reader 300px.
- Exactly one pane is *active* (accent border); others have muted borders.
- The reader pane is a live preview; opening a post navigates to its page
  (section 8), which renders reader-only, full-width.

## 5. JSON tree presentation

Each pane renders a JSON value as a sequence of *lines*:

- **Line anatomy**: gutter line number (right-aligned, bordered) ·
  2-space-per-depth indent · fold arrow (`▼`, rotated -90deg when collapsed;
  blank spacer on leaves/closing lines) · content · trailing comma unless
  last sibling.
- **Line kinds**: `opening` (`"key": {` / `[`), `leaf` (`"key": value`),
  `closing` (`}` / `]`).
- **Value coloring**: keys red; strings green; numbers/booleans orange; null
  dim. The dates pane renders keys and string values unquoted
  (`stripQuotes`); other panes render JSON-faithful quoting.
- **Collapsed preview**: a collapsed object with a `title` or `name` shows
  `▶{ "title": "...", ... },` inline; otherwise `▶{ ... },`. Collapsing hides
  child and closing lines only; the opening line remains.
- **Key ordering**: post objects render keys in fixed order title, date,
  author, tags, summary, id/slug, content-link; container objects order
  `ALL`/`posts`/`pinned` first, then years and months numerically descending,
  then lexicographic.
- **Posts pane defaults**: every post node starts collapsed. Header shows
  `database.json`, breadcrumbs of the selected path (`POSTS > [3] > tags`),
  and `Line N/M` over visible lines.
- **Dates pane defaults**: year nodes start collapsed.

## 6. Interaction model

### 6.1 Modes

| Mode     | Where        | Entered by              | Left by                  |
|----------|--------------|-------------------------|--------------------------|
| NORMAL   | index        | default                 | -                        |
| SEARCH   | index        | `/` (input focused)     | `Enter` confirm, `Esc`   |
| HELP     | index        | `?`                     | `Esc`/`q`/`Enter`/click  |
| PAGER    | post page    | navigating to a post    | `q`/`Esc` back to index  |

Modifier-chorded keys (Ctrl/Meta/Alt) are never intercepted. Keys are never
intercepted while a text input is focused (except SEARCH handling below).

### 6.2 NORMAL mode bindings

| Key                | Action                                                   |
|--------------------|----------------------------------------------------------|
| `j` / `Down`       | Select next visible line                                 |
| `k` / `Up`         | Select previous visible line                             |
| `J`                | Jump to next sibling node at same level                  |
| `K`                | Jump to previous sibling node at same level              |
| `w`                | Jump forward to next line at a different depth           |
| `b`                | Jump backward to previous line at a different depth      |
| `g g`              | Jump to first visible line (pending `g` shown in status  |
|                    | bar key buffer; cancelled by any other key or 500ms)     |
| `G`                | Jump to last visible line                                |
| `Space`            | Toggle fold of current node                              |
| `h` / `Left`       | Expanded opening line: collapse. Closing line: jump to   |
|                    | its opening. Leaf or collapsed node: jump to parent      |
|                    | opening line                                             |
| `l` / `Right`      | Collapsed opening line: expand. Expanded: select first   |
|                    | child                                                    |
| `c`                | Collapse current node and all its siblings               |
| `Tab` / `S-Tab`    | Cycle active pane dates -> posts -> metadata -> dates    |
| `Enter` / `o`      | On a line inside a post node (posts pane): open the post |
|                    | page. Otherwise `Enter` toggles fold of opening lines    |
| `f`                | If current line is a string leaf: filter posts by that   |
|                    | string as a tag                                          |
| `/`                | Open search console                                      |
| `n` / `N`          | Next / previous search match (auto-reveals)              |
| `?`                | Open help overlay                                        |
| `Esc`              | Clear tag filter if set, else clear search highlights    |

Mouse: clicking a pane activates it; clicking a line selects it; clicking a
fold arrow toggles it.

### 6.3 Selection semantics

- Selection is an index into the *visible lines* of each pane (one remembered
  per pane), clamped to range after any fold/filter change.
- Visibility is structural: a line is visible iff no ancestor node is
  collapsed (closing lines additionally require their own node expanded).
  Whether a pane is currently displayed never affects the model.
- Selecting a line scrolls it into view (`block: nearest`).
- In the posts pane, selection drives the reader preview (section 7) and the
  breadcrumb/line indicators. In the dates pane, selection drives the post
  filter (section 6.5).

### 6.4 Search

- `/` opens a console overlaying the status bar: amber `/` prompt, free-text
  input, live match count (`N matches`, aria-live).
- Incremental: queries >= 2 chars match case-insensitively against the text
  of *every* line of the active pane, including lines hidden inside
  collapsed nodes. Matching lines get an amber highlight.
- `Enter` confirms: selects the first match, auto-expanding its ancestors;
  console closes, highlights persist, SEARCH ACTIVE indicator shows.
- `Esc` in the console cancels and clears highlights.
- `n`/`N` cycle matches with wraparound, auto-revealing each target.
- **Content search (rewrite addition)**: in production builds, the query is
  also run against the Pagefind full-text index (post bodies). Posts that
  match on content alone are added to the match cycle on their opening
  lines, and the count reads `N matches · M content`. In dev (no index)
  this layer is silently absent. The prototype could not search content.

### 6.5 Filtering

Posts-pane contents = pinned + all posts (default), narrowed by:

- **Dates-pane selection**: `pinned` section -> pinned only; a pinned/recent
  slug leaf -> that single post; `recent` -> 10 newest; a year -> that year;
  a month -> that month. Moving the dates selection re-renders the posts
  pane and resets its selection to the top.
- **Tag filter** (`f`): posts whose `tags` include the chosen string;
  combines with the dates filter; shown as `FILTER: <tag>` (green) in the
  status bar; cleared by `Esc` (takes precedence over clearing search).

### 6.6 Help overlay

Modal over a blurred backdrop: accent-bordered box listing all bindings in
sections [MOVEMENT] [TREE FOLDING] [ARTICLE READER] [SEARCH & FILTER]
[GENERAL], with a close button. Focus is trapped while open and restored on
close. `Esc`, `q`, `Enter`, `Space`, the button, or a backdrop click closes.

## 7. Reader preview (index)

- Selecting any line inside a post node renders that post in the reader
  pane: title, meta row (author, date, tag chips), then the article body.
- Body HTML is fetched on demand from the post's own page (parsed out of the
  static HTML) and cached per slug; metadata renders instantly from the
  index while the body loads. Failure falls back to the summary.
- Selecting a non-post line shows the empty state (document glyph, short
  usage hint).
- Preview pane header reads `Reader: <title>` / `Reader: No post selected`.

## 8. Post pages (PAGER mode)

Each post is a static route `/posts/<slug>/`:

- Full-width reader layout: same chrome (top bar with `Reader: <title>`),
  article rendered from markdown at build time, Shiki `one-dark-pro`
  highlighting, status bar locked to `MODE: PAGER` with hints
  `[[ / ]] Prev/Next  [q / Esc] Close Article`.
- Keys: `j`/`k`/`Down`/`Up` scroll by line (40px); `Space`/`PageDown` and
  `PageUp` scroll by viewport; `[` / `]` navigate to the previous / next
  post page (build-time ordering: pinned first, then date descending);
  `q`/`Esc` return to the index.
- Returning to the index restores the pane selection to the post just read
  (slug handed over via sessionStorage).
- Pages carry Pagefind body/meta attributes so the content index is built
  from them.

## 9. Routing

- `/` - the three-pane app (single Svelte island).
- `/posts/<slug>/` - static post pages; canonical, deep-linkable, indexable.
- Browser back/forward work natively (MPA navigation). The prototype's
  `#post-id` hash routing is retired; its deep-link role is replaced by the
  real post URLs.

## 10. Status bar

Left region: `jless-blog.json` logotype · `MODE: <NORMAL|PAGER>` ·
`PANE: <DATES|POSTS|METADATA>` (index only) · `SEARCH ACTIVE` (amber, when
confirmed matches exist) · `FILTER: <tag>` (green, when tag filter set) ·
contextual hint (`[Enter] Read Article` on a post node, otherwise
`[j/k] Navigate | [Tab] Switch Pane`).

Right region: pending key buffer (amber, e.g. `g`) · `Press ? for shortcuts
reference` · `focused-noether v<version>`.

The search console overlays the bar while open. All regions are rendered
from state; nothing is rebuilt imperatively.

## 11. Accessibility

- Tree containers: `role="tree"`; lines: `role="treeitem"` with
  `aria-selected`; child groups: `role="group"`; openers carry
  `aria-expanded`.
- Roving focus: selected line is focused (`tabindex="-1"`); panes cycle via
  Tab interception.
- Search count region is `aria-live="polite"`. Help overlay is
  `role="dialog"` `aria-modal="true"` with focus trap and focus restore.
- All color pairs meet WCAG AA on their backgrounds at the sizes used.

## 12. Architecture (rewrite)

| Concern              | Choice                                                  |
|----------------------|---------------------------------------------------------|
| Framework            | Astro 6, static output                                  |
| Island               | Svelte 5 (runes) - the index app is the only island     |
| Language             | TypeScript, strict                                      |
| Content              | Astro content collections (glob loader, zod schema)     |
| Markdown             | Astro pipeline (remark/rehype), Shiki `one-dark-pro`    |
| Key handling         | explicit `event.key` router + mode guards (tinykeys was |
|                      | considered; its modifier semantics for shifted printable |
|                      | keys like `G`/`J`/`?` are ambiguous, and this UI depends |
|                      | on exactly those)                                        |
| Content search       | Pagefind, indexed post-build from `dist/`               |
| Tests                | Playwright e2e; Vitest for the tree model               |

Core state design: `treeModel.ts` flattens a JSON value into an immutable
`Line[]` (path, depth, kind, key, rendered value, parent path). Mutable
state is small and explicit: `collapsed: Set<path>`, `selection` per pane,
`activePane`, `query`, `matches`, `tagFilter`, `datesFilter`, `mode`.
`visibleLines` is *derived* from lines + collapsed set. This is the direct
answer to the prototype's bug class: there is no cached DOM to go stale, no
innerHTML rebuilds, no detached node references.

## 13. Deliberate changes from the prototype

1. Hash routing -> real per-post routes; `Enter` performs a page navigation
   instead of toggling a CSS overlay. Back button and deep links are native.
2. Reader body in the preview pane is fetched on demand instead of being
   embedded in the page payload.
3. Search additionally covers post content via Pagefind (prototype searched
   only the rendered tree, which never contained content).
4. Help overlay exists on the index only; post pages show key hints in the
   status bar instead.
5. Markdown is compiled and sanitized at build time; the hand-rolled
   runtime parser and its escaping rules are gone.
6. The metadata `version` is sourced from `package.json`.

## 14. Test plan

Playwright (against the production build):

- Navigation: j/k/G/gg movement; Tab pane cycling; w/b depth jumps.
- Folding: l expand, h collapse, h from leaf jumps to parent (prototype
  regression), Space toggle, c collapse-siblings.
- Reader: Enter opens the post page; q returns and selection is restored
  (prototype regression: navigation must still work after returning);
  [ / ] walk posts in order (prototype regression: was dead).
- Search: hidden tag found while collapsed (prototype regression), Enter
  reveals and selects, n cycles, indicator lit, Esc clears.
- Filter: f on a tag narrows the posts pane; Esc clears filter before
  search highlights.
- Deep link: /posts/<slug>/ renders content, pager keys scroll.

Vitest: treeModel flattening, visibility derivation, sibling/depth jump
target computation, search matching.
