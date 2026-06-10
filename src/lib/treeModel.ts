/**
 * Tree model: flattens a JSON value into an immutable list of lines, and
 * derives visibility purely from the set of collapsed node paths. There is
 * deliberately no DOM involvement anywhere in this module — the prototype's
 * navigation bugs all came from deriving visibility from layout.
 */

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type LineKind = 'opening' | 'leaf' | 'closing';

export interface Line {
  /** Unique within a pane: `${path}:${kind}` */
  id: string;
  kind: LineKind;
  /** Dot path of the node this line belongs to, starting with 'root'. */
  path: string;
  /** Paths of ancestor container nodes (excluding this node's own path). */
  ancestors: string[];
  depth: number;
  key: string | null;
  /** Leaf only. */
  value?: string | number | boolean | null;
  /** Opening/closing only. */
  bracket?: '{' | '[' | '}' | ']';
  /** Opening only: title/name shown in the collapsed preview. */
  preview?: { keyName: string; title: string } | null;
  /** Whether this node is the last sibling (controls the trailing comma). */
  isLast: boolean;
  /** Nearest ancestor-or-self node that is a post; its slug. */
  postSlug?: string;
  /** True on the opening line of a post node itself. */
  postRoot?: boolean;
}

export interface FlattenOptions {
  /** Render keys and string values without quotes (dates pane). */
  stripQuotes?: boolean;
  /** Returns a post slug when the object represents a post node. */
  postSlugOf?: (obj: Record<string, Json>) => string | undefined;
}

const POST_KEY_ORDER = ['title', 'date', 'author', 'tags', 'summary', 'slug'];

import { MONTH_NAMES } from './site';

/** Prototype-faithful key ordering, with chronological month names. */
function orderEntries(obj: Record<string, Json>, isPost: boolean): [string, Json][] {
  const entries = Object.entries(obj);
  entries.sort(([a], [b]) => {
    if (isPost) {
      const ia = POST_KEY_ORDER.indexOf(a);
      const ib = POST_KEY_ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    }
    for (const first of ['ALL', 'posts', 'pinned']) {
      if (a === first) return -1;
      if (b === first) return 1;
    }
    if (/^\d{4}$/.test(a) && /^\d{4}$/.test(b)) return Number(b) - Number(a);
    const ma = MONTH_NAMES.indexOf(a);
    const mb = MONTH_NAMES.indexOf(b);
    if (ma !== -1 && mb !== -1) return mb - ma;
    return a.localeCompare(b);
  });
  return entries;
}

export function flatten(rootKey: string | null, value: Json, opts: FlattenOptions = {}): Line[] {
  const lines: Line[] = [];

  function walk(
    key: string | null,
    val: Json,
    path: string,
    ancestors: string[],
    depth: number,
    isLast: boolean,
    postSlug: string | undefined
  ): void {
    const isObj = val !== null && typeof val === 'object' && !Array.isArray(val);
    const isArr = Array.isArray(val);

    if (isObj || isArr) {
      const obj = isObj ? (val as Record<string, Json>) : null;
      const ownSlug = obj ? opts.postSlugOf?.(obj) : undefined;
      const slug = ownSlug ?? postSlug;

      let preview: Line['preview'] = null;
      if (obj && (typeof obj.title === 'string' || typeof obj.name === 'string')) {
        const keyName = typeof obj.title === 'string' ? 'title' : 'name';
        preview = { keyName, title: String(obj[keyName]) };
      }

      lines.push({
        id: `${path}:opening`,
        kind: 'opening',
        path,
        ancestors,
        depth,
        key,
        bracket: isObj ? '{' : '[',
        preview,
        isLast,
        postSlug: slug,
        postRoot: ownSlug !== undefined || undefined
      });

      const childAncestors = [...ancestors, path];
      const entries: [string | null, Json][] = isObj
        ? orderEntries(val as Record<string, Json>, ownSlug !== undefined)
        : (val as Json[]).map((v, i) => [String(i), v] as [string, Json]);

      entries.forEach(([k, v], i) => {
        const childKey = isObj ? k : null;
        walk(childKey, v, `${path}.${k}`, childAncestors, depth + 1, i === entries.length - 1, slug);
      });

      lines.push({
        id: `${path}:closing`,
        kind: 'closing',
        path,
        ancestors,
        depth,
        key: null,
        bracket: isObj ? '}' : ']',
        isLast,
        postSlug: slug
      });
    } else {
      lines.push({
        id: `${path}:leaf`,
        kind: 'leaf',
        path,
        ancestors,
        depth,
        key,
        value: val as Line['value'],
        isLast,
        postSlug
      });
    }
  }

  walk(rootKey, value, 'root', [], 0, true, undefined);
  return lines;
}

/** A line is visible iff no ancestor node is collapsed; closing lines also
 *  require their own node to be expanded. Pane display state is irrelevant. */
export function isVisible(line: Line, collapsed: ReadonlySet<string>): boolean {
  if (line.kind === 'closing' && collapsed.has(line.path)) return false;
  for (const a of line.ancestors) {
    if (collapsed.has(a)) return false;
  }
  return true;
}

export function visibleLines(lines: readonly Line[], collapsed: ReadonlySet<string>): Line[] {
  return lines.filter((l) => isVisible(l, collapsed));
}

/** Paths whose collapse would currently hide this line; expanding them all
 *  reveals it. The line's own node is excluded for opening lines. */
export function revealPaths(line: Line, collapsed: ReadonlySet<string>): string[] {
  const paths = line.ancestors.filter((a) => collapsed.has(a));
  if (line.kind === 'closing' && collapsed.has(line.path)) paths.push(line.path);
  return paths;
}

/** Searchable text of a line, mirroring what is rendered (sans preview, so a
 *  collapsed parent and its child never double-match on the same text). */
export function lineText(line: Line, stripQuotes = false): string {
  const q = (s: string) => (stripQuotes ? s : `"${s}"`);
  const key = line.key !== null ? `${q(line.key)}: ` : '';
  if (line.kind === 'leaf') {
    const v =
      typeof line.value === 'string' ? q(line.value) : String(line.value);
    return `${key}${v}`;
  }
  return `${key}${line.bracket ?? ''}`;
}

/** Index of the next/previous visible line at a different depth (w / b). */
export function depthJumpTarget(visible: readonly Line[], from: number, dir: 1 | -1): number {
  const start = visible[from];
  if (!start) return from;
  for (let i = from + dir; i >= 0 && i < visible.length; i += dir) {
    if (visible[i].depth !== start.depth) return i;
  }
  return from;
}

/** Index of the opening/leaf line of the next/previous sibling node (J / K). */
export function siblingJumpTarget(visible: readonly Line[], from: number, dir: 1 | -1): number {
  const start = visible[from];
  if (!start) return from;
  const parent = parentPath(start.path);
  for (let i = from + dir; i >= 0 && i < visible.length; i += dir) {
    const l = visible[i];
    if (l.kind === 'closing') continue;
    if (l.depth < start.depth) break;
    if (l.depth === start.depth && parentPath(l.path) === parent && l.path !== start.path) {
      return i;
    }
  }
  return from;
}

export function parentPath(path: string): string | null {
  const i = path.lastIndexOf('.');
  return i === -1 ? null : path.slice(0, i);
}

/** Human-readable breadcrumbs: `posts[3] > tags`. */
export function breadcrumbs(path: string): string {
  const parts = path.split('.');
  const out: string[] = [];
  for (const part of parts) {
    if (part === 'root') continue;
    if (/^\d+$/.test(part)) {
      if (out.length > 0) out[out.length - 1] += `[${part}]`;
      else out.push(`[${part}]`);
    } else {
      out.push(part);
    }
  }
  return out.join(' > ');
}
