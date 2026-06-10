<script lang="ts">
  interface Props {
    onclose: () => void;
  }

  let { onclose }: Props = $props();

  let closeBtn: HTMLButtonElement | undefined = $state();

  $effect(() => {
    closeBtn?.focus();
  });

  function onkeydown(e: KeyboardEvent) {
    if (['Escape', 'q', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      onclose();
    } else if (e.key === 'Tab') {
      // single focusable element: keep focus on the close button
      e.preventDefault();
      closeBtn?.focus();
    }
  }

  const sections: { title: string; color: string; rows: [string, string][] }[] = [
    {
      title: '[ MOVEMENT ]',
      color: 'var(--accent)',
      rows: [
        ['j / ↓', 'Move highlight down one line'],
        ['k / ↑', 'Move highlight up one line'],
        ['J', 'Jump to next sibling at same level'],
        ['K', 'Jump to previous sibling at same level'],
        ['w', 'Jump forward to next change in depth'],
        ['b', 'Jump backward to next change in depth'],
        ['g g', 'Jump to first visible line'],
        ['G', 'Jump to last visible line']
      ]
    },
    {
      title: '[ TREE FOLDING ]',
      color: 'var(--search)',
      rows: [
        ['Space', 'Toggle collapse/expansion of current node'],
        ['h / ←', 'Collapse node, or jump to parent opening brace'],
        ['l / →', 'Expand node, or jump to first child node'],
        ['c', 'Collapse focused node and all its siblings']
      ]
    },
    {
      title: '[ ARTICLE READER ]',
      color: 'var(--string)',
      rows: [
        ['Enter / o', 'Open the article page (when on a post)'],
        ['q / Esc', 'Close article page and return to the browser'],
        ['j / k', 'Scroll article down/up line-by-line (Pager Mode)'],
        ['Space / PgDn', 'Scroll article down by page (Pager Mode)'],
        ['[ / ]', 'Previous / next article (Pager Mode)']
      ]
    },
    {
      title: '[ SEARCH & FILTER ]',
      color: 'var(--purple)',
      rows: [
        ['/', 'Enter search console mode'],
        ['n / N', 'Jump to next/previous search query match'],
        ['f', 'Filter posts by highlighted string value (e.g. tag)']
      ]
    },
    {
      title: '[ GENERAL ]',
      color: 'var(--cyan)',
      rows: [
        ['Tab / Shift+Tab', 'Cycle active focus pane (Dates ⇄ Posts ⇄ Metadata)'],
        ['?', 'Toggle this keyboard reference guide'],
        ['Esc', 'Clear search/filter highlights or exit search mode']
      ]
    }
  ];
</script>

<svelte:window onkeydown={onkeydown} />

<div
  class="help-overlay"
  role="dialog"
  aria-modal="true"
  aria-labelledby="help-title"
  onclick={(e) => { if (e.target === e.currentTarget) onclose(); }}
>
  <div class="help-box">
    <button class="help-close-btn" bind:this={closeBtn} aria-label="Close help menu" onclick={onclose}>&times;</button>
    <div class="help-title" id="help-title">VIM KEYBOARD SHORTCUTS</div>
    <div class="help-grid">
      {#each sections as section}
        <div class="help-group-title" style="color: {section.color};">{section.title}</div>
        {#each section.rows as [keys, desc]}
          <div class="help-key">
            {#each keys.split(' / ') as part, i}
              {#if i > 0}<span> / </span>{/if}
              {#each part.split(' ') as k, j}
                {#if j > 0}{' '}{/if}<kbd>{k}</kbd>
              {/each}
            {/each}
          </div>
          <div class="help-desc">{desc}</div>
        {/each}
      {/each}
    </div>
    <div class="help-footer">Press q, Esc or click outside to close</div>
  </div>
</div>
