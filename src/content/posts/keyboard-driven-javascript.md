---
title: "Building Focus-Controlled Keyboard Interfaces in JS"
date: "2026-06-09"
author: "focused_noether"
tags: ["javascript", "keyboard", "accessibility", "ux"]
summary: "Technical tips for managing focus, keyboard event trapping, and dynamic lists in vanilla Javascript."
---

# Keyboard-Driven Web Interfaces

Web browsers are fundamentally designed for mouse and touch interactions. Creating a seamless **keyboard-driven interface** (like a Vim clone) requires overcoming default browser behaviors and managing element focus carefully.

## Listening for Keyboard Events

To build a keyboard interface, capture key events globally on the window:

```javascript
window.addEventListener('keydown', (event) => {
  // 1. Skip if typing in an input
  if (document.activeElement.tagName === 'INPUT') return;

  // 2. Prevent default scrolling for navigation keys
  if (['j', 'k', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) {
    event.preventDefault();
  }

  // 3. Dispatch to key router
  handleKey(event.key);
});
```

## Focus and Accessibility

When using custom keyboard navigation, screen readers must still understand the structure. Here are best practices:

- Use `tabindex="-1"` on custom selectable lines to make them focusable programmatically, but not reachable via normal Tab key cycles.
- Keep track of an active selection index and set `element.focus()` or use `aria-activedescendant` on a parent listbox wrapper.
- Ensure `scrollIntoView({ block: 'nearest' })` is used so the highlighted element stays in the viewport without causing jarring layout shifts.

## State, Not DOM

In a collapsible tree, not all entries are visible. When navigating with `j` and `k`, collapsed lines must be skipped. The original prototype of this very blog queried the DOM for visibility:

```javascript
function getVisibleLines() {
  return Array.from(document.querySelectorAll('.json-line'))
              .filter(el => el.offsetParent !== null);
}
```

`offsetParent` is `null` when an element is hidden via `display: none` — but it is *also* null when an unrelated ancestor (like a hidden pane) is, which produced a subtle navigation-freezing bug. The lesson: derive visibility from your **state model** (the set of collapsed nodes), not from layout. The DOM is a render target, not a source of truth.
