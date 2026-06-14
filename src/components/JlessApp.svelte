<script lang="ts">
  import { untrack } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import TreePane from './TreePane.svelte';

  import StatusBar from './StatusBar.svelte';
  import HelpOverlay from './HelpOverlay.svelte';
  import {
    flatten, visibleLines, revealPaths, lineText,
    depthJumpTarget, siblingJumpTarget, parentPath, breadcrumbs,
    type Line, type Json
  } from '../lib/treeModel';
  import { sortPosts, MONTH_NAMES, type PostIndexEntry, type DatesTree } from '../lib/site';

  interface Props {
    posts: PostIndexEntry[];
    datesTree: DatesTree;
    metadata: Json;
    version: string;
  }

  let { posts, datesTree, metadata, version }: Props = $props();

  type PaneId = 'dates' | 'posts' | 'metadata';
  const PANE_ORDER: PaneId[] = ['dates', 'posts', 'metadata'];
  const EMPTY_SET: ReadonlySet<string> = new Set();

  // ---------- state (the entire UI state; everything else is derived)
  let activePane = $state<PaneId>('posts');
  let selections = $state<Record<PaneId, number>>({ dates: 0, posts: 0, metadata: 0 });
  const collapsedSets: Record<PaneId, SvelteSet<string>> = {
    dates: new SvelteSet(),
    posts: new SvelteSet(),
    metadata: new SvelteSet()
  };
  let helpOpen = $state(false);
  let searchOpen = $state(false);
  let searchPane = $state<PaneId>('posts');
  let query = $state('');
  let confirmedIds = $state<string[]>([]);
  let matchIdx = $state(-1);
  let contentSlugs = $state<string[]>([]);
  let tagFilter = $state<string | null>(null);
  let datesFilter = $state<{ section?: string; year?: string; month?: string; slug?: string }>({});
  let keyBuffer = $state('');

  // ---------- post filtering (dates-pane selection + tag filter)
  const nonPinned = posts
    .filter((p) => !p.pinned)
    .sort((a, b) => b.date.localeCompare(a.date));

  const filteredPosts = $derived.by(() => {
    const f = datesFilter;
    let list: PostIndexEntry[];
    if (f.slug) list = posts.filter((p) => p.slug === f.slug);
    else if (f.section === 'pinned') list = posts.filter((p) => p.pinned);
    else if (f.section === 'recent') list = nonPinned.slice(0, 10);
    else if (f.section === 'years')
      list = nonPinned.filter(
        (p) =>
          (!f.year || p.date.startsWith(f.year + '-')) &&
          (!f.month || p.date.slice(5, 7) === f.month)
      );
    else list = sortPosts(posts);
    if (tagFilter) list = list.filter((p) => p.tags.includes(tagFilter!));
    return list;
  });

  // ---------- tree lines per pane
  const postsLines = $derived(
    flatten(
      'posts',
      filteredPosts.map((p) => ({
        title: p.title,
        date: p.date,
        author: p.author,
        tags: p.tags,
        summary: p.summary,
        slug: p.slug
      })) as unknown as Json,
      {
        postSlugOf: (o) =>
          typeof o.slug === 'string' && typeof o.title === 'string' ? o.slug : undefined
      }
    )
  );
  const datesLines = flatten('dates', datesTree as unknown as Json, { stripQuotes: true });
  const metaLines = flatten('metadata', metadata, {});

  // Years start collapsed in the dates pane
  for (const l of datesLines) {
    if (l.kind === 'opening' && /^root\.years\.\d{4}$/.test(l.path)) {
      collapsedSets.dates.add(l.path);
    }
  }

  const visDates = $derived(visibleLines(datesLines, collapsedSets.dates));
  const visPosts = $derived(visibleLines(postsLines, collapsedSets.posts));
  const visMeta = $derived(visibleLines(metaLines, collapsedSets.metadata));

  function allLines(pane: PaneId): Line[] {
    return pane === 'dates' ? datesLines : pane === 'posts' ? postsLines : metaLines;
  }
  function vis(pane: PaneId): Line[] {
    return pane === 'dates' ? visDates : pane === 'posts' ? visPosts : visMeta;
  }

  // Posts pane: whenever its contents change, post nodes start collapsed and
  // the selection resets (restoring the last-read post once, on first load)
  let restoredOnce = false;
  $effect(() => {
    const lines = postsLines;
    untrack(() => {
      collapsedSets.posts.clear();
      for (const l of lines) {
        if (l.postRoot) collapsedSets.posts.add(l.path);
      }
      let sel = 0;
      if (!restoredOnce) {
        restoredOnce = true;
        const last = sessionStorage.getItem('jless:lastPost');
        if (last) {
          sessionStorage.removeItem('jless:lastPost');
          const v = visibleLines(lines, collapsedSets.posts);
          const idx = v.findIndex((l) => l.postRoot && l.postSlug === last);
          if (idx !== -1) sel = idx;
        }
      }
      selections.posts = sel;
    });
  });

  // Dates pane selection drives the posts filter
  $effect(() => {
    const line = visDates[selections.dates];
    untrack(() => {
      const f: typeof datesFilter = {};
      if (line) {
        const parts = line.path.split('.');
        if (parts[1] === 'pinned' || parts[1] === 'recent') {
          f.section = parts[1];
          if (line.kind === 'leaf' && typeof line.value === 'string') f.slug = line.value;
        } else if (parts[1] === 'years') {
          f.section = 'years';
          if (parts[2]) f.year = parts[2];
          if (parts[3]) {
            const mi = MONTH_NAMES.indexOf(parts[3]);
            if (mi !== -1) f.month = String(mi + 1).padStart(2, '0');
          }
        }
      }
      if (JSON.stringify(f) !== JSON.stringify(datesFilter)) datesFilter = f;
    });
  });

  // ---------- reader preview (follows the posts-pane selection)
  const selectedPostSlug = $derived(visPosts[selections.posts]?.postSlug ?? null);
  const previewPost = $derived(
    selectedPostSlug ? (posts.find((p) => p.slug === selectedPostSlug) ?? null) : null
  );

  let previewHtml = $state<string | null>(null);
  let previewLoading = $state(false);
  const htmlCache = new Map<string, string>();

  $effect(() => {
    const slug = selectedPostSlug;
    if (!slug) {
      previewHtml = null;
      previewLoading = false;
      return;
    }
    const cached = htmlCache.get(slug);
    if (cached !== undefined) {
      previewHtml = cached;
      previewLoading = false;
      return;
    }
    previewHtml = null;
    previewLoading = true;
    fetch(`/posts/${slug}/`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((text) => {
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const body = doc.querySelector('.reader-body');
        const html = body ? body.innerHTML : '';
        htmlCache.set(slug, html);
        if (untrack(() => selectedPostSlug) === slug) {
          previewHtml = html;
          previewLoading = false;
        }
      })
      .catch(() => {
        if (untrack(() => selectedPostSlug) === slug) {
          previewHtml = null;
          previewLoading = false;
        }
      });
  });

  // ---------- search
  const liveMatchIds = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!searchOpen || q.length < 2) return [];
    const strip = activePane === 'dates';
    return allLines(activePane)
      .filter((l) => lineText(l, strip).toLowerCase().includes(q))
      .map((l) => l.id);
  });

  function openingIdOf(slug: string): string | null {
    const line = postsLines.find((l) => l.postRoot && l.postSlug === slug);
    return line ? line.id : null;
  }

  // Content (Pagefind) hits for posts not already matched on any tree line
  const contentOnlyIds = $derived.by(() => {
    if (activePane !== 'posts' || !searchOpen) return [];
    const live = new Set(liveMatchIds);
    const matchedSlugs = new Set(
      postsLines.filter((l) => live.has(l.id) && l.postSlug).map((l) => l.postSlug)
    );
    const ids: string[] = [];
    for (const slug of contentSlugs) {
      if (matchedSlugs.has(slug)) continue;
      const id = openingIdOf(slug);
      if (id && !ids.includes(id)) ids.push(id);
    }
    return ids;
  });

  const matchedSet = $derived(
    searchOpen ? new Set([...liveMatchIds, ...contentOnlyIds]) : new Set(confirmedIds)
  );

  const matchCountText = $derived.by(() => {
    if (!searchOpen || query.trim().length < 2) return '';
    const n = liveMatchIds.length;
    const c = contentOnlyIds.length;
    let text = `${n} match${n === 1 ? '' : 'es'}`;
    if (c > 0) text += ` · ${c} content`;
    return text;
  });

  const searchActive = $derived(
    confirmedIds.length > 0 || (searchOpen && liveMatchIds.length > 0)
  );

  // Pagefind: full-content search, present only in production builds
  let pagefindMod: { search: (q: string) => Promise<{ results: { data: () => Promise<{ url: string }> }[] }> } | null = null;
  let pagefindTried = false;
  let pfTimer: ReturnType<typeof setTimeout> | undefined;

  async function getPagefind() {
    if (!pagefindTried) {
      pagefindTried = true;
      try {
        // Built post-build by the pagefind CLI; absent in dev. The indirection
        // keeps the bundler from trying to resolve it at build time.
        const url = '/pagefind/pagefind.js';
        pagefindMod = await import(/* @vite-ignore */ url);
      } catch {
        pagefindMod = null;
      }
    }
    return pagefindMod;
  }

  $effect(() => {
    const q = query.trim();
    const wanted = searchOpen && activePane === 'posts' && q.length >= 2;
    untrack(() => {
      clearTimeout(pfTimer);
      if (!wanted) {
        if (contentSlugs.length) contentSlugs = [];
        return;
      }
      pfTimer = setTimeout(async () => {
        const pf = await getPagefind();
        if (!pf) return;
        try {
          const res = await pf.search(q);
          const slugs: string[] = [];
          for (const r of res.results.slice(0, 20)) {
            const d = await r.data();
            const m = String(d.url).match(/\/posts\/([^/]+)\//);
            if (m) slugs.push(m[1]);
          }
          contentSlugs = slugs;
        } catch {
          contentSlugs = [];
        }
      }, 150);
    });
  });

  function gotoMatch(id: string) {
    const pane = searchPane;
    const line = allLines(pane).find((l) => l.id === id);
    if (!line) return;
    const col = collapsedSets[pane];
    for (const p of revealPaths(line, col)) col.delete(p);
    const idx = vis(pane).findIndex((l) => l.id === id);
    if (idx !== -1) selections[pane] = idx;
  }

  function confirmSearch() {
    const ids = [...liveMatchIds, ...contentOnlyIds];
    searchOpen = false;
    confirmedIds = ids;
    matchIdx = -1;
    if (ids.length > 0) {
      matchIdx = 0;
      gotoMatch(ids[0]);
    }
  }

  function cancelSearch() {
    searchOpen = false;
    query = '';
    confirmedIds = [];
    matchIdx = -1;
    contentSlugs = [];
    refocusSelected();
  }

  function clearSearch() {
    confirmedIds = [];
    matchIdx = -1;
    contentSlugs = [];
    query = '';
  }

  function cycleMatch(dir: 1 | -1) {
    if (confirmedIds.length === 0) return;
    matchIdx = (matchIdx + dir + confirmedIds.length) % confirmedIds.length;
    gotoMatch(confirmedIds[matchIdx]);
  }

  // ---------- navigation primitives
  function clampIdx(i: number, len: number): number {
    return Math.max(0, Math.min(i, len - 1));
  }

  function currentLine(): Line | undefined {
    return vis(activePane)[selections[activePane]];
  }

  function move(delta: number) {
    const v = vis(activePane);
    if (v.length === 0) return;
    selections[activePane] = clampIdx(selections[activePane] + delta, v.length);
  }

  function selectId(pane: PaneId, id: string) {
    const idx = vis(pane).findIndex((l) => l.id === id);
    if (idx !== -1) selections[pane] = idx;
  }

  function reclamp(pane: PaneId) {
    selections[pane] = clampIdx(selections[pane], Math.max(1, vis(pane).length));
  }

  function toggleFoldLine(pane: PaneId, line: Line) {
    if (line.kind !== 'opening') return;
    const col = collapsedSets[pane];
    if (col.has(line.path)) col.delete(line.path);
    else col.add(line.path);
    reclamp(pane);
  }

  function collapseKey() {
    const line = currentLine();
    if (!line) return;
    const col = collapsedSets[activePane];
    if (line.kind === 'opening' && !col.has(line.path)) {
      col.add(line.path);
      reclamp(activePane);
      return;
    }
    if (line.kind === 'closing') {
      selectId(activePane, `${line.path}:opening`);
      return;
    }
    const parent = parentPath(line.path);
    if (parent) selectId(activePane, `${parent}:opening`);
  }

  function expandKey() {
    const line = currentLine();
    if (!line || line.kind !== 'opening') return;
    const col = collapsedSets[activePane];
    if (col.has(line.path)) col.delete(line.path);
    else move(1);
  }

  function collapseSiblings() {
    const line = currentLine();
    if (!line) return;
    const col = collapsedSets[activePane];
    const parent = parentPath(line.path);
    for (const l of allLines(activePane)) {
      if (l.kind === 'opening' && parentPath(l.path) === parent) col.add(l.path);
    }
    const idx = vis(activePane).findIndex((l) => l.id === `${line.path}:opening`);
    selections[activePane] = idx !== -1 ? idx : clampIdx(selections[activePane], Math.max(1, vis(activePane).length));
  }

  function cyclePane(dir: 1 | -1) {
    const i = PANE_ORDER.indexOf(activePane);
    activePane = PANE_ORDER[(i + dir + PANE_ORDER.length) % PANE_ORDER.length];
  }

  function openPost() {
    const line = currentLine();
    if (activePane === 'posts' && line?.postSlug) {
      window.location.href = `/posts/${line.postSlug}/`;
    }
  }

  function enterKey() {
    const line = currentLine();
    if (activePane === 'posts' && line?.postSlug) {
      openPost();
      return;
    }
    if (line) toggleFoldLine(activePane, line);
  }

  function filterKey() {
    const line = currentLine();
    if (line?.kind === 'leaf' && typeof line.value === 'string') {
      tagFilter = line.value;
    }
  }

  function escapeKey() {
    if (tagFilter) tagFilter = null;
    else clearSearch();
  }

  function refocusSelected() {
    requestAnimationFrame(() => {
      const el = document.querySelector(`#${activePane}-pane .json-line.selected`) as HTMLElement | null;
      el?.focus({ preventScroll: true });
    });
  }

  // ---------- key router (explicit event.key switch; mode-guarded)
  let gTimer: ReturnType<typeof setTimeout> | undefined;

  function onKeydown(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (helpOpen) return; // the overlay handles its own keys

    const el = document.activeElement as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
      return; // the search input handles Enter/Escape itself
    }

    const k = e.key;
    const pendingG = keyBuffer === 'g';
    if (k !== 'g' && pendingG) {
      keyBuffer = '';
      clearTimeout(gTimer);
    }

    let handled = true;
    if (k === 'j' || k === 'ArrowDown') move(1);
    else if (k === 'k' || k === 'ArrowUp') move(-1);
    else if (k === 'J') selections[activePane] = siblingJumpTarget(vis(activePane), selections[activePane], 1);
    else if (k === 'K') selections[activePane] = siblingJumpTarget(vis(activePane), selections[activePane], -1);
    else if (k === 'w') selections[activePane] = depthJumpTarget(vis(activePane), selections[activePane], 1);
    else if (k === 'b') selections[activePane] = depthJumpTarget(vis(activePane), selections[activePane], -1);
    else if (k === 'g') {
      if (pendingG) {
        keyBuffer = '';
        clearTimeout(gTimer);
        selections[activePane] = 0;
      } else {
        keyBuffer = 'g';
        clearTimeout(gTimer);
        gTimer = setTimeout(() => (keyBuffer = ''), 500);
      }
    } else if (k === 'G') selections[activePane] = Math.max(0, vis(activePane).length - 1);
    else if (k === 'h' || k === 'ArrowLeft') collapseKey();
    else if (k === 'l' || k === 'ArrowRight') expandKey();
    else if (k === ' ') { const line = currentLine(); if (line) toggleFoldLine(activePane, line); }
    else if (k === 'c') collapseSiblings();
    else if (k === 'Tab') cyclePane(e.shiftKey ? -1 : 1);
    else if (k === 'Enter') enterKey();
    else if (k === 'o') openPost();
    else if (k === 'f') filterKey();
    else if (k === '/') { searchPane = activePane; query = ''; searchOpen = true; }
    else if (k === 'n') cycleMatch(1);
    else if (k === 'N') cycleMatch(-1);
    else if (k === '?') helpOpen = true;
    else if (k === 'Escape') escapeKey();
    else handled = false;

    if (handled) e.preventDefault();
  }

  // ---------- status bar derivations
  const hintReadable = $derived(activePane === 'posts' && !!visPosts[selections.posts]?.postSlug);
  const crumbs = $derived.by(() => {
    const line = vis(activePane)[selections[activePane]];
    return line ? `${activePane.toUpperCase()} > ${breadcrumbs(line.path)}` : '';
  });
  const lineInfo = $derived(
    `Line ${visPosts.length ? selections.posts + 1 : 0}/${visPosts.length}`
  );

  function matchedFor(pane: PaneId): ReadonlySet<string> {
    return (searchOpen ? activePane : searchPane) === pane ? (matchedSet as Set<string>) : EMPTY_SET;
  }
</script>

<svelte:window onkeydown={onKeydown} />

<main class="app-body">
  <TreePane
    paneId="dates"
    title="Dates"
    lines={visDates}
    selectedIndex={selections.dates}
    active={activePane === 'dates'}
    collapsed={collapsedSets.dates}
    matched={matchedFor('dates')}
    stripQuotes
    onactivate={() => (activePane = 'dates')}
    onselect={(i) => (selections.dates = i)}
    ontoggle={(l) => toggleFoldLine('dates', l)}
  />

  <TreePane
    paneId="posts"
    title="database.json"
    lines={visPosts}
    selectedIndex={selections.posts}
    active={activePane === 'posts'}
    collapsed={collapsedSets.posts}
    matched={matchedFor('posts')}
    headerBreadcrumbs={crumbs}
    headerInfo={lineInfo}
    onactivate={() => (activePane = 'posts')}
    onselect={(i) => (selections.posts = i)}
    ontoggle={(l) => toggleFoldLine('posts', l)}
  />

  <TreePane
    paneId="metadata"
    title="Metadata"
    lines={visMeta}
    selectedIndex={selections.metadata}
    active={activePane === 'metadata'}
    collapsed={collapsedSets.metadata}
    matched={matchedFor('metadata')}
    onactivate={() => (activePane = 'metadata')}
    onselect={(i) => (selections.metadata = i)}
    ontoggle={(l) => toggleFoldLine('metadata', l)}
  />
</main>

<StatusBar
  pane={activePane}
  {searchActive}
  filterTag={tagFilter}
  {hintReadable}
  {keyBuffer}
  {version}
  {searchOpen}
  {query}
  {matchCountText}
  onquery={(q) => (query = q)}
  onconfirm={confirmSearch}
  oncancel={cancelSearch}
/>

{#if helpOpen}
  <HelpOverlay
    onclose={() => {
      helpOpen = false;
      refocusSelected();
    }}
  />
{/if}
