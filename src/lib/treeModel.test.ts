import { describe, expect, it } from 'vitest';
import {
  breadcrumbs,
  depthJumpTarget,
  flatten,
  isVisible,
  lineText,
  parentPath,
  revealPaths,
  siblingJumpTarget,
  visibleLines,
  type Json
} from './treeModel';

const SAMPLE: Json = {
  pinned: ['a', 'b'],
  meta: { title: 'Hello', count: 2, nested: { ok: true } }
};

describe('flatten', () => {
  it('produces opening/leaf/closing lines with paths and depths', () => {
    const lines = flatten('root-key', SAMPLE);
    expect(lines[0]).toMatchObject({ kind: 'opening', path: 'root', depth: 0, key: 'root-key' });
    expect(lines.at(-1)).toMatchObject({ kind: 'closing', path: 'root' });
    const leaf = lines.find((l) => l.path === 'root.pinned.0');
    expect(leaf).toMatchObject({ kind: 'leaf', value: 'a', depth: 2, key: null });
  });

  it('tracks ancestors for visibility', () => {
    const lines = flatten(null, SAMPLE);
    const deep = lines.find((l) => l.path === 'root.meta.nested.ok');
    expect(deep?.ancestors).toEqual(['root', 'root.meta', 'root.meta.nested']);
  });

  it('marks post roots and propagates slugs', () => {
    const lines = flatten('posts', [{ slug: 's1', title: 'T', tags: ['x'] }] as unknown as Json, {
      postSlugOf: (o) => (typeof o.slug === 'string' ? (o.slug as string) : undefined)
    });
    const postOpening = lines.find((l) => l.postRoot);
    expect(postOpening?.postSlug).toBe('s1');
    const tagLeaf = lines.find((l) => l.path === 'root.0.tags.0');
    expect(tagLeaf?.postSlug).toBe('s1');
  });
});

describe('visibility', () => {
  const lines = flatten(null, SAMPLE);

  it('hides descendants and closing lines of collapsed nodes', () => {
    const collapsed = new Set(['root.meta']);
    const metaOpening = lines.find((l) => l.id === 'root.meta:opening')!;
    const metaClosing = lines.find((l) => l.id === 'root.meta:closing')!;
    const child = lines.find((l) => l.id === 'root.meta.title:leaf')!;
    expect(isVisible(metaOpening, collapsed)).toBe(true);
    expect(isVisible(metaClosing, collapsed)).toBe(false);
    expect(isVisible(child, collapsed)).toBe(false);
  });

  it('is unaffected by anything but the collapsed set (no DOM, no panes)', () => {
    expect(visibleLines(lines, new Set()).length).toBe(lines.length);
  });

  it('revealPaths lists exactly the collapsed ancestors to expand', () => {
    const collapsed = new Set(['root.meta', 'root.meta.nested', 'root.pinned']);
    const deep = lines.find((l) => l.id === 'root.meta.nested.ok:leaf')!;
    expect(revealPaths(deep, collapsed).sort()).toEqual(['root.meta', 'root.meta.nested']);
  });
});

describe('navigation targets', () => {
  const lines = flatten(null, SAMPLE);
  const visible = visibleLines(lines, new Set());

  it('sibling jump moves between same-parent nodes', () => {
    const from = visible.findIndex((l) => l.id === 'root.pinned:opening');
    const to = siblingJumpTarget(visible, from, 1);
    expect(visible[to].id).toBe('root.meta:opening');
    expect(siblingJumpTarget(visible, to, -1)).toBe(from);
  });

  it('sibling jump stays put when there is no sibling', () => {
    const from = visible.findIndex((l) => l.id === 'root.meta.nested.ok:leaf');
    expect(siblingJumpTarget(visible, from, 1)).toBe(from);
  });

  it('depth jump finds the next line at a different depth', () => {
    const from = visible.findIndex((l) => l.id === 'root.pinned.0:leaf');
    const to = depthJumpTarget(visible, from, 1);
    expect(visible[to].depth).not.toBe(visible[from].depth);
  });
});

describe('text and paths', () => {
  it('lineText renders key/value pairs with optional quoting', () => {
    const lines = flatten(null, { tag: 'vim' });
    const leaf = lines.find((l) => l.kind === 'leaf')!;
    expect(lineText(leaf)).toBe('"tag": "vim"');
    expect(lineText(leaf, true)).toBe('tag: vim');
  });

  it('parentPath and breadcrumbs', () => {
    expect(parentPath('root.a.b')).toBe('root.a');
    expect(parentPath('root')).toBeNull();
    expect(breadcrumbs('root.0.tags.1')).toBe('[0] > tags[1]');
  });
});
