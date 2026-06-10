<script lang="ts">
  import type { Line } from '../lib/treeModel';

  interface Props {
    paneId: string;
    title: string;
    lines: Line[];                 // visible lines only
    selectedIndex: number;
    active: boolean;
    collapsed: ReadonlySet<string>;
    matched: ReadonlySet<string>;  // matched line ids
    stripQuotes?: boolean;
    headerInfo?: string | null;    // e.g. "Line 3/120"
    headerBreadcrumbs?: string | null;
    onactivate: () => void;
    onselect: (index: number) => void;
    ontoggle: (line: Line) => void;
  }

  let {
    paneId, title, lines, selectedIndex, active, collapsed, matched,
    stripQuotes = false, headerInfo = null, headerBreadcrumbs = null,
    onactivate, onselect, ontoggle
  }: Props = $props();

  let contentEl: HTMLElement | undefined = $state();

  const q = (s: string) => (stripQuotes ? s : `"${s}"`);

  function valueClass(v: Line['value']): string {
    if (v === null) return 'json-null';
    if (typeof v === 'string') return 'json-string';
    return typeof v === 'number' ? 'json-number' : 'json-boolean';
  }

  function valueText(v: Line['value']): string {
    if (v === null) return 'null';
    if (typeof v === 'string') return q(v);
    return String(v);
  }

  // Keep the selected line in view and focused when it changes
  $effect(() => {
    void selectedIndex;
    void lines;
    const el = contentEl?.querySelector('.json-line.selected') as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      if (active) el.focus({ preventScroll: true });
    }
  });
</script>

<section
  class="pane"
  class:active-pane={active}
  id="{paneId}-pane"
  tabindex="-1"
  onclick={onactivate}
>
  <div class="pane-header" style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
    <span style="display: flex; align-items: center; gap: 8px; overflow: hidden; white-space: nowrap;">
      <span>{title}</span>
      {#if headerBreadcrumbs}
        <span style="color: #a0a8b6; font-weight: normal; font-size: 0.7rem; text-transform: none; letter-spacing: normal; overflow: hidden; text-overflow: ellipsis;">{headerBreadcrumbs}</span>
      {/if}
    </span>
    {#if headerInfo}
      <span style="flex-shrink: 0;">{headerInfo}</span>
    {/if}
  </div>
  <div class="pane-content" bind:this={contentEl}>
    <div class="json-viewer-body" role="tree" aria-label="{title} tree">
      {#each lines as line, i (line.id)}
        <div
          class="json-line"
          class:selected={i === selectedIndex}
          class:search-match={matched.has(line.id)}
          role="treeitem"
          aria-selected={i === selectedIndex}
          aria-expanded={line.kind === 'opening' ? !collapsed.has(line.path) : undefined}
          tabindex="-1"
          onclick={(e) => { e.stopPropagation(); onactivate(); onselect(i); }}
        ><span class="indent">{'  '.repeat(line.depth)}</span
        >{#if line.kind === 'opening'}<span
            class="toggle-icon"
            class:collapsed-icon={collapsed.has(line.path)}
            onclick={(e) => { e.stopPropagation(); onactivate(); onselect(i); ontoggle(line); }}
          >▼</span
          >{:else}<span class="toggle-spacer"> </span
          >{/if}{#if line.key !== null}<span class="json-key">{q(line.key)}</span
          >: {/if}{#if line.kind === 'leaf'}<span class="json-value {valueClass(line.value)}">{valueText(line.value)}</span
          >{#if !line.isLast}<span class="comma">,</span>{/if}{:else if line.kind === 'opening'}<span class="bracket">{line.bracket}</span
          >{#if collapsed.has(line.path)}{#if line.preview}&nbsp;<span class="json-key">{q(line.preview.keyName)}</span
            >: <span class="json-value json-string">{q(line.preview.title)}</span
            >, <span class="ellipsis-badge">...</span> <span class="bracket">{line.bracket === '{' ? '}' : ']'}</span
            >{:else}<span class="ellipsis-badge">...</span><span class="bracket">{line.bracket === '{' ? '}' : ']'}</span
            >{/if}{#if !line.isLast}<span class="comma">,</span>{/if}{/if}{:else}<span class="bracket">{line.bracket}</span
          >{#if !line.isLast}<span class="comma">,</span>{/if}{/if}</div>
      {/each}
    </div>
  </div>
</section>
