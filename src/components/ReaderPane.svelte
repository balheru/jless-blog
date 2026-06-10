<script lang="ts">
  import type { PostIndexEntry } from '../lib/site';

  interface Props {
    post: PostIndexEntry | null;
    bodyHtml: string | null;
    loading: boolean;
  }

  let { post, bodyHtml, loading }: Props = $props();
</script>

<section class="pane" id="reader-pane">
  <div class="pane-header">
    {post ? `Reader: ${post.title}` : 'Reader: No post selected'}
  </div>
  <div class="pane-content">
    {#if post}
      <article class="reader-post">
        <h1>{post.title}</h1>
        <div class="reader-meta">
          <span><span class="reader-meta-label">Author:</span> {post.author}</span>
          <span><span class="reader-meta-label">Date:</span> {post.date}</span>
          <span><span class="reader-meta-label">Tags:</span>
            {#each post.tags as tag}
              <span class="reader-tag">{tag}</span>{' '}
            {/each}
          </span>
        </div>
        {#if bodyHtml}
          <!-- Build-produced HTML from our own markdown pipeline -->
          <div class="reader-body">{@html bodyHtml}</div>
        {:else if loading}
          <p style="color: var(--fg-dim);">loading…</p>
        {:else}
          <p>{post.summary}</p>
        {/if}
      </article>
    {:else}
      <div class="reader-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        <h2>jless-blog reader</h2>
        <p>Navigate the JSON database in the posts pane. Select any key inside a post object and press Enter to read the post.</p>
      </div>
    {/if}
  </div>
</section>
