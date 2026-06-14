---
title: "testing"
date: "2026-06-13"
author: "focused_noether"
tags: ["daily"]
summary: "A test post generated using the Obsidian pipeline."
pinned: false
---

# testing

This is the introductory paragraph of the chunky test article. We are establishing a large content model to verify the vertical alignment of side-notes relative to their referencing paragraphs. Standard footnote references will be converted into dynamic side-notes positioned in the margins.

Here is the second paragraph of the introduction. It contains a right-hand sidenote[^1] at the end of this sentence. We want to check that it remains aligned with this paragraph.

## Section 1: Core Architecture

This is the first paragraph of Section 1. Sidenotes are absolutely positioned in the left or right margin depending on their prefix. This paragraph has a left-hand sidenote[^2] right here.

This is the second paragraph of Section 1. It provides background context on the layout system. It has a default right-hand sidenote[^3] here to test parallel positioning in different sections.

## Section 2: Stacking and Collisions

In this section, we test the vertical stacking of multiple sidenotes placed close to one another on the same side of the page. This sentence contains the first note[^4]. Immediately after it, we place another note[^5] to trigger the anti-collision algorithm. We also place a left sidenote[^6] in the same paragraph to test left-hand margin stacking.

This is the second paragraph of Section 2. We add a longer block of text here to separate the sections. This ensures that the next paragraph has its own layout coordinates. Sidenotes allow authors to place context inline without disrupting the narrative flow.

## Section 3: Navigation Model

This is the first paragraph of Section 3. Keyboard navigation remains active during article reading. The user can navigate using standard Vim keybindings.

This is the second paragraph of Section 3. We place a note here[^7] to test alignment at the third level.

## Section 4: Performance Targets

This is the first paragraph of Section 4. Svelte 5 provides fine-grained reactivity for UI updates. The graph view updates at 60 FPS.

This is the second paragraph of Section 4. We place a left-hand note[^8] here.

## Section 5: Metadata Schema

This is the first paragraph of Section 5. The content collection schema validates all frontmatter.

This is the second paragraph of Section 5. We place a right-hand note[^9] here.

## Section 6: Layout Columns

This is the first paragraph of Section 6. The layout is divided into a left column (Dates and Graph View) and a right column (Posts and Metadata).

This is the second paragraph of Section 6. We place a left-hand note[^10] here.

## Section 7: Keybindings Configuration

This is the first paragraph of Section 7. Pressing `?` toggles the help overlay.

This is the second paragraph of Section 7. We place a right-hand note[^11] here.

## Section 8: Search Indexing

This is the first paragraph of Section 8. Pagefind indexes all static HTML pages.

This is the second paragraph of Section 8. We place a left-hand note[^12] here.

## Section 9: Cloudflare Pages

This is the first paragraph of Section 9. The site is deployed to Cloudflare Pages.

This is the second paragraph of Section 9. We place a right-hand note[^13] here.

## Section 10: Git Branch Workflow

This is the first paragraph of Section 10. The workflow triggers deployments on push.

This is the second paragraph of Section 10. We place a left-hand note[^14] here.

## Section 11: Anti-Collision Loop

This is the first paragraph of Section 11. The collision loop executes on DOMContentLoaded, load, and window resize.

This is the second paragraph of Section 11. We place a right-hand note[^15] here.

## Section 12: Final Alignment Checks

This is the first paragraph of Section 12. We place a final right-hand note[^16] here.

This is the second paragraph of Section 12. This is the last sentence of the document.

[^1]: This is a default sidenote which will render on the right.
[^2]: L: This is a left sidenote explaining the vault pipeline.
[^3]: R: This is a right sidenote explaining the reader layout.
[^4]: R: First stacked note on the right side.
[^5]: R: Second stacked note on the right side, which should be pushed down.
[^6]: L: Left stacked note that sits in the left margin.
[^7]: R: Section 3 right-aligned note.
[^8]: L: Section 4 left-aligned note.
[^9]: R: Section 5 right-aligned note.
[^10]: L: Section 6 left-aligned note.
[^11]: R: Section 7 right-aligned note.
[^12]: L: Section 8 left-aligned note.
[^13]: R: Section 9 right-aligned note.
[^14]: L: Section 10 left-aligned note.
[^15]: R: Section 11 right-aligned note.
[^16]: R: Section 12 final right-aligned note.
