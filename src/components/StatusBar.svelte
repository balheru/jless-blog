<script lang="ts">
  interface Props {
    pane: string;
    searchActive: boolean;
    filterTag: string | null;
    hintReadable: boolean;     // selected line is inside a post node
    keyBuffer: string;
    version: string;
    searchOpen: boolean;
    query: string;
    matchCountText: string;
    onquery: (q: string) => void;
    onconfirm: () => void;
    oncancel: () => void;
  }

  let {
    pane, searchActive, filterTag, hintReadable, keyBuffer, version,
    searchOpen, query, matchCountText, onquery, onconfirm, oncancel
  }: Props = $props();

  let inputEl: HTMLInputElement | undefined = $state();

  $effect(() => {
    if (searchOpen) inputEl?.focus();
  });

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      // stopPropagation: confirming/cancelling unmounts this input and Svelte
      // flushes synchronously, so the still-bubbling event would otherwise be
      // re-handled by the window router in NORMAL mode (double-handling)
      e.preventDefault();
      e.stopPropagation();
      oncancel();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      onconfirm();
    }
  }
</script>

<footer class="app-footer">
  <div class="status-left">
    <span class="app-logo" style="margin-right: 16px;">jless-blog<span>.json</span></span>
    <span>MODE: NORMAL</span>
    <span class="status-pane-label">PANE: {pane.toUpperCase()}</span>
    {#if searchActive}
      <span class="status-search-indicator">SEARCH ACTIVE</span>
    {/if}
    {#if filterTag}
      <span class="status-filter-indicator">FILTER: {filterTag}</span>
    {/if}
    {#if hintReadable}
      <span class="status-hint-read">[Enter] Read Article</span>
    {:else}
      <span class="status-hint">[j/k] Navigate | [Tab] Switch Pane</span>
    {/if}
  </div>
  <div class="status-right">
    <span class="key-buffer">{keyBuffer}</span>
    <span style="color: var(--fg-dim);">Press <kbd>?</kbd> for shortcuts reference</span>
    <span>focused-noether v{version}</span>
  </div>

  {#if searchOpen}
    <div class="search-box">
      <span class="search-prompt">/</span>
      <input
        type="text"
        class="search-input"
        placeholder="Search keys/values... (e.g. physics, rust, symmetry)"
        autocomplete="off"
        aria-label="Search keys and values"
        bind:this={inputEl}
        value={query}
        oninput={(e) => onquery((e.target as HTMLInputElement).value)}
        onkeydown={onkeydown}
      />
      <span class="search-count" aria-live="polite">{matchCountText}</span>
    </div>
  {/if}
</footer>
