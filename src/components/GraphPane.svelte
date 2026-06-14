<script lang="ts">
  import { onMount } from 'svelte';
  import type { PostIndexEntry } from '../lib/site';

  interface Props {
    posts: PostIndexEntry[];
    activePostSlug: string | null;
    active: boolean;
    onselectpost: (slug: string) => void;
    onselecttag: (tag: string) => void;
    onactivate: () => void;
  }

  let { posts, activePostSlug, active, onselectpost, onselecttag, onactivate }: Props = $props();

  const R_max = 350;

  // Graph elements
  interface Node {
    id: string;
    type: 'post' | 'tag';
    label: string;
    slug?: string;
    tag?: string;
  }

  interface Link {
    source: string;
    target: string;
  }

  // Animation state (tweens/springs computed in requestAnimationFrame)
  interface Point3D {
    x: number;
    y: number;
    z: number;
  }

  let nodes = $state<Node[]>([]);
  let links = $state<Link[]>([]);
  
  // Base coordinates that interpolate towards target coordinates
  let currentCoords = $state<Record<string, Point3D>>({});
  let targetCoords: Record<string, Point3D> = {};

  // Projected 3D coordinates after rotation (updated on every frame)
  let renderCoords = $state<Record<string, Point3D & { depthScale: number; opacity: number }>>({});

  let containerWidth = $state(200);
  let containerHeight = $state(200);
  let container: HTMLDivElement;

  // Rotation angles
  let theta = 0; // rotation around Y
  const phi = 0.35; // slight tilt on X (3D tilt)

  // Re-build the graph nodes and links whenever posts change
  $effect(() => {
    const newNodes: Node[] = [];
    const newLinks: Link[] = [];
    const uniqueTags = new Set<string>();

    for (const p of posts) {
      newNodes.push({ id: `post:${p.slug}`, type: 'post', label: p.title, slug: p.slug });
      for (const t of p.tags) {
        uniqueTags.add(t);
        newLinks.push({ source: `post:${p.slug}`, target: `tag:${t}` });
      }
    }

    for (const t of uniqueTags) {
      newNodes.push({ id: `tag:${t}`, type: 'tag', label: t, tag: t });
    }

    nodes = newNodes;
    links = newLinks;
  });

  // Re-calculate target coordinates when active post changes
  $effect(() => {
    const slug = activePostSlug;
    if (nodes.length === 0) return;

    const targetId = slug ? `post:${slug}` : null;
    
    // Compute shortest path distance from active post to all nodes
    const dist: Record<string, number> = {};
    for (const n of nodes) dist[n.id] = 99; // infinity

    if (targetId && dist[targetId] !== undefined) {
      dist[targetId] = 0;
      
      // Simple BFS to find distances
      const queue = [targetId];
      let head = 0;
      while (head < queue.length) {
        const curr = queue[head++];
        const currDist = dist[curr];
        
        // Find neighbors
        for (const link of links) {
          if (link.source === curr && dist[link.target] === 99) {
            dist[link.target] = currDist + 1;
            queue.push(link.target);
          } else if (link.target === curr && dist[link.source] === 99) {
            dist[link.source] = currDist + 1;
            queue.push(link.source);
          }
        }
      }
    }

    // Group nodes by distance
    const groups: Record<number, string[]> = {};
    for (const n of nodes) {
      const d = dist[n.id];
      groups[d] ??= [];
      groups[d].push(n.id);
    }

    // Assign target spherical coordinates
    // We use Fibonacci sphere distribution for nodes on each shell
    const newTargetCoords: Record<string, Point3D> = {};

    for (const dStr of Object.keys(groups)) {
      const d = Number(dStr);
      const ids = groups[d];
      const N = ids.length;

      // Define shell radius based on non-Euclidean Poincaré-like expansion
      let R = 0;
      if (d === 1) R = 120;
      else if (d === 2) R = 210;
      else if (d === 3) R = 300;
      else if (d > 3) R = R_max;

      for (let i = 0; i < N; i++) {
        const id = ids[i];
        if (d === 0) {
          newTargetCoords[id] = { x: 0, y: 0, z: 0 };
        } else {
          // Fibonacci sphere distribution
          const p = Math.acos(1 - 2 * (i + 0.5) / N);
          const t = Math.PI * (1 + Math.sqrt(5)) * i;
          
          newTargetCoords[id] = {
            x: Math.sin(p) * Math.cos(t) * R,
            y: Math.sin(p) * Math.sin(t) * R,
            z: Math.cos(p) * R
          };
        }
      }
    }

    targetCoords = newTargetCoords;

    // Initialize current coords for any new nodes
    for (const n of nodes) {
      if (!currentCoords[n.id]) {
        currentCoords[n.id] = targetCoords[n.id] ? { ...targetCoords[n.id] } : { x: 0, y: 0, z: 0 };
      }
    }
  });

  onMount(() => {
    const updateSize = () => {
      if (container) {
        containerWidth = container.clientWidth;
        containerHeight = container.clientHeight;
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    let animId: number;
    const tick = () => {
      theta += 0.003; // rotate Y

      const nextCoords = { ...currentCoords };
      const nextRender: typeof renderCoords = {};

      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi);

      for (const n of nodes) {
        const id = n.id;
        const target = targetCoords[id] || { x: 0, y: 0, z: 0 };
        const curr = currentCoords[id] || { x: 0, y: 0, z: 0 };

        // Spring-like interpolation towards target base coords
        const nextPt = {
          x: curr.x + (target.x - curr.x) * 0.08,
          y: curr.y + (target.y - curr.y) * 0.08,
          z: curr.z + (target.z - curr.z) * 0.08
        };
        nextCoords[id] = nextPt;

        // 3D rotation projection
        // 1. Rotate Y (Y stays same, X and Z rotate)
        const x1 = nextPt.x * cosT - nextPt.z * sinT;
        const z1 = nextPt.x * sinT + nextPt.z * cosT;
        const y1 = nextPt.y;

        // 2. Tilt X
        const x2 = x1;
        const y2 = y1 * cosP - z1 * sinP;
        const z2 = y1 * sinP + z1 * cosP;

        // Depth cueing scaling
        const normZ = R_max > 0 ? z2 / R_max : 0;
        const depthScale = 1.0 + normZ * 0.75;
        const opacity = 0.1 + 0.9 * (normZ + 1.0) / 2;

        nextRender[id] = {
          x: x2,
          y: y2,
          z: z2,
          depthScale,
          opacity
        };
      }

      currentCoords = nextCoords;
      renderCoords = nextRender;

      animId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      window.removeEventListener('resize', updateSize);
      cancelAnimationFrame(animId);
    };
  });

  const centerOffsetX = $derived(containerWidth / 2);
  const centerOffsetY = $derived(containerHeight / 2);
</script>

<div
  id="graph-pane"
  bind:this={container}
  class="pane graph-viewer-pane"
  class:active-pane={active}
  role="button"
  tabindex="0"
  onclick={onactivate}
  onkeydown={(e) => e.key === 'Enter' && onactivate()}
>
  <div class="pane-header">Graph View</div>
  <div class="pane-content graph-content">
    <svg class="graph-svg">


      <!-- Links (edges) -->
      {#each links as link}
        {@const s = renderCoords[link.source]}
        {@const t = renderCoords[link.target]}
        {#if s && t}
          {@const avgZ = (s.z + t.z) / 2}
          {@const normZ = avgZ / R_max}
          {@const linkOpacity = 0.12 + 0.28 * (normZ + 1.0) / 2}
          <line
            x1={s.x + centerOffsetX}
            y1={s.y + centerOffsetY}
            x2={t.x + centerOffsetX}
            y2={t.y + centerOffsetY}
            stroke="var(--border-soft)"
            stroke-width={1 * ((s.depthScale + t.depthScale) / 2)}
            stroke-opacity={linkOpacity}
          />
        {/if}
      {/each}

      <!-- Nodes -->
      {#each nodes as node}
        {@const r = renderCoords[node.id]}
        {#if r}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <g
            class="graph-node"
            class:is-active-node={node.slug === activePostSlug}
            transform="translate({r.x + centerOffsetX}, {r.y + centerOffsetY})"
            opacity={r.opacity}
            onclick={(e) => {
              e.stopPropagation();
              onactivate();
              if (node.type === 'post' && node.slug) {
                onselectpost(node.slug);
              } else if (node.type === 'tag' && node.tag) {
                onselecttag(node.tag);
              }
            }}
          >
            {#if node.slug === activePostSlug}
              <circle
                r={15 * r.depthScale}
                fill="none"
                stroke="var(--search)"
                stroke-width="2"
                opacity="0.8"
              >
                <animate
                  attributeName="r"
                  values="{15 * r.depthScale};{24 * r.depthScale};{15 * r.depthScale}"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>
            {/if}

            <circle
              r={(node.slug === activePostSlug ? 12 : (node.type === 'post' ? 4.5 : 3)) * r.depthScale}
              fill={node.slug === activePostSlug
                ? '#ffffff'
                : node.type === 'post'
                  ? 'var(--accent)'
                  : 'var(--string)'}
              stroke={node.slug === activePostSlug ? 'var(--search)' : 'var(--bg)'}
              stroke-width={node.slug === activePostSlug ? 2.5 : 1.5}
            />

            <text
              x={6 * r.depthScale}
              y={3 * r.depthScale}
              fill="var(--fg-dim)"
              fill-opacity={r.opacity > 0.65 && node.slug !== activePostSlug ? 1 : 0}
              font-size="{Math.max(8, 9 * r.depthScale)}px"
              font-family="monospace"
              pointer-events="none"
              font-weight="normal"
            >
              {node.type === 'post' && node.label.length > 14
                ? node.label.slice(0, 12) + '..'
                : node.label}
            </text>
          </g>
        {/if}
      {/each}
    </svg>
  </div>
</div>

<style>
  .graph-viewer-pane {
    height: 100%;
    position: relative;
    user-select: none;
    cursor: default;
  }

  .graph-content {
    padding: 0;
    overflow: hidden;
    position: relative;
    width: 100%;
    height: 100%;
    background-color: var(--bg-deep);
  }

  .graph-svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .graph-node {
    cursor: pointer;
  }

  .graph-node circle {
    transition: r 0.1s ease;
  }

  .graph-node:hover circle {
    fill: #ffffff;
    stroke: var(--accent);
  }

  .graph-node:hover text {
    fill: #ffffff;
    font-weight: bold;
    display: block !important;
  }
</style>
